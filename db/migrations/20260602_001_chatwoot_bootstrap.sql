begin;

create table if not exists sara_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  trace_id uuid not null,
  payload jsonb not null,
  status text not null check (status in ('accepted', 'duplicate', 'discarded')),
  created_at timestamptz not null default now()
);

create table if not exists sara_messages (
  id uuid primary key default gen_random_uuid(),
  chatwoot_message_id bigint not null unique,
  trace_id uuid not null,
  account_id bigint not null,
  inbox_id bigint not null,
  conversation_id bigint not null,
  content text not null,
  sender_id bigint,
  sender_type text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists sara_message_buffers (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null,
  account_id bigint not null,
  inbox_id bigint not null,
  conversation_id bigint not null,
  status text not null default 'open' check (status in ('open', 'processing', 'completed', 'failed')),
  process_after timestamptz not null,
  attempt_count integer not null default 0,
  last_error text,
  processing_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sara_message_buffers_one_active_per_conversation
  on sara_message_buffers (account_id, inbox_id, conversation_id)
  where status = 'open';

create index if not exists sara_message_buffers_due
  on sara_message_buffers (process_after)
  where status = 'open';

create table if not exists sara_buffer_messages (
  buffer_id uuid not null references sara_message_buffers(id) on delete cascade,
  message_id uuid not null references sara_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buffer_id, message_id)
);

create table if not exists sara_processing_runs (
  id uuid primary key default gen_random_uuid(),
  buffer_id uuid not null references sara_message_buffers(id),
  trace_id uuid not null,
  stage text not null,
  status text not null check (status in ('started', 'completed', 'failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists sara_outbound_messages (
  id uuid primary key default gen_random_uuid(),
  buffer_id uuid not null references sara_message_buffers(id),
  chatwoot_message_id bigint not null unique,
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function sara_ingest_chatwoot_message(
  p_delivery_id text,
  p_trace_id uuid,
  p_message_id bigint,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint,
  p_content text,
  p_sender_id bigint,
  p_sender_type text,
  p_payload jsonb,
  p_buffer_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_buffer_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(concat_ws(':', p_account_id, p_inbox_id, p_conversation_id)));

  insert into sara_webhook_deliveries (delivery_id, trace_id, payload, status)
  values (p_delivery_id, p_trace_id, p_payload, 'accepted')
  on conflict (delivery_id) do nothing;

  if not found then
    return jsonb_build_object('accepted', true, 'duplicate', true);
  end if;

  insert into sara_messages (
    chatwoot_message_id, trace_id, account_id, inbox_id, conversation_id,
    content, sender_id, sender_type, payload
  ) values (
    p_message_id, p_trace_id, p_account_id, p_inbox_id, p_conversation_id,
    p_content, p_sender_id, p_sender_type, p_payload
  )
  on conflict (chatwoot_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    return jsonb_build_object('accepted', true, 'duplicate', true);
  end if;

  select id into v_buffer_id
  from sara_message_buffers
  where account_id = p_account_id
    and inbox_id = p_inbox_id
    and conversation_id = p_conversation_id
    and status = 'open'
  for update;

  if v_buffer_id is null then
    insert into sara_message_buffers (
      trace_id, account_id, inbox_id, conversation_id, process_after
    ) values (
      p_trace_id, p_account_id, p_inbox_id, p_conversation_id,
      now() + make_interval(secs => p_buffer_seconds)
    ) returning id into v_buffer_id;
  else
    update sara_message_buffers
    set process_after = now() + make_interval(secs => p_buffer_seconds),
        updated_at = now()
    where id = v_buffer_id;
  end if;

  insert into sara_buffer_messages (buffer_id, message_id)
  values (v_buffer_id, v_message_id);

  return jsonb_build_object('accepted', true, 'duplicate', false, 'bufferId', v_buffer_id);
end;
$$;

create or replace function sara_claim_due_message_buffers(p_limit integer default 10)
returns table (
  buffer_id uuid,
  trace_id uuid,
  account_id bigint,
  inbox_id bigint,
  conversation_id bigint,
  messages jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select b.id
    from sara_message_buffers b
    where (b.status = 'open' and b.process_after <= now())
       or (b.status = 'processing' and b.processing_started_at <= now() - interval '5 minutes')
    order by b.process_after
    for update skip locked
    limit p_limit
  ),
  updated as (
    update sara_message_buffers b
    set status = 'processing',
        processing_started_at = now(),
        updated_at = now(),
        attempt_count = attempt_count + 1
    from claimed
    where b.id = claimed.id
    returning b.*
  )
  select
    u.id,
    u.trace_id,
    u.account_id,
    u.inbox_id,
    u.conversation_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', m.chatwoot_message_id,
          'content', m.content,
          'created_at', m.created_at
        ) order by m.created_at
      ),
      '[]'::jsonb
    )
  from updated u
  join sara_buffer_messages bm on bm.buffer_id = u.id
  join sara_messages m on m.id = bm.message_id
  group by u.id, u.trace_id, u.account_id, u.inbox_id, u.conversation_id;
end;
$$;

create or replace function sara_complete_message_buffer(
  p_buffer_id uuid,
  p_response text,
  p_outbound_message_id bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into sara_outbound_messages (buffer_id, chatwoot_message_id, content)
  values (p_buffer_id, p_outbound_message_id, p_response);

  update sara_message_buffers
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_buffer_id;
end;
$$;

create or replace function sara_fail_message_buffer(
  p_buffer_id uuid,
  p_error text
) returns void
language sql
security definer
set search_path = public
as $$
  update sara_message_buffers
  set status = case when attempt_count < 3 then 'open' else 'failed' end,
      process_after = case when attempt_count < 3 then now() + interval '30 seconds' else process_after end,
      last_error = p_error,
      updated_at = now()
  where id = p_buffer_id;
$$;

alter table sara_webhook_deliveries enable row level security;
alter table sara_messages enable row level security;
alter table sara_message_buffers enable row level security;
alter table sara_buffer_messages enable row level security;
alter table sara_processing_runs enable row level security;
alter table sara_outbound_messages enable row level security;

revoke all on sara_webhook_deliveries from anon, authenticated;
revoke all on sara_messages from anon, authenticated;
revoke all on sara_message_buffers from anon, authenticated;
revoke all on sara_buffer_messages from anon, authenticated;
revoke all on sara_processing_runs from anon, authenticated;
revoke all on sara_outbound_messages from anon, authenticated;

revoke all on function sara_ingest_chatwoot_message(text, uuid, bigint, bigint, bigint, bigint, text, bigint, text, jsonb, integer) from public, anon, authenticated;
revoke all on function sara_claim_due_message_buffers(integer) from public, anon, authenticated;
revoke all on function sara_complete_message_buffer(uuid, text, bigint) from public, anon, authenticated;
revoke all on function sara_fail_message_buffer(uuid, text) from public, anon, authenticated;

grant execute on function sara_ingest_chatwoot_message(text, uuid, bigint, bigint, bigint, bigint, text, bigint, text, jsonb, integer) to service_role;
grant execute on function sara_claim_due_message_buffers(integer) to service_role;
grant execute on function sara_complete_message_buffer(uuid, text, bigint) to service_role;
grant execute on function sara_fail_message_buffer(uuid, text) to service_role;

commit;
