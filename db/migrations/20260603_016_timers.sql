-- TASK-20260603-016: timers MVP
-- Create sara_timers schema plus RPCs for interactive short timers
-- Only touches objects with sara_ prefix

begin;

-- 1. sara_timers entity definition
create table if not exists sara_timers (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'timers_start_input.v1',
  kind text not null,
  status text not null default 'pending',
  title text not null,
  duration_seconds integer not null,
  due_at timestamptz not null,
  related_entity_type text,
  related_entity_id uuid,
  account_id bigint not null,
  inbox_id bigint not null,
  conversation_id bigint not null,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fired_at timestamptz,
  canceled_at timestamptz,

  constraint sara_timers_title_not_empty check (length(trim(title)) > 0),
  constraint sara_timers_kind_valid check (kind in ('workout_rest', 'generic')),
  constraint sara_timers_status_valid check (status in ('pending', 'fired', 'canceled')),
  constraint sara_timers_duration_positive check (duration_seconds > 0),
  constraint sara_timers_fired_at_requires_fired check (fired_at is null or status = 'fired'),
  constraint sara_timers_canceled_at_requires_canceled check (canceled_at is null or status = 'canceled')
);

-- 2. Enable RLS
alter table sara_timers enable row level security;

-- 3. Revoke access to anon and authenticated
revoke all on table sara_timers from anon, authenticated;
grant all on table sara_timers to service_role;

-- 4. RPC: sara_start_timer
create or replace function sara_start_timer(
  p_trace_id uuid,
  p_kind text,
  p_title text,
  p_duration_seconds integer,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timer_id uuid;
  v_event_id uuid;
  v_due_at timestamptz;
begin
  -- Validate title not empty
  if length(trim(p_title)) = 0 then
    return jsonb_build_object('error', 'timer title cannot be empty');
  end if;

  -- Validate kind
  if p_kind not in ('workout_rest', 'generic') then
    return jsonb_build_object('error', 'invalid timer kind');
  end if;

  -- Validate duration positive
  if p_duration_seconds <= 0 then
    return jsonb_build_object('error', 'duration must be positive');
  end if;

  -- Validate duration max (MVP: 30 minutes = 1800 seconds)
  if p_duration_seconds > 1800 then
    return jsonb_build_object('error', 'duration exceeds MVP maximum of 30 minutes');
  end if;

  -- Calculate due_at
  v_due_at := now() + (p_duration_seconds || ' seconds')::interval;

  -- Insert timer
  insert into sara_timers (
    kind, title, duration_seconds, due_at,
    related_entity_type, related_entity_id,
    account_id, inbox_id, conversation_id,
    trace_id, schema_version, status
  )
  values (
    p_kind, trim(p_title), p_duration_seconds, v_due_at,
    p_related_entity_type, p_related_entity_id,
    p_account_id, p_inbox_id, p_conversation_id,
    p_trace_id, 'timers_start_input.v1', 'pending'
  )
  returning id into v_timer_id;

  -- Emit timer_started event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'timer_started',
    'timer',
    v_timer_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'kind', p_kind,
      'title', trim(p_title),
      'duration_seconds', p_duration_seconds,
      'due_at', v_due_at,
      'related_entity_type', p_related_entity_type,
      'related_entity_id', p_related_entity_id,
      'status', 'pending'
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'timer_id', v_timer_id,
    'event_id', v_event_id,
    'kind', p_kind,
    'title', trim(p_title),
    'duration_seconds', p_duration_seconds,
    'due_at', v_due_at,
    'trace_id', p_trace_id,
    'schema_version', 'timers_start_result.v1'
  );
end;
$$;

revoke execute on function sara_start_timer(uuid, text, text, integer, bigint, bigint, bigint, text, uuid, text) from anon, authenticated;
grant execute on function sara_start_timer(uuid, text, text, integer, bigint, bigint, bigint, text, uuid, text) to service_role;

-- 5. RPC: sara_cancel_timer
create or replace function sara_cancel_timer(
  p_trace_id uuid,
  p_timer_id uuid,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timer record;
  v_event_id uuid;
begin
  -- Find timer
  select * into v_timer from sara_timers
  where id = p_timer_id
    and account_id = p_account_id
    and inbox_id = p_inbox_id
    and conversation_id = p_conversation_id;

  if v_timer is null then
    return jsonb_build_object('error', 'timer not found');
  end if;

  -- Check status
  if v_timer.status = 'canceled' then
    return jsonb_build_object('error', 'timer is already canceled');
  end if;

  if v_timer.status = 'fired' then
    return jsonb_build_object('error', 'timer has already fired');
  end if;

  -- Mark as canceled
  update sara_timers
  set status = 'canceled', canceled_at = now(), updated_at = now()
  where id = v_timer.id;

  -- Emit timer_canceled event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'timer_canceled',
    'timer',
    v_timer.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'kind', v_timer.kind,
      'title', v_timer.title,
      'duration_seconds', v_timer.duration_seconds,
      'previous_status', v_timer.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'timer_id', v_timer.id,
    'event_id', v_event_id,
    'kind', v_timer.kind,
    'title', v_timer.title,
    'trace_id', p_trace_id,
    'schema_version', 'timers_cancel_result.v1'
  );
end;
$$;

revoke execute on function sara_cancel_timer(uuid, uuid, bigint, bigint, bigint, text) from anon, authenticated;
grant execute on function sara_cancel_timer(uuid, uuid, bigint, bigint, bigint, text) to service_role;

-- 6. RPC: sara_claim_due_timers
create or replace function sara_claim_due_timers(
  p_limit integer,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint
)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timer record;
begin
  for v_timer in
    select * from sara_timers
    where status = 'pending'
      and due_at <= now()
      and account_id = p_account_id
      and inbox_id = p_inbox_id
      and conversation_id = p_conversation_id
    order by due_at asc
    limit p_limit
    for update skip locked
  loop
    return next jsonb_build_object(
      'timer_id', v_timer.id,
      'kind', v_timer.kind,
      'title', v_timer.title,
      'duration_seconds', v_timer.duration_seconds,
      'due_at', v_timer.due_at,
      'related_entity_type', v_timer.related_entity_type,
      'related_entity_id', v_timer.related_entity_id,
      'trace_id', v_timer.trace_id,
      'created_at', v_timer.created_at
    );
  end loop;
end;
$$;

revoke execute on function sara_claim_due_timers(integer, bigint, bigint, bigint) from anon, authenticated;
grant execute on function sara_claim_due_timers(integer, bigint, bigint, bigint) to service_role;

-- 7. RPC: sara_mark_timer_fired
create or replace function sara_mark_timer_fired(
  p_trace_id uuid,
  p_timer_id uuid,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timer record;
  v_event_id uuid;
begin
  -- Find timer
  select * into v_timer from sara_timers where id = p_timer_id;

  if v_timer is null then
    return jsonb_build_object('error', 'timer not found');
  end if;

  -- Check status
  if v_timer.status != 'pending' then
    return jsonb_build_object('error', 'timer is not pending');
  end if;

  -- Mark as fired
  update sara_timers
  set status = 'fired', fired_at = now(), updated_at = now()
  where id = v_timer.id;

  -- Emit timer_fired event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'timer_fired',
    'timer',
    v_timer.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'kind', v_timer.kind,
      'title', v_timer.title,
      'duration_seconds', v_timer.duration_seconds,
      'due_at', v_timer.due_at
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'timer_id', v_timer.id,
    'event_id', v_event_id,
    'kind', v_timer.kind,
    'title', v_timer.title,
    'trace_id', p_trace_id,
    'schema_version', 'timers_mark_fired_result.v1'
  );
end;
$$;

revoke execute on function sara_mark_timer_fired(uuid, uuid, text) from anon, authenticated;
grant execute on function sara_mark_timer_fired(uuid, uuid, text) to service_role;

-- 8. Claim query performance
create index if not exists sara_timers_pending_due_idx
  on sara_timers (account_id, inbox_id, conversation_id, due_at)
  where status = 'pending';

commit;
