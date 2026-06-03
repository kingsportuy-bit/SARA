-- TASK-20260603-012: areas MVP
-- Create sara_areas table, RPCs, and events
-- Only touches objects with sara_ prefix

begin;

-- Areas: main entity
create table if not exists sara_areas (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'areas_create_input.v1',
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sara_areas_name_not_empty check (length(trim(name)) > 0),
  constraint sara_areas_slug_not_empty check (length(trim(slug)) > 0),
  constraint sara_areas_slug_unique unique (slug),
  constraint sara_areas_status_valid check (status in ('active', 'paused', 'archived'))
);

-- 2. Enable RLS
alter table sara_areas enable row level security;

-- 3. Revoke access to anon and authenticated
revoke all on table sara_areas from anon, authenticated;
grant all on table sara_areas to service_role;

-- 4. RPC: sara_create_area
create or replace function sara_create_area(
  p_trace_id uuid,
  p_name text,
  p_slug text,
  p_description text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area_id uuid;
  v_event_id uuid;
  v_name text;
  v_slug text;
begin
  -- Validate name not empty
  if length(trim(p_name)) = 0 then
    return jsonb_build_object(
      'error', 'area name cannot be empty'
    );
  end if;

  -- Validate slug not empty
  if length(trim(p_slug)) = 0 then
    return jsonb_build_object(
      'error', 'area slug cannot be empty'
    );
  end if;

  -- Check for existing active or paused area with same slug
  if exists (
    select 1 from sara_areas
    where slug = p_slug
      and status in ('active', 'paused')
  ) then
    return jsonb_build_object(
      'error', 'area with slug "' || p_slug || '" already exists'
    );
  end if;

  -- Insert area
  insert into sara_areas (name, slug, description, status, schema_version)
  values (trim(p_name), trim(p_slug), p_description, 'active', 'areas_create_input.v1')
  returning id, name, slug into v_area_id, v_name, v_slug;

  -- Emit area_created event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'area_created',
    'area',
    v_area_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_name,
      'slug', v_slug,
      'description', p_description,
      'status', 'active'
    )
  )
  returning id into v_event_id;

  -- Update updated_at
  update sara_areas set updated_at = now() where id = v_area_id;

  return jsonb_build_object(
    'area_id', v_area_id,
    'event_id', v_event_id,
    'name', v_name,
    'slug', v_slug,
    'trace_id', p_trace_id,
    'schema_version', 'areas_create_result.v1'
  );
end;
$$;

revoke execute on function sara_create_area(uuid, text, text, text, text) from anon, authenticated;
grant execute on function sara_create_area(uuid, text, text, text, text) to service_role;

-- 5. RPC: sara_archive_area
create or replace function sara_archive_area(
  p_trace_id uuid,
  p_area_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area record;
  v_event_id uuid;
begin
  -- Find area by id or slug
  if p_area_id is not null then
    select * into v_area from sara_areas where id = p_area_id;
  elsif p_slug is not null then
    select * into v_area from sara_areas where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'area id or slug required'
    );
  end if;

  if v_area is null then
    return jsonb_build_object(
      'error', 'area not found'
    );
  end if;

  -- Archive area
  update sara_areas
  set status = 'archived', updated_at = now()
  where id = v_area.id;

  -- Emit area_archived event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'area_archived',
    'area',
    v_area.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_area.name,
      'slug', v_area.slug,
      'previous_status', v_area.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'area_id', v_area.id,
    'event_id', v_event_id,
    'name', v_area.name,
    'slug', v_area.slug,
    'trace_id', p_trace_id,
    'schema_version', 'areas_archive_result.v1'
  );
end;
$$;

revoke execute on function sara_archive_area(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_archive_area(uuid, uuid, text, text) to service_role;

-- 6. RPC: sara_assign_note_area
create or replace function sara_assign_note_area(
  p_trace_id uuid,
  p_note_id uuid,
  p_area_id uuid default null,
  p_area_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area record;
  v_note record;
  v_event_id uuid;
begin
  -- Find area
  if p_area_id is not null then
    select * into v_area from sara_areas where id = p_area_id and status = 'active';
  elsif p_area_slug is not null then
    select * into v_area from sara_areas where slug = p_area_slug and status = 'active';
  else
    return jsonb_build_object(
      'error', 'area id or slug required'
    );
  end if;

  if v_area is null then
    return jsonb_build_object(
      'error', 'active area not found'
    );
  end if;

  -- Find note
  select * into v_note from sara_notes where id = p_note_id;

  if v_note is null then
    return jsonb_build_object(
      'error', 'note not found'
    );
  end if;

  -- Update note area_id
  update sara_notes set area_id = v_area.id where id = p_note_id;

  -- Emit note_area_assigned event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'note_area_assigned',
    'note',
    p_note_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'area_id', v_area.id,
      'area_name', v_area.name,
      'area_slug', v_area.slug
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'note_id', p_note_id,
    'area_id', v_area.id,
    'area_name', v_area.name,
    'area_slug', v_area.slug,
    'event_id', v_event_id,
    'trace_id', p_trace_id,
    'schema_version', 'areas_assign_note_result.v1'
  );
end;
$$;

revoke execute on function sara_assign_note_area(uuid, uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_assign_note_area(uuid, uuid, uuid, text, text) to service_role;

-- 7. RPC: sara_assign_task_area
create or replace function sara_assign_task_area(
  p_trace_id uuid,
  p_task_id uuid,
  p_area_id uuid default null,
  p_area_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area record;
  v_task record;
  v_event_id uuid;
begin
  -- Find area
  if p_area_id is not null then
    select * into v_area from sara_areas where id = p_area_id and status = 'active';
  elsif p_area_slug is not null then
    select * into v_area from sara_areas where slug = p_area_slug and status = 'active';
  else
    return jsonb_build_object(
      'error', 'area id or slug required'
    );
  end if;

  if v_area is null then
    return jsonb_build_object(
      'error', 'active area not found'
    );
  end if;

  -- Find task
  select * into v_task from sara_tasks where id = p_task_id;

  if v_task is null then
    return jsonb_build_object(
      'error', 'task not found'
    );
  end if;

  -- Update task area_id
  update sara_tasks set area_id = v_area.id where id = p_task_id;

  -- Emit task_area_assigned event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'task_area_assigned',
    'task',
    p_task_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'area_id', v_area.id,
      'area_name', v_area.name,
      'area_slug', v_area.slug
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'task_id', p_task_id,
    'title', v_task.title,
    'area_id', v_area.id,
    'area_name', v_area.name,
    'area_slug', v_area.slug,
    'event_id', v_event_id,
    'trace_id', p_trace_id,
    'schema_version', 'areas_assign_task_result.v1'
  );
end;
$$;

revoke execute on function sara_assign_task_area(uuid, uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_assign_task_area(uuid, uuid, uuid, text, text) to service_role;

commit;
