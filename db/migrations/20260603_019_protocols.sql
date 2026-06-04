-- TASK-20260603-019: protocols MVP
-- Create sara_protocols table, RPCs, and events
-- Only touches objects with sara_ prefix

begin;

-- 1. sara_protocols entity definition
create table if not exists sara_protocols (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'protocols_create_input.v1',
  name text not null,
  slug text not null,
  status text not null default 'draft',
  scope text not null default 'general',
  rules jsonb not null default '[]'::jsonb,
  description text,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,

  constraint sara_protocols_name_not_empty check (length(trim(name)) > 0),
  constraint sara_protocols_slug_not_empty check (length(trim(slug)) > 0),
  constraint sara_protocols_slug_unique unique (slug),
  constraint sara_protocols_status_valid check (status in ('draft', 'active', 'archived')),
  constraint sara_protocols_scope_valid check (scope in ('daily', 'fitness', 'planning', 'general')),
  constraint sara_protocols_rules_array check (jsonb_typeof(rules) = 'array'),
  constraint sara_protocols_activated_at_requires_active
    check (activated_at is null or status = 'active'),
  constraint sara_protocols_archived_at_requires_archived
    check (archived_at is null or status = 'archived')
);

-- 2. Enable RLS
alter table sara_protocols enable row level security;

-- 3. Revoke access to anon and authenticated
revoke all on table sara_protocols from anon, authenticated;
grant all on table sara_protocols to service_role;

-- 4. RPC: sara_create_protocol
create or replace function sara_create_protocol(
  p_trace_id uuid,
  p_name text,
  p_slug text,
  p_scope text default 'general',
  p_rules jsonb default '[]'::jsonb,
  p_description text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_protocol_id uuid;
  v_event_id uuid;
  v_name text;
  v_slug text;
begin
  -- Validate name not empty
  if length(trim(p_name)) = 0 then
    return jsonb_build_object(
      'error', 'protocol name cannot be empty'
    );
  end if;

  -- Validate slug not empty
  if length(trim(p_slug)) = 0 then
    return jsonb_build_object(
      'error', 'protocol slug cannot be empty'
    );
  end if;

  -- Validate scope
  if p_scope not in ('daily', 'fitness', 'planning', 'general') then
    return jsonb_build_object(
      'error', 'invalid scope: ' || p_scope
    );
  end if;

  -- Validate rules is array
  if jsonb_typeof(p_rules) <> 'array' then
    return jsonb_build_object(
      'error', 'rules must be a JSON array'
    );
  end if;

  -- Check for existing active protocol with same slug
  if exists (
    select 1 from sara_protocols
    where slug = p_slug
      and status != 'archived'
  ) then
    return jsonb_build_object(
      'error', 'protocol with slug "' || p_slug || '" already exists'
    );
  end if;

  -- Insert protocol (defaults to draft status)
  insert into sara_protocols (name, slug, status, scope, rules, description, trace_id, schema_version)
  values (trim(p_name), trim(p_slug), 'draft', p_scope, p_rules, p_description, p_trace_id, 'protocols_create_input.v1')
  returning id, name, slug into v_protocol_id, v_name, v_slug;

  -- Emit protocol_created event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'protocol_created',
    'protocol',
    v_protocol_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_name,
      'slug', v_slug,
      'scope', p_scope,
      'status', 'draft'
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'protocol_id', v_protocol_id,
    'event_id', v_event_id,
    'name', v_name,
    'slug', v_slug,
    'scope', p_scope,
    'status', 'draft',
    'trace_id', p_trace_id,
    'schema_version', 'protocols_create_result.v1'
  );
end;
$$;

revoke execute on function sara_create_protocol(uuid, text, text, text, jsonb, text, text) from anon, authenticated;
grant execute on function sara_create_protocol(uuid, text, text, text, jsonb, text, text) to service_role;

-- 5. RPC: sara_activate_protocol
create or replace function sara_activate_protocol(
  p_trace_id uuid,
  p_protocol_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_protocol record;
  v_event_id uuid;
begin
  -- Find protocol by id or slug
  if p_protocol_id is not null then
    select * into v_protocol from sara_protocols where id = p_protocol_id;
  elsif p_slug is not null then
    select * into v_protocol from sara_protocols where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'protocol id or slug required'
    );
  end if;

  if v_protocol is null then
    return jsonb_build_object(
      'error', 'protocol not found'
    );
  end if;

  -- Validate not archived
  if v_protocol.status = 'archived' then
    return jsonb_build_object(
      'error', 'cannot activate an archived protocol'
    );
  end if;

  -- Validate not already active
  if v_protocol.status = 'active' then
    return jsonb_build_object(
      'error', 'protocol is already active'
    );
  end if;

  -- Mark as active
  update sara_protocols
  set status = 'active', activated_at = now(), updated_at = now()
  where id = v_protocol.id;

  -- Emit protocol_activated event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'protocol_activated',
    'protocol',
    v_protocol.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_protocol.name,
      'slug', v_protocol.slug,
      'scope', v_protocol.scope,
      'previous_status', v_protocol.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'protocol_id', v_protocol.id,
    'event_id', v_event_id,
    'name', v_protocol.name,
    'slug', v_protocol.slug,
    'scope', v_protocol.scope,
    'trace_id', p_trace_id,
    'schema_version', 'protocols_activate_result.v1'
  );
end;
$$;

revoke execute on function sara_activate_protocol(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_activate_protocol(uuid, uuid, text, text) to service_role;

-- 6. RPC: sara_archive_protocol
create or replace function sara_archive_protocol(
  p_trace_id uuid,
  p_protocol_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_protocol record;
  v_event_id uuid;
begin
  -- Find protocol by id or slug
  if p_protocol_id is not null then
    select * into v_protocol from sara_protocols where id = p_protocol_id;
  elsif p_slug is not null then
    select * into v_protocol from sara_protocols where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'protocol id or slug required'
    );
  end if;

  if v_protocol is null then
    return jsonb_build_object(
      'error', 'protocol not found'
    );
  end if;

  -- Validate not already archived
  if v_protocol.status = 'archived' then
    return jsonb_build_object(
      'error', 'protocol is already archived'
    );
  end if;

  -- Mark as archived
  update sara_protocols
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = v_protocol.id;

  -- Emit protocol_archived event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'protocol_archived',
    'protocol',
    v_protocol.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_protocol.name,
      'slug', v_protocol.slug,
      'scope', v_protocol.scope,
      'previous_status', v_protocol.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'protocol_id', v_protocol.id,
    'event_id', v_event_id,
    'name', v_protocol.name,
    'slug', v_protocol.slug,
    'scope', v_protocol.scope,
    'trace_id', p_trace_id,
    'schema_version', 'protocols_archive_result.v1'
  );
end;
$$;

revoke execute on function sara_archive_protocol(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_archive_protocol(uuid, uuid, text, text) to service_role;

-- 7. RPC: sara_log_protocol_evaluation
create or replace function sara_log_protocol_evaluation(
  p_trace_id uuid,
  p_protocol_id uuid default null,
  p_slug text default null,
  p_evidence jsonb default '{}'::jsonb,
  p_suggestions jsonb default '[]'::jsonb,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_protocol record;
  v_event_id uuid;
begin
  -- Find protocol by id or slug
  if p_protocol_id is not null then
    select * into v_protocol from sara_protocols where id = p_protocol_id;
  elsif p_slug is not null then
    select * into v_protocol from sara_protocols where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'protocol id or slug required'
    );
  end if;

  if v_protocol is null then
    return jsonb_build_object(
      'error', 'protocol not found'
    );
  end if;

  -- Log evaluation event (read-only, just traces)
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'protocol_evaluated',
    'protocol',
    v_protocol.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'protocol_name', v_protocol.name,
      'protocol_slug', v_protocol.slug,
      'scope', v_protocol.scope,
      'status', v_protocol.status,
      'evidence', p_evidence,
      'suggestions', p_suggestions
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'protocol_id', v_protocol.id,
    'event_id', v_event_id,
    'name', v_protocol.name,
    'slug', v_protocol.slug,
    'scope', v_protocol.scope,
    'status', v_protocol.status,
    'trace_id', p_trace_id,
    'schema_version', 'protocols_evaluate_result.v1'
  );
end;
$$;

revoke execute on function sara_log_protocol_evaluation(uuid, uuid, text, jsonb, jsonb, text) from anon, authenticated;
grant execute on function sara_log_protocol_evaluation(uuid, uuid, text, jsonb, jsonb, text) to service_role;

commit;
