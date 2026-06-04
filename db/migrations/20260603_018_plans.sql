-- TASK-20260603-018: plans MVP
-- Create sara_plans and sara_plan_steps tables, RPCs, and events
-- Only touches objects with sara_ prefix

begin;

-- 1. sara_plans entity definition
create table if not exists sara_plans (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'plans_create_input.v1',
  objective_id uuid,
  title text not null,
  slug text not null,
  status text not null default 'active',
  description text,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint sara_plans_title_not_empty check (length(trim(title)) > 0),
  constraint sara_plans_slug_not_empty check (length(trim(slug)) > 0),
  constraint sara_plans_slug_unique unique (slug),
  constraint sara_plans_status_valid check (status in ('active', 'archived')),
  constraint sara_plans_archived_at_requires_archived
    check (archived_at is null or status = 'archived')
);

-- 2. sara_plan_steps entity definition
create table if not exists sara_plan_steps (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'plan_step.v1',
  plan_id uuid not null,
  position integer not null,
  title text not null,
  status text not null default 'pending',
  task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint sara_plan_steps_plan_id_fk
    foreign key (plan_id) references sara_plans(id) on delete cascade,
  constraint sara_plan_steps_title_not_empty check (length(trim(title)) > 0),
  constraint sara_plan_steps_position_positive check (position > 0),
  constraint sara_plan_steps_status_valid check (status in ('pending', 'completed')),
  constraint sara_plan_steps_completed_at_requires_completed
    check (completed_at is null or status = 'completed')
);

-- 3. Enable RLS on both tables
alter table sara_plans enable row level security;
alter table sara_plan_steps enable row level security;

-- 4. Revoke access to anon and authenticated
revoke all on table sara_plans from anon, authenticated;
grant all on table sara_plans to service_role;

revoke all on table sara_plan_steps from anon, authenticated;
grant all on table sara_plan_steps to service_role;

-- 5. RPC: sara_create_plan
create or replace function sara_create_plan(
  p_trace_id uuid,
  p_title text,
  p_slug text,
  p_description text default null,
  p_objective_id uuid default null,
  p_steps jsonb default '[]'::jsonb,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_event_id uuid;
  v_title text;
  v_slug text;
  v_step jsonb;
  v_step_id uuid;
  v_step_event_id uuid;
  v_step_titles text[] := array[]::text[];
  v_position int := 0;
begin
  -- Validate title not empty
  if length(trim(p_title)) = 0 then
    return jsonb_build_object(
      'error', 'plan title cannot be empty'
    );
  end if;

  -- Validate slug not empty
  if length(trim(p_slug)) = 0 then
    return jsonb_build_object(
      'error', 'plan slug cannot be empty'
    );
  end if;

  -- Check for existing active plan with same slug
  if exists (
    select 1 from sara_plans
    where slug = p_slug
      and status = 'active'
  ) then
    return jsonb_build_object(
      'error', 'plan with slug "' || p_slug || '" already exists as active'
    );
  end if;

  -- Insert plan
  insert into sara_plans (title, slug, description, objective_id, status, trace_id, schema_version)
  values (trim(p_title), trim(p_slug), p_description, p_objective_id, 'active', p_trace_id, 'plans_create_input.v1')
  returning id, title, slug into v_plan_id, v_title, v_slug;

  -- Emit plan_created event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'plan_created',
    'plan',
    v_plan_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'title', v_title,
      'slug', v_slug,
      'description', p_description,
      'objective_id', p_objective_id,
      'status', 'active'
    )
  )
  returning id into v_event_id;

  -- Insert plan steps
  if jsonb_typeof(p_steps) = 'array' then
    for v_step in select * from jsonb_array_elements(p_steps)
    loop
      v_position := v_position + 1;
      insert into sara_plan_steps (plan_id, position, title, status, schema_version)
      values (v_plan_id, v_position, trim(v_step->>'title'), 'pending', 'plan_step.v1')
      returning id into v_step_id;

      -- Emit plan_step_created event
      insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
      values (
        'sara_events.v1',
        'plan_step_created',
        'plan_step',
        v_step_id,
        p_trace_id,
        p_source,
        jsonb_build_object(
          'plan_id', v_plan_id,
          'position', v_position,
          'title', trim(v_step->>'title'),
          'status', 'pending'
        )
      )
      returning id into v_step_event_id;

      v_step_titles := array_append(v_step_titles, trim(v_step->>'title'));
    end loop;
  end if;

  -- Update updated_at
  update sara_plans set updated_at = now() where id = v_plan_id;

  return jsonb_build_object(
    'plan_id', v_plan_id,
    'event_id', v_event_id,
    'title', v_title,
    'slug', v_slug,
    'objective_id', p_objective_id,
    'step_titles', v_step_titles,
    'trace_id', p_trace_id,
    'schema_version', 'plans_create_result.v1'
  );
end;
$$;

revoke execute on function sara_create_plan(uuid, text, text, text, uuid, jsonb, text) from anon, authenticated;
grant execute on function sara_create_plan(uuid, text, text, text, uuid, jsonb, text) to service_role;

-- 6. RPC: sara_list_plans
create or replace function sara_list_plans(
  p_trace_id uuid,
  p_status text default 'active',
  p_limit int default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plans jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'schema_version', p.schema_version,
      'objective_id', p.objective_id,
      'title', p.title,
      'slug', p.slug,
      'status', p.status,
      'description', p.description,
      'trace_id', p.trace_id,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'archived_at', p.archived_at,
      'steps', coalesce(steps_data.steps, '[]'::jsonb)
    )
    order by p.created_at desc
  )
  into v_plans
  from sara_plans p
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'position', s.position,
        'title', s.title,
        'status', s.status,
        'task_id', s.task_id,
        'created_at', s.created_at,
        'updated_at', s.updated_at,
        'completed_at', s.completed_at
      )
      order by s.position asc
    ) as steps
    from sara_plan_steps s
    where s.plan_id = p.id
  ) steps_data on true
  where p.status = p_status
  limit p_limit;

  return jsonb_build_object(
    'plans', coalesce(v_plans, '[]'::jsonb),
    'count', (select count(*) from sara_plans where status = p_status),
    'trace_id', p_trace_id,
    'schema_version', 'plans_list_result.v1'
  );
end;
$$;

revoke execute on function sara_list_plans(uuid, text, int) from anon, authenticated;
grant execute on function sara_list_plans(uuid, text, int) to service_role;

-- 7. RPC: sara_archive_plan
create or replace function sara_archive_plan(
  p_trace_id uuid,
  p_plan_id uuid default null,
  p_slug text default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_event_id uuid;
begin
  -- Find plan by id or slug
  if p_plan_id is not null then
    select * into v_plan from sara_plans where id = p_plan_id;
  elsif p_slug is not null then
    select * into v_plan from sara_plans where slug = p_slug;
  else
    return jsonb_build_object(
      'error', 'plan id or slug required'
    );
  end if;

  if v_plan is null then
    return jsonb_build_object(
      'error', 'plan not found'
    );
  end if;

  -- Validate not already archived
  if v_plan.status = 'archived' then
    return jsonb_build_object(
      'error', 'plan is already archived'
    );
  end if;

  -- Mark as archived
  update sara_plans
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = v_plan.id;

  -- Emit plan_archived event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'plan_archived',
    'plan',
    v_plan.id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'title', v_plan.title,
      'slug', v_plan.slug,
      'previous_status', v_plan.status
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'plan_id', v_plan.id,
    'event_id', v_event_id,
    'title', v_plan.title,
    'slug', v_plan.slug,
    'trace_id', p_trace_id,
    'schema_version', 'plans_archive_result.v1'
  );
end;
$$;

revoke execute on function sara_archive_plan(uuid, uuid, text, text) from anon, authenticated;
grant execute on function sara_archive_plan(uuid, uuid, text, text) to service_role;

-- 8. RPC: sara_complete_plan_step
create or replace function sara_complete_plan_step(
  p_trace_id uuid,
  p_step_id uuid default null,
  p_plan_slug text default null,
  p_step_position int default null,
  p_source text default 'chatwoot'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step record;
  v_step_id uuid;
  v_event_id uuid;
begin
  -- Resolve step: by step_id, or by plan_slug + position
  if p_step_id is not null then
    select * into v_step from sara_plan_steps where id = p_step_id;
  elsif p_plan_slug is not null and p_step_position is not null then
    select ps.* into v_step
    from sara_plan_steps ps
    join sara_plans p on p.id = ps.plan_id
    where p.slug = p_plan_slug
      and ps.position = p_step_position;
  else
    return jsonb_build_object(
      'error', 'step_id or (plan_slug + step_position) required'
    );
  end if;

  if v_step is null then
    return jsonb_build_object(
      'error', 'plan step not found'
    );
  end if;

  -- Validate not already completed
  if v_step.status = 'completed' then
    return jsonb_build_object(
      'error', 'plan step is already completed'
    );
  end if;

  -- Mark as completed
  update sara_plan_steps
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = v_step.id
  returning id into v_step_id;

  -- Emit plan_step_completed event
  insert into sara_events (schema_version, event_type, entity_type, entity_id, trace_id, source, payload)
  values (
    'sara_events.v1',
    'plan_step_completed',
    'plan_step',
    v_step_id,
    p_trace_id,
    p_source,
    jsonb_build_object(
      'plan_id', v_step.plan_id,
      'position', v_step.position,
      'title', v_step.title
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'step_id', v_step_id,
    'event_id', v_event_id,
    'plan_id', v_step.plan_id,
    'position', v_step.position,
    'title', v_step.title,
    'trace_id', p_trace_id,
    'schema_version', 'plans_complete_step_result.v1'
  );
end;
$$;

revoke execute on function sara_complete_plan_step(uuid, uuid, text, int, text) from anon, authenticated;
grant execute on function sara_complete_plan_step(uuid, uuid, text, int, text) to service_role;

commit;
