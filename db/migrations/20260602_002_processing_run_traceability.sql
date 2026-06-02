begin;

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
  ),
  runs as (
    insert into sara_processing_runs (buffer_id, trace_id, stage, status, details)
    select
      u.id,
      u.trace_id,
      'bootstrap_response',
      'started',
      jsonb_build_object('attempt_count', u.attempt_count)
    from updated u
    returning buffer_id
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
  join runs r on r.buffer_id = u.id
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

  update sara_processing_runs
  set status = 'completed',
      details = details || jsonb_build_object('outbound_message_id', p_outbound_message_id),
      completed_at = now()
  where id = (
    select id
    from sara_processing_runs
    where buffer_id = p_buffer_id and status = 'started'
    order by created_at desc
    limit 1
  );
end;
$$;

create or replace function sara_fail_message_buffer(
  p_buffer_id uuid,
  p_error text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update sara_message_buffers
  set status = case when attempt_count < 3 then 'open' else 'failed' end,
      process_after = case when attempt_count < 3 then now() + interval '30 seconds' else process_after end,
      last_error = p_error,
      updated_at = now()
  where id = p_buffer_id;

  update sara_processing_runs
  set status = 'failed',
      details = details || jsonb_build_object('error', left(p_error, 2000)),
      completed_at = now()
  where id = (
    select id
    from sara_processing_runs
    where buffer_id = p_buffer_id and status = 'started'
    order by created_at desc
    limit 1
  );
end;
$$;

revoke all on function sara_claim_due_message_buffers(integer) from public, anon, authenticated;
revoke all on function sara_complete_message_buffer(uuid, text, bigint) from public, anon, authenticated;
revoke all on function sara_fail_message_buffer(uuid, text) from public, anon, authenticated;

grant execute on function sara_claim_due_message_buffers(integer) to service_role;
grant execute on function sara_complete_message_buffer(uuid, text, bigint) to service_role;
grant execute on function sara_fail_message_buffer(uuid, text) to service_role;

commit;
