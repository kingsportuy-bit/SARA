begin;

create table if not exists sara_session_contexts (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  account_id bigint not null,
  inbox_id bigint not null,
  conversation_id bigint not null,
  active_module text,
  active_flow text,
  focused_entity_type text,
  focused_entity_id uuid,
  awaiting_confirmation boolean not null default false,
  confirmation_payload jsonb,
  context jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sara_session_contexts_unique_conversation unique (account_id, inbox_id, conversation_id),
  constraint sara_session_contexts_schema_version_check check (schema_version <> '')
);

create index if not exists sara_session_contexts_expires_idx on sara_session_contexts (expires_at)
  where expires_at is not null;

create or replace function sara_get_session_context(
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
begin
  select jsonb_build_object(
    'id', id,
    'schemaVersion', schema_version,
    'accountId', account_id,
    'inboxId', inbox_id,
    'conversationId', conversation_id,
    'activeModule', active_module,
    'activeFlow', active_flow,
    'focusedEntityType', focused_entity_type,
    'focusedEntityId', focused_entity_id,
    'awaitingConfirmation', awaiting_confirmation,
    'confirmationPayload', confirmation_payload,
    'context', context,
    'expiresAt', expires_at,
    'createdAt', created_at,
    'updatedAt', updated_at
  ) into v_context
  from sara_session_contexts
  where account_id = p_account_id
    and inbox_id = p_inbox_id
    and conversation_id = p_conversation_id
    and (expires_at is null or expires_at > now());

  return v_context;
end;
$$;


create or replace function sara_upsert_session_context(
  p_trace_id uuid,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint,
  p_active_module text default null,
  p_active_flow text default null,
  p_focused_entity_type text default null,
  p_focused_entity_id uuid default null,
  p_awaiting_confirmation boolean default false,
  p_confirmation_payload jsonb default null,
  p_context jsonb default '{}'::jsonb,
  p_ttl_minutes integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_event_id uuid;
  v_is_new boolean;
  v_event_type text;
  v_result jsonb;
begin
  if p_account_id is null or p_inbox_id is null or p_conversation_id is null then
    raise exception 'account_id, inbox_id, and conversation_id are required';
  end if;

  select id into v_id
  from sara_session_contexts
  where account_id = p_account_id
    and inbox_id = p_inbox_id
    and conversation_id = p_conversation_id;

  if v_id is null then
    v_is_new := true;
    v_event_type := 'session_context_started';

    insert into sara_session_contexts (
      schema_version, account_id, inbox_id, conversation_id,
      active_module, active_flow, focused_entity_type, focused_entity_id,
      awaiting_confirmation, confirmation_payload, context, expires_at
    ) values (
      'session_context.v1', p_account_id, p_inbox_id, p_conversation_id,
      p_active_module, p_active_flow, p_focused_entity_type, p_focused_entity_id,
      p_awaiting_confirmation, p_confirmation_payload, p_context,
      now() + (p_ttl_minutes || ' minutes')::interval
    ) returning id into v_id;
  else
    v_is_new := false;
    v_event_type := 'session_context_updated';

    update sara_session_contexts
    set active_module = coalesce(p_active_module, sara_session_contexts.active_module),
        active_flow = coalesce(p_active_flow, sara_session_contexts.active_flow),
        focused_entity_type = coalesce(p_focused_entity_type, sara_session_contexts.focused_entity_type),
        focused_entity_id = coalesce(p_focused_entity_id, sara_session_contexts.focused_entity_id),
        awaiting_confirmation = p_awaiting_confirmation,
        confirmation_payload = coalesce(p_confirmation_payload, sara_session_contexts.confirmation_payload),
        context = sara_session_contexts.context || p_context,
        expires_at = coalesce(sara_session_contexts.expires_at, now() + (p_ttl_minutes || ' minutes')::interval),
        updated_at = now()
    where id = v_id;
  end if;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', v_event_type, 'session_context', v_id, p_trace_id, 'system',
    jsonb_build_object(
      'sessionContextId', v_id,
      'accountId', p_account_id,
      'inboxId', p_inbox_id,
      'conversationId', p_conversation_id,
      'activeModule', p_active_module,
      'activeFlow', p_active_flow,
      'focusedEntityType', p_focused_entity_type,
      'focusedEntityId', p_focused_entity_id,
      'isNew', v_is_new
    )
  ) returning id into v_event_id;

  select jsonb_build_object(
    'id', id,
    'schemaVersion', schema_version,
    'accountId', account_id,
    'inboxId', inbox_id,
    'conversationId', conversation_id,
    'activeModule', active_module,
    'activeFlow', active_flow,
    'focusedEntityType', focused_entity_type,
    'focusedEntityId', focused_entity_id,
    'awaitingConfirmation', awaiting_confirmation,
    'confirmationPayload', confirmation_payload,
    'context', context,
    'expiresAt', expires_at,
    'createdAt', created_at,
    'updatedAt', updated_at,
    'eventId', v_event_id,
    'isNew', v_is_new
  ) into v_result
  from sara_session_contexts
  where id = v_id;

  return v_result;
end;
$$;


create or replace function sara_clear_session_context(
  p_trace_id uuid,
  p_account_id bigint,
  p_inbox_id bigint,
  p_conversation_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_event_id uuid;
  v_result jsonb;
begin
  select id into v_id
  from sara_session_contexts
  where account_id = p_account_id
    and inbox_id = p_inbox_id
    and conversation_id = p_conversation_id;

  if v_id is null then
    return jsonb_build_object(
      'cleared', false,
      'reason', 'no active context found'
    );
  end if;

  delete from sara_session_contexts
  where id = v_id;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', 'session_context_cleared', 'session_context', v_id, p_trace_id, 'system',
    jsonb_build_object(
      'sessionContextId', v_id,
      'accountId', p_account_id,
      'inboxId', p_inbox_id,
      'conversationId', p_conversation_id,
      'clearedAt', now()
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'cleared', true,
    'sessionContextId', v_id,
    'eventId', v_event_id
  );
end;
$$;

alter table sara_session_contexts enable row level security;

revoke all on sara_session_contexts from anon, authenticated;

revoke execute on function sara_get_session_context(bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function sara_get_session_context(bigint, bigint, bigint) to service_role;

revoke execute on function sara_upsert_session_context(uuid, bigint, bigint, bigint, text, text, text, uuid, boolean, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function sara_upsert_session_context(uuid, bigint, bigint, bigint, text, text, text, uuid, boolean, jsonb, jsonb, integer) to service_role;

revoke execute on function sara_clear_session_context(uuid, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function sara_clear_session_context(uuid, bigint, bigint, bigint) to service_role;

commit;
