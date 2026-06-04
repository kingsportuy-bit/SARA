-- TASK-20260603-013: objectives MVP
-- Create sara_objectives table, add objective_id to sara_tasks, RPCs, and events
-- Only touches objects with sara_ prefix

begin;

-- 1. sara_objectives entity definition
create table if not exists sara_objectives (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'objectives_create_input.v1',
  title text not null,
  slug text not null,
  description text,
  area_id uuid,
  status text not null default 'active',
  target_date date,
  success_criteria jsonb not null default '[]'::jsonb,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  achieved_at timestamptz,
  archived_at timestamptz,

  constraint sara_objectives_title_not_empty check (length(trim(title)) > 0),
  constraint sara_objectives_slug_not_empty check (length(trim(slug)) > 0),
  constraint sara_objectives_slug_unique unique (slug),
  constraint sara_objectives_status_valid check (status in ('active', 'achieved', 'archived')),
  constraint sara_objectives_success_criteria_array check (jsonb_typeof(success_criteria) = 'array'),
  constraint sara_objectives_achieved_at_requires_achieved
    check (achieved_at is null or status = 'achieved'),
  constraint sara_objectives_archived_at_requires_archived
    check (archived_at is null or status = 'archived'),
  constraint sara_objectives_area_id_active
    foreign key (area_id) references sara_areas(id)
);

-- 2. Enable RLS
alter table sara_objectives enable row level security;

-- 3. Revoke access to anon and authenticated
revoke all on table sara_objectives from anon, authenticated;
grant all on table sara_objectives to service_role;

-- 4. Add objective_id column to sara_tasks
alter table sara_tasks
  add column if not exists objective_id uuid;

-- 5. RPC: sara_create_objective
create or replace function sara_create_objective(
  p_trace_id uuid,
  p_title text,
  p_slug text,
  p_description text default null,
  p_area_id uuid default null,
  p_area_slug text default null,
  p_target_date date default null,
  p_success_criteria jsonb default '[]'::jsonb,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_objective_id uuid;
  v_event_id uuid;
  v_title text;
  v_slug text;
  v_area_id uuid;
  v_area_name text;
begin
  -- Validate title not empty
  if length(trim(p_title)) = 0 then
    return jsonb_build_object(
      'error', 'objective title cannot be empty'
    );
  end if;

  -- Validate slug not empty
  if length(trim(p_slug)) = 0 then
    return jsonb_build_object(
      'error', 'objective slug cannot be empty'
    );
  end if;

  -- Check for existing active objective with same slug
  if exists (
    select 1 from sara_objectives
    where slug = p_slug
      and status = 'active'
  ) then
    return jsonb_build_object(
      'error', 'objective with slug "' || p_slug || '" already exists as active'
    );
  end if;

  -- If area_slug provided, resolve area_id
  if p_area_slug is not null and length(trim(p_area_slug)) > 0 then
    select id, name into v_area_id, v_area_name
    from sara_areas
    where slug = trim(p_area_slug) and status = 'active';

    if v_area_id is null then
      return jsonb_build_object(
        'error', 'active area with slug "' || p_area_slug || '" not found'
      );
    end if;
  elsif p_area_id is not null then
    select id, name into v_area_id, v_area_name
    from sara_areas
    where id = p_area_id and status = 'active';

    if v_area_id is null then
      return jsonb_build_object(
        'error', 'active area not found'
      );
    end if;
  end if;

  -- Insert objective
  insert into sara_objectives (title, slug, description, area_id, status, target_date, success_criteria, trace_id, schema_version)
  values (trim(p_title), trim(p_slug), p_description, v_area_id, 'active', p_target_date, p_success_criteria, p_trace_id, 'objectives_create_input.v1')
  returning id, title, slug into v_objective_id, v_title, v_slug;

  -- Emit objective_created event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'objective_created',
    'objective',
    v_objective_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'title', v_title,
      'slug', v_slug,
      'description', p_description,
      'area_id', v_area_id,
      'area_name', v_area_name,
      'target_date', p_target_date,
      'success_criteria', p_success_criteria,
      'status', 'active'
    )
  )
  returning id into v_event_id;

  -- Update updated_at
  update sara_objectives set updated_at = now() where id = v_objective_id;

  return jsonb_build_object(
    'objective_id', v_objective_id,
    'event_id', v_event_id,
    'title', v_title,
    'slug', v_slug,
    'area_id', v_area_id,
    'area_name', v_area_name,
    'trace_id', p_trace_id,
    'schema_version', 'objectives_create_result.v1'
  );
end;
$$;

revoke execute on function sara_create_objective(uuid, text, text, text, uuid, text, date, jsonb, text) from anon, authenticated;
grant execute on function sara_create_objective(uuid, text, text, text, uuid, text, date, jsonb, text) to service_role;

-- 6. RPC: sara_achieve_objective
create or replace function sara_achieve_objective(
  p_trace_id uuid,
  p_objective_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_objective record;
  v_event_id uuid;
begin
  -- Find objective by id or slug
  if p_objective_id is not null then
    select * into v_objective from sara_objectives where id = p_objective_id;
  elsif p_slug is not null then
    select * into v_objective from sara_objectives where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'objective id or slug required'
    );
  end if;

  if v_objective is null then
    return jsonb_build_object(
      'error', 'objective not found'
    );
  end if;

  -- Validate not already achieved
  if v_objective.status = 'achieved' then
    return jsonb_build_object(
      'error', 'objective is already achieved'
    );
  end if;

  -- Mark as achieved
  update sara_objectives
  set status = 'achieved', achieved_at = now(), updated_at = now()
  where id = v_objective.id;

  -- Emit objective_achieved event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'objective_achieved',
    'objective',
    v_objective.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'title', v_objective.title,
      'slug', v_objective.slug,
      'previous_status', v_objective.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'objective_id', v_objective.id,
    'event_id', v_event_id,
    'title', v_objective.title,
    'slug', v_objective.slug,
    'trace_id', p_trace_id,
    'schema_version', 'objectives_achieve_result.v1'
  );
end;
$$;

revoke execute on function sara_achieve_objective(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_achieve_objective(uuid, uuid, text, text) to service_role;

-- 7. RPC: sara_archive_objective
create or replace function sara_archive_objective(
  p_trace_id uuid,
  p_objective_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_objective record;
  v_event_id uuid;
begin
  -- Find objective by id or slug
  if p_objective_id is not null then
    select * into v_objective from sara_objectives where id = p_objective_id;
  elsif p_slug is not null then
    select * into v_objective from sara_objectives where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'objective id or slug required'
    );
  end if;

  if v_objective is null then
    return jsonb_build_object(
      'error', 'objective not found'
    );
  end if;

  -- Mark as archived
  update sara_objectives
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = v_objective.id;

  -- Emit objective_archived event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'objective_archived',
    'objective',
    v_objective.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'title', v_objective.title,
      'slug', v_objective.slug,
      'previous_status', v_objective.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'objective_id', v_objective.id,
    'event_id', v_event_id,
    'title', v_objective.title,
    'slug', v_objective.slug,
    'trace_id', p_trace_id,
    'schema_version', 'objectives_archive_result.v1'
  );
end;
$$;

revoke execute on function sara_archive_objective(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_archive_objective(uuid, uuid, text, text) to service_role;

-- 8. RPC: sara_assign_task_objective
create or replace function sara_assign_task_objective(
  p_trace_id uuid,
  p_task_id uuid,
  p_objective_id uuid default null,
  p_objective_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_objective record;
  v_task record;
  v_event_id uuid;
begin
  -- Find objective
  if p_objective_id is not null then
    select * into v_objective from sara_objectives where id = p_objective_id and status = 'active';
  elsif p_objective_slug is not null then
    select * into v_objective from sara_objectives where slug = p_objective_slug and status = 'active';
  else
    return jsonb_build_object(
      'error', 'objective id or slug required'
    );
  end if;

  if v_objective is null then
    return jsonb_build_object(
      'error', 'active objective not found'
    );
  end if;

  -- Find task
  select * into v_task from sara_tasks where id = p_task_id;

  if v_task is null then
    return jsonb_build_object(
      'error', 'task not found'
    );
  end if;

  -- Update task objective_id
  update sara_tasks set objective_id = v_objective.id where id = p_task_id;

  -- Emit task_objective_assigned event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'task_objective_assigned',
    'task',
    p_task_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'objective_id', v_objective.id,
      'objective_title', v_objective.title,
      'objective_slug', v_objective.slug
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'task_id', p_task_id,
    'task_title', v_task.title,
    'objective_id', v_objective.id,
    'objective_title', v_objective.title,
    'objective_slug', v_objective.slug,
    'event_id', v_event_id,
    'trace_id', p_trace_id,
    'schema_version', 'objectives_assign_task_result.v1'
  );
end;
$$;

revoke execute on function sara_assign_task_objective(uuid, uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_assign_task_objective(uuid, uuid, uuid, text, text) to service_role;

commit;
