-- TASK-20260603-014: routines MVP
-- Create sara_routines and sara_routine_steps tables, RPCs, and events
-- Only touches objects with sara_ prefix

begin;

-- 1. sara_routines entity definition
create table if not exists sara_routines (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'routines_create_input.v1',
  name text not null,
  slug text not null,
  description text,
  status text not null default 'draft',
  area_id uuid,
  objective_id uuid,
  schedule jsonb not null default '{}'::jsonb,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,

  constraint sara_routines_name_not_empty check (length(trim(name)) > 0),
  constraint sara_routines_slug_not_empty check (length(trim(slug)) > 0),
  constraint sara_routines_slug_unique unique (slug),
  constraint sara_routines_status_valid check (status in ('draft', 'active', 'paused', 'archived')),
  constraint sara_routines_schedule_object check (jsonb_typeof(schedule) = 'object'),
  constraint sara_routines_activated_at_requires_active
    check (activated_at is null or status = 'active'),
  constraint sara_routines_paused_at_requires_paused
    check (paused_at is null or status = 'paused'),
  constraint sara_routines_archived_at_requires_archived
    check (archived_at is null or status = 'archived'),
  constraint sara_routines_area_id_active
    foreign key (area_id) references sara_areas(id),
  constraint sara_routines_objective_id_active
    foreign key (objective_id) references sara_objectives(id)
);

-- 2. Enable RLS
alter table sara_routines enable row level security;

-- 3. Revoke access to anon and authenticated
revoke all on table sara_routines from anon, authenticated;
grant all on table sara_routines to service_role;

-- 4. sara_routine_steps entity definition
create table if not exists sara_routine_steps (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'routines_step_input.v1',
  routine_id uuid not null,
  position integer not null,
  time_of_day time,
  title text not null,
  description text,
  duration_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sara_routine_steps_routine_id_fk
    foreign key (routine_id) references sara_routines(id) on delete cascade,
  constraint sara_routine_steps_position_positive check (position > 0),
  constraint sara_routine_steps_title_not_empty check (length(trim(title)) > 0),
  constraint sara_routine_steps_duration_positive check (duration_minutes is null or duration_minutes > 0),
  constraint sara_routine_steps_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint sara_routine_steps_unique_position
    unique (routine_id, position)
);

-- 5. Enable RLS on steps
alter table sara_routine_steps enable row level security;

-- 6. Revoke access to anon and authenticated
revoke all on table sara_routine_steps from anon, authenticated;
grant all on table sara_routine_steps to service_role;

-- 7. RPC: sara_create_routine
create or replace function sara_create_routine(
  p_trace_id uuid,
  p_name text,
  p_slug text,
  p_description text default null,
  p_area_id uuid default null,
  p_area_slug text default null,
  p_steps jsonb default '[]'::jsonb,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routine_id uuid;
  v_event_id uuid;
  v_name text;
  v_slug text;
  v_step jsonb;
  v_step_id uuid;
  v_step_position integer;
begin
  -- Validate name not empty
  if length(trim(p_name)) = 0 then
    return jsonb_build_object(
      'error', 'routine name cannot be empty'
    );
  end if;

  -- Validate slug not empty
  if length(trim(p_slug)) = 0 then
    return jsonb_build_object(
      'error', 'routine slug cannot be empty'
    );
  end if;

  -- Check for existing routine with same slug
  if exists (
    select 1 from sara_routines
    where slug = p_slug
  ) then
    return jsonb_build_object(
      'error', 'routine with slug "' || p_slug || '" already exists'
    );
  end if;

  -- If area_slug provided, resolve area_id
  if p_area_slug is not null and length(trim(p_area_slug)) > 0 then
    select id into p_area_id
    from sara_areas
    where slug = trim(p_area_slug) and status = 'active';

    if p_area_id is null then
      return jsonb_build_object(
        'error', 'active area with slug "' || p_area_slug || '" not found'
      );
    end if;
  end if;

  -- Insert routine
  insert into sara_routines (name, slug, description, area_id, status, schedule, trace_id, schema_version)
  values (trim(p_name), trim(p_slug), p_description, p_area_id, 'draft', '{}'::jsonb, p_trace_id, 'routines_create_input.v1')
  returning id, name, slug into v_routine_id, v_name, v_slug;

  -- Insert steps if provided
  if jsonb_array_length(p_steps) > 0 then
    for v_step in select * from jsonb_array_elements(p_steps)
    loop
      v_step_position := coalesce((v_step->>'position')::int, 0);

      insert into sara_routine_steps (routine_id, position, time_of_day, title, description, duration_minutes, metadata)
      values (
        v_routine_id,
        v_step_position,
        (v_step->>'time_of_day')::time,
        trim(v_step->>'title'),
        v_step->>'description',
        (v_step->>'duration_minutes')::int,
        coalesce(v_step->'metadata', '{}'::jsonb)
      )
      returning id into v_step_id;

      -- Emit routine_step_added event
      insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
      values (
        'sara_events.v1',
        'routine_step_added',
        'routine_step',
        v_step_id,
        p_trace_id,
        p_source,
        jsonb_build_object(
          'routine_id', v_routine_id,
          'position', v_step_position,
          'time_of_day', v_step->>'time_of_day',
          'title', v_step->>'title'
        )
      );
    end loop;
  end if;

  -- Emit routine_created event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'routine_created',
    'routine',
    v_routine_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_name,
      'slug', v_slug,
      'description', p_description,
      'area_id', p_area_id,
      'step_count', jsonb_array_length(p_steps),
      'status', 'draft'
    )
  )
  returning id into v_event_id;

  -- Update updated_at
  update sara_routines set updated_at = now() where id = v_routine_id;

  return jsonb_build_object(
    'routine_id', v_routine_id,
    'event_id', v_event_id,
    'name', v_name,
    'slug', v_slug,
    'trace_id', p_trace_id,
    'schema_version', 'routines_create_result.v1'
  );
end;
$$;

revoke execute on function sara_create_routine(uuid, text, text, text, uuid, text, jsonb, text) from anon, authenticated;
grant execute on function sara_create_routine(uuid, text, text, text, uuid, text, jsonb, text) to service_role;

-- 8. RPC: sara_list_routines
create or replace function sara_list_routines(
  p_status text default null,
  p_limit int default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routines jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'slug', r.slug,
      'description', r.description,
      'status', r.status,
      'area_id', r.area_id,
      'objective_id', r.objective_id,
      'schedule', r.schedule,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'activated_at', r.activated_at,
      'paused_at', r.paused_at,
      'archived_at', r.archived_at,
      'steps', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'position', s.position,
            'time_of_day', s.time_of_day,
            'title', s.title,
            'description', s.description,
            'duration_minutes', s.duration_minutes,
            'created_at', s.created_at,
            'updated_at', s.updated_at
          ) order by s.position
        ), '[]'::jsonb)
        from sara_routine_steps s
        where s.routine_id = r.id
      )
    )
    order by r.name
  ) into v_routines
  from sara_routines r
  where (
    (p_status is null and r.status != 'archived')
    or r.status = p_status
  )
  limit p_limit;

  return jsonb_build_object(
    'routines', coalesce(v_routines, '[]'::jsonb),
    'count', (
      select count(*)
      from sara_routines
      where (
        (p_status is null and status != 'archived')
        or status = p_status
      )
    ),
    'status', 'success'
  );
end;
$$;

revoke execute on function sara_list_routines(text, int) from anon, authenticated;
grant execute on function sara_list_routines(text, int) to service_role;

-- 9. RPC: sara_activate_routine
create or replace function sara_activate_routine(
  p_trace_id uuid,
  p_routine_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routine record;
  v_event_id uuid;
begin
  -- Find routine by id or slug
  if p_routine_id is not null then
    select * into v_routine from sara_routines where id = p_routine_id;
  elsif p_slug is not null then
    select * into v_routine from sara_routines where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'routine id or slug required'
    );
  end if;

  if v_routine is null then
    return jsonb_build_object(
      'error', 'routine not found'
    );
  end if;

  -- Validate not already active
  if v_routine.status = 'active' then
    return jsonb_build_object(
      'error', 'routine is already active'
    );
  end if;

  -- Mark as active
  update sara_routines
  set status = 'active', activated_at = now(), paused_at = null, updated_at = now()
  where id = v_routine.id;

  -- Emit routine_activated event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'routine_activated',
    'routine',
    v_routine.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_routine.name,
      'slug', v_routine.slug,
      'previous_status', v_routine.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'routine_id', v_routine.id,
    'event_id', v_event_id,
    'name', v_routine.name,
    'slug', v_routine.slug,
    'trace_id', p_trace_id,
    'schema_version', 'routines_activate_result.v1'
  );
end;
$$;

revoke execute on function sara_activate_routine(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_activate_routine(uuid, uuid, text, text) to service_role;

-- 10. RPC: sara_pause_routine
create or replace function sara_pause_routine(
  p_trace_id uuid,
  p_routine_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routine record;
  v_event_id uuid;
begin
  -- Find routine by id or slug
  if p_routine_id is not null then
    select * into v_routine from sara_routines where id = p_routine_id;
  elsif p_slug is not null then
    select * into v_routine from sara_routines where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'routine id or slug required'
    );
  end if;

  if v_routine is null then
    return jsonb_build_object(
      'error', 'routine not found'
    );
  end if;

  -- Validate active
  if v_routine.status != 'active' then
    return jsonb_build_object(
      'error', 'only active routines can be paused'
    );
  end if;

  -- Mark as paused
  update sara_routines
  set status = 'paused', paused_at = now(), updated_at = now()
  where id = v_routine.id;

  -- Emit routine_paused event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'routine_paused',
    'routine',
    v_routine.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_routine.name,
      'slug', v_routine.slug,
      'previous_status', v_routine.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'routine_id', v_routine.id,
    'event_id', v_event_id,
    'name', v_routine.name,
    'slug', v_routine.slug,
    'trace_id', p_trace_id,
    'schema_version', 'routines_pause_result.v1'
  );
end;
$$;

revoke execute on function sara_pause_routine(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_pause_routine(uuid, uuid, text, text) to service_role;

-- 11. RPC: sara_archive_routine
create or replace function sara_archive_routine(
  p_trace_id uuid,
  p_routine_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routine record;
  v_event_id uuid;
begin
  -- Find routine by id or slug
  if p_routine_id is not null then
    select * into v_routine from sara_routines where id = p_routine_id;
  elsif p_slug is not null then
    select * into v_routine from sara_routines where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'routine id or slug required'
    );
  end if;

  if v_routine is null then
    return jsonb_build_object(
      'error', 'routine not found'
    );
  end if;

  -- Mark as archived
  update sara_routines
  set status = 'archived', archived_at = now(), activated_at = null, paused_at = null, updated_at = now()
  where id = v_routine.id;

  -- Emit routine_archived event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'routine_archived',
    'routine',
    v_routine.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'name', v_routine.name,
      'slug', v_routine.slug,
      'previous_status', v_routine.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'routine_id', v_routine.id,
    'event_id', v_event_id,
    'name', v_routine.name,
    'slug', v_routine.slug,
    'trace_id', p_trace_id,
    'schema_version', 'routines_archive_result.v1'
  );
end;
$$;

revoke execute on function sara_archive_routine(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_archive_routine(uuid, uuid, text, text) to service_role;

commit;
