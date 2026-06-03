begin;

create table if not exists sara_reminders (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  title text not null,
  message text,
  status text not null,
  source text not null,
  due_at timestamptz not null,
  sent_at timestamptz,
  canceled_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  related_entity_type text,
  related_entity_id uuid,
  account_id bigint not null,
  inbox_id bigint not null,
  conversation_id bigint not null,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sara_reminders_title_check check (title <> ''),
  constraint sara_reminders_status_check check (status in ('pending', 'processing', 'sent', 'canceled', 'failed')),
  constraint sara_reminders_due_at_check check (due_at > created_at)
);

create or replace function sara_create_reminder(
  p_trace_id uuid,
  p_title text,
  p_message text,
  p_due_at timestamptz,
  p_source text,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint,
  p_related_entity_type text,
  p_related_entity_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reminder_id uuid;
  v_event_id uuid;
begin
  if p_title is null or trim(p_title) = '' then
    raise exception 'title cannot be empty';
  end if;

  if p_due_at <= now() then
    raise exception 'due_at must be in the future';
  end if;

  insert into sara_reminders (
    schema_version, title, message, status, source, due_at,
    account_id, inbox_id, conversation_id,
    related_entity_type, related_entity_id, trace_id
  ) values (
    'reminders.v1', trim(p_title), p_message, 'pending', p_source, p_due_at,
    p_account_id, p_inbox_id, p_conversation_id,
    p_related_entity_type, p_related_entity_id, p_trace_id
  ) returning id into v_reminder_id;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', 'reminder_created', 'reminder', v_reminder_id, p_trace_id, p_source,
    jsonb_build_object(
      'reminder_id', v_reminder_id,
      'title', trim(p_title),
      'due_at', p_due_at,
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'reminder_id', v_reminder_id,
    'event_id', v_event_id,
    'due_at', p_due_at,
    'title', trim(p_title),
    'trace_id', p_trace_id,
    'schema_version', 'reminders_create_result.v1'
  );
end;
$$;

create or replace function sara_cancel_reminder(
  p_trace_id uuid,
  p_reminder_id uuid,
  p_title_match text,
  p_position int,
  p_source text,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reminder_id uuid;
  v_event_id uuid;
  v_title text;
  v_match_count integer;
begin
  if p_reminder_id is not null then
    select id, title into v_reminder_id, v_title
    from sara_reminders
    where id = p_reminder_id and status = 'pending'
      and account_id = p_account_id and inbox_id = p_inbox_id and conversation_id = p_conversation_id;
  elsif p_title_match is not null then
    select count(*) into v_match_count
    from sara_reminders
    where status = 'pending'
      and account_id = p_account_id and inbox_id = p_inbox_id and conversation_id = p_conversation_id
      and lower(title) like lower('%' || trim(p_title_match) || '%');

    if v_match_count > 1 then
      raise exception 'multiple matching pending reminders found';
    end if;

    if v_match_count = 1 then
      select id, title into v_reminder_id, v_title
      from sara_reminders
      where status = 'pending'
        and account_id = p_account_id and inbox_id = p_inbox_id and conversation_id = p_conversation_id
        and lower(title) like lower('%' || trim(p_title_match) || '%')
      order by due_at asc
      limit 1;
    end if;
  elsif p_position is not null and p_position > 0 then
    select id, title into v_reminder_id, v_title
    from (
      select id, title, row_number() over (order by due_at asc) as rn
      from sara_reminders
      where status = 'pending'
        and account_id = p_account_id and inbox_id = p_inbox_id and conversation_id = p_conversation_id
    ) sub
    where sub.rn = p_position;
  end if;

  if v_reminder_id is null then
    raise exception 'no matching pending reminder found';
  end if;

  update sara_reminders
  set status = 'canceled',
      canceled_at = now(),
      updated_at = now()
  where id = v_reminder_id;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', 'reminder_canceled', 'reminder', v_reminder_id, p_trace_id, p_source,
    jsonb_build_object(
      'reminder_id', v_reminder_id,
      'title', v_title,
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'reminder_id', v_reminder_id,
    'event_id', v_event_id,
    'title', v_title,
    'trace_id', p_trace_id,
    'schema_version', 'reminders_cancel_result.v1'
  );
end;
$$;

create or replace function sara_claim_due_reminders(
  p_limit int,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint
) returns setof sara_reminders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reminder sara_reminders;
begin
  for v_reminder in
    with due as (
      select id
      from sara_reminders
      where status = 'pending'
        and due_at <= now()
        and account_id = p_account_id
        and inbox_id = p_inbox_id
        and conversation_id = p_conversation_id
      order by due_at asc
      limit greatest(coalesce(p_limit, 10), 1)
      for update skip locked
    )
    update sara_reminders r
    set status = 'processing', updated_at = now()
    from due
    where r.id = due.id
    returning r.*
  loop
    return next v_reminder;
  end loop;
end;
$$;

create or replace function sara_mark_reminder_sent(
  p_trace_id uuid,
  p_reminder_id uuid,
  p_source text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_title text;
begin
  select title into v_title from sara_reminders where id = p_reminder_id;

  update sara_reminders
  set status = 'sent',
      sent_at = now(),
      updated_at = now()
  where id = p_reminder_id and status = 'processing';

  if not found then
    raise exception 'reminder not found or not in processing status';
  end if;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', 'reminder_sent', 'reminder', p_reminder_id, p_trace_id, p_source,
    jsonb_build_object(
      'reminder_id', p_reminder_id,
      'title', v_title,
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'reminder_id', p_reminder_id,
    'event_id', v_event_id,
    'title', v_title,
    'trace_id', p_trace_id,
    'schema_version', 'reminders_mark_sent_result.v1'
  );
end;
$$;

create or replace function sara_mark_reminder_failed(
  p_trace_id uuid,
  p_reminder_id uuid,
  p_source text,
  p_failure_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_title text;
begin
  select title into v_title from sara_reminders where id = p_reminder_id;

  update sara_reminders
  set status = 'failed',
      failed_at = now(),
      failure_reason = p_failure_reason,
      updated_at = now()
  where id = p_reminder_id and status = 'processing';

  if not found then
    raise exception 'reminder not found or not in processing status';
  end if;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', 'reminder_failed', 'reminder', p_reminder_id, p_trace_id, p_source,
    jsonb_build_object(
      'reminder_id', p_reminder_id,
      'title', v_title,
      'failure_reason', p_failure_reason,
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'reminder_id', p_reminder_id,
    'event_id', v_event_id,
    'title', v_title,
    'trace_id', p_trace_id,
    'schema_version', 'reminders_mark_failed_result.v1'
  );
end;
$$;

create index if not exists sara_reminders_status_due_idx on sara_reminders (status, due_at);
create index if not exists sara_reminders_conversation_idx on sara_reminders (account_id, inbox_id, conversation_id);
create index if not exists sara_reminders_trace_idx on sara_reminders (trace_id);

alter table sara_reminders enable row level security;

revoke all on sara_reminders from anon, authenticated;

revoke execute on function sara_create_reminder(uuid, text, text, timestamptz, text, bigint, bigint, bigint, text, uuid) from public, anon, authenticated;
grant execute on function sara_create_reminder(uuid, text, text, timestamptz, text, bigint, bigint, bigint, text, uuid) to service_role;

revoke execute on function sara_cancel_reminder(uuid, uuid, text, int, text, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function sara_cancel_reminder(uuid, uuid, text, int, text, bigint, bigint, bigint) to service_role;

revoke execute on function sara_claim_due_reminders(int, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function sara_claim_due_reminders(int, bigint, bigint, bigint) to service_role;

revoke execute on function sara_mark_reminder_sent(uuid, uuid, text) from public, anon, authenticated;
grant execute on function sara_mark_reminder_sent(uuid, uuid, text) to service_role;

revoke execute on function sara_mark_reminder_failed(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function sara_mark_reminder_failed(uuid, uuid, text, text) to service_role;

commit;
