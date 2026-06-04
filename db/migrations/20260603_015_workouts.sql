-- TASK-20260603-015: workouts MVP
-- Create sara_workout_sessions and sara_workout_sets tables, RPCs, and events
-- Only touches objects with sara_ prefix

begin;

-- 1. sara_workout_sessions entity definition
create table if not exists sara_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  title text,
  status text not null default 'active',
  routine_id uuid,
  area_id uuid,
  objective_id uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sara_workout_sessions_status_valid check (status in ('active', 'finished', 'canceled'))
);

-- 2. sara_workout_sets entity definition
create table if not exists sara_workout_sets (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  session_id uuid not null references sara_workout_sessions(id),
  exercise_name text not null,
  set_number integer not null,
  target_reps integer,
  actual_reps integer,
  weight_kg numeric,
  duration_seconds integer,
  rest_seconds integer,
  notes text,
  trace_id uuid,
  created_at timestamptz not null default now(),

  constraint sara_workout_sets_exercise_not_empty check (length(trim(exercise_name)) > 0),
  constraint sara_workout_sets_set_number_positive check (set_number > 0),
  constraint sara_workout_sets_effort_check check (actual_reps is not null or duration_seconds is not null)
);

-- 3. Enable RLS
alter table sara_workout_sessions enable row level security;
alter table sara_workout_sets enable row level security;

-- 4. Revoke access to anon and authenticated
revoke all on table sara_workout_sessions from anon, authenticated;
grant all on table sara_workout_sessions to service_role;

revoke all on table sara_workout_sets from anon, authenticated;
grant all on table sara_workout_sets to service_role;

-- 5. RPC: sara_start_workout_session
create or replace function sara_start_workout_session(
  p_trace_id uuid,
  p_title text default null,
  p_routine_id uuid default null,
  p_area_id uuid default null,
  p_objective_id uuid default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_title text;
begin
  -- Check for existing active session
  if exists (select 1 from sara_workout_sessions where status = 'active') then
    return jsonb_build_object(
      'error', 'there is already an active workout session'
    );
  end if;

  -- Normalize title
  v_title := nullif(trim(p_title), '');

  -- Insert session
  insert into sara_workout_sessions (title, status, routine_id, area_id, objective_id, trace_id, schema_version)
  values (v_title, 'active', p_routine_id, p_area_id, p_objective_id, p_trace_id, 'workouts_session.v1')
  returning id into v_session_id;

  -- Emit workout_session_started event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'workout_session_started',
    'workout_session',
    v_session_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'title', v_title,
      'status', 'active'
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id,
    'title', v_title,
    'trace_id', p_trace_id,
    'schema_version', 'workouts_start_result.v1'
  );
end;
$$;

revoke execute on function sara_start_workout_session(uuid, text, uuid, uuid, uuid, text) from anon, authenticated;
grant execute on function sara_start_workout_session(uuid, text, uuid, uuid, uuid, text) to service_role;

-- 6. RPC: sara_log_workout_set
create or replace function sara_log_workout_set(
  p_trace_id uuid,
  p_session_id uuid,
  p_exercise_name text,
  p_set_number integer,
  p_target_reps integer default null,
  p_actual_reps integer default null,
  p_weight_kg numeric default null,
  p_duration_seconds integer default null,
  p_rest_seconds integer default null,
  p_notes text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_set_id uuid;
  v_event_id uuid;
begin
  -- Validate session exists and is active
  select * into v_session from sara_workout_sessions where id = p_session_id and status = 'active';
  if v_session is null then
    return jsonb_build_object(
      'error', 'active workout session not found'
    );
  end if;

  -- Validate exercise name
  if length(trim(p_exercise_name)) = 0 then
    return jsonb_build_object(
      'error', 'exercise name cannot be empty'
    );
  end if;

  -- Validate set number
  if p_set_number <= 0 then
    return jsonb_build_object(
      'error', 'set number must be positive'
    );
  end if;

  -- Validate effort: at least actual_reps or duration_seconds
  if p_actual_reps is null and p_duration_seconds is null then
    return jsonb_build_object(
      'error', 'either actual_reps or duration_seconds must be provided'
    );
  end if;

  -- Insert set
  insert into sara_workout_sets (session_id, exercise_name, set_number, target_reps, actual_reps, weight_kg, duration_seconds, rest_seconds, notes, trace_id, schema_version)
  values (p_session_id, trim(p_exercise_name), p_set_number, p_target_reps, p_actual_reps, p_weight_kg, p_duration_seconds, p_rest_seconds, p_notes, p_trace_id, 'workouts_set.v1')
  returning id into v_set_id;

  -- Emit workout_set_logged event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'workout_set_logged',
    'workout_set',
    v_set_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'session_id', p_session_id,
      'exercise_name', trim(p_exercise_name),
      'set_number', p_set_number,
      'target_reps', p_target_reps,
      'actual_reps', p_actual_reps,
      'weight_kg', p_weight_kg,
      'duration_seconds', p_duration_seconds,
      'rest_seconds', p_rest_seconds
    )
  )
  returning id into v_event_id;

  -- Update updated_at on session
  update sara_workout_sessions set updated_at = now() where id = p_session_id;

  return jsonb_build_object(
    'set_id', v_set_id,
    'event_id', v_event_id,
    'session_id', p_session_id,
    'exercise_name', trim(p_exercise_name),
    'set_number', p_set_number,
    'trace_id', p_trace_id,
    'schema_version', 'workouts_set_result.v1'
  );
end;
$$;

revoke execute on function sara_log_workout_set(uuid, uuid, text, integer, integer, integer, numeric, integer, integer, text, text) from anon, authenticated;
grant execute on function sara_log_workout_set(uuid, uuid, text, integer, integer, integer, numeric, integer, integer, text, text) to service_role;

-- 7. RPC: sara_finish_workout_session
create or replace function sara_finish_workout_session(
  p_trace_id uuid,
  p_session_id uuid default null,
  p_notes text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_event_id uuid;
  v_set_count integer;
begin
  -- Find active session
  if p_session_id is not null then
    select * into v_session from sara_workout_sessions where id = p_session_id and status = 'active';
  else
    select * into v_session from sara_workout_sessions where status = 'active' order by started_at desc limit 1;
  end if;

  if v_session is null then
    return jsonb_build_object(
      'error', 'no active workout session found'
    );
  end if;

  -- Count sets
  select count(*) into v_set_count from sara_workout_sets where session_id = v_session.id;

  -- Finish session
  update sara_workout_sessions
  set status = 'finished', finished_at = now(), notes = coalesce(p_notes, notes), updated_at = now()
  where id = v_session.id;

  -- Emit workout_session_finished event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'workout_session_finished',
    'workout_session',
    v_session.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'title', v_session.title,
      'set_count', v_set_count,
      'started_at', v_session.started_at,
      'finished_at', now(),
      'previous_status', 'active'
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'event_id', v_event_id,
    'title', v_session.title,
    'set_count', v_set_count,
    'trace_id', p_trace_id,
    'schema_version', 'workouts_finish_result.v1'
  );
end;
$$;

revoke execute on function sara_finish_workout_session(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_finish_workout_session(uuid, uuid, text, text) to service_role;

-- 8. RPC: sara_cancel_workout_session
create or replace function sara_cancel_workout_session(
  p_trace_id uuid,
  p_session_id uuid default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_event_id uuid;
begin
  -- Find active session
  if p_session_id is not null then
    select * into v_session from sara_workout_sessions where id = p_session_id and status = 'active';
  else
    select * into v_session from sara_workout_sessions where status = 'active' order by started_at desc limit 1;
  end if;

  if v_session is null then
    return jsonb_build_object(
      'error', 'no active workout session found'
    );
  end if;

  -- Cancel session
  update sara_workout_sessions
  set status = 'canceled', finished_at = now(), updated_at = now()
  where id = v_session.id;

  -- Emit workout_session_canceled event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'workout_session_canceled',
    'workout_session',
    v_session.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'title', v_session.title,
      'started_at', v_session.started_at,
      'finished_at', now(),
      'previous_status', 'active'
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'event_id', v_event_id,
    'title', v_session.title,
    'trace_id', p_trace_id,
    'schema_version', 'workouts_cancel_result.v1'
  );
end;
$$;

revoke execute on function sara_cancel_workout_session(uuid, uuid, text) from anon, authenticated;
grant execute on function sara_cancel_workout_session(uuid, uuid, text) to service_role;

-- 9. RPC: sara_list_workout_sessions
create or replace function sara_list_workout_sessions(
  p_trace_id uuid,
  p_status text default null,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessions jsonb;
begin
  select jsonb_agg(row_to_json(s))
  into v_sessions
  from (
    select
      ws.id,
      ws.schema_version,
      ws.title,
      ws.status,
      ws.routine_id,
      ws.area_id,
      ws.objective_id,
      ws.started_at,
      ws.finished_at,
      ws.notes,
      ws.trace_id,
      ws.created_at,
      ws.updated_at,
      coalesce((select count(*) from sara_workout_sets wst where wst.session_id = ws.id), 0) as set_count
    from sara_workout_sessions ws
    where (p_status is null or ws.status = p_status)
    order by ws.created_at desc
    limit greatest(coalesce(p_limit, 10), 1)
  ) s;

  return jsonb_build_object(
    'sessions', coalesce(v_sessions, '[]'::jsonb),
    'count', (select count(*) from sara_workout_sessions where (p_status is null or status = p_status)),
    'trace_id', p_trace_id,
    'schema_version', 'workouts_list_result.v1'
  );
end;
$$;

revoke execute on function sara_list_workout_sessions(uuid, text, integer) from anon, authenticated;
grant execute on function sara_list_workout_sessions(uuid, text, integer) to service_role;

commit;
