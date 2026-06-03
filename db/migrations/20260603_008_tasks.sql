begin;

create table if not exists sara_tasks (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  title text not null,
  description text,
  status text not null,
  source text not null,
  area_id uuid,
  due_at timestamptz,
  completed_at timestamptz,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sara_tasks_title_check check (title <> ''),
  constraint sara_tasks_status_check check (status in ('pending', 'completed'))
);

create or replace function sara_create_task(
  p_trace_id uuid,
  p_title text,
  p_description text default null,
  p_source text default 'chatwoot',
  p_area_id uuid default null,
  p_due_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
  v_event_id uuid;
begin
  if p_title is null or trim(p_title) = '' then
    raise exception 'title cannot be empty';
  end if;

  insert into sara_tasks (
    schema_version, title, description, status, source, area_id, due_at, trace_id
  ) values (
    'tasks.v1', trim(p_title), p_description, 'pending', p_source, p_area_id, p_due_at, p_trace_id
  ) returning id into v_task_id;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', 'task_created', 'task', v_task_id, p_trace_id, p_source,
    jsonb_build_object(
      'task_id', v_task_id,
      'title', trim(p_title),
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'task_id', v_task_id,
    'event_id', v_event_id,
    'trace_id', p_trace_id,
    'schema_version', 'tasks_create_result.v1'
  );
end;
$$;

create or replace function sara_complete_task(
  p_trace_id uuid,
  p_task_id uuid default null,
  p_title_match text default null,
  p_position int default null,
  p_source text default 'chatwoot'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
  v_event_id uuid;
  v_title text;
  v_match_count integer;
begin
  if p_task_id is not null then
    select id, title into v_task_id, v_title
    from sara_tasks
    where id = p_task_id and status = 'pending';
  elsif p_title_match is not null then
    select count(*) into v_match_count
    from sara_tasks
    where status = 'pending' and lower(title) like lower('%' || trim(p_title_match) || '%');

    if v_match_count > 1 then
      raise exception 'multiple matching pending tasks found';
    end if;

    if v_match_count = 1 then
      select id, title into v_task_id, v_title
      from sara_tasks
      where status = 'pending' and lower(title) like lower('%' || trim(p_title_match) || '%')
      order by created_at desc
      limit 1;
    end if;
  elsif p_position is not null and p_position > 0 then
    select id, title into v_task_id, v_title
    from (
      select id, title, row_number() over (order by created_at desc) as rn
      from sara_tasks
      where status = 'pending'
    ) sub
    where sub.rn = p_position;
  end if;

  if v_task_id is null then
    raise exception 'no matching pending task found';
  end if;

  update sara_tasks
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = v_task_id;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', 'task_completed', 'task', v_task_id, p_trace_id, p_source,
    jsonb_build_object(
      'task_id', v_task_id,
      'title', v_title,
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'task_id', v_task_id,
    'event_id', v_event_id,
    'title', v_title,
    'trace_id', p_trace_id,
    'schema_version', 'tasks_complete_result.v1'
  );
end;
$$;

create index if not exists sara_tasks_status_idx on sara_tasks (status, created_at desc);
create index if not exists sara_tasks_trace_idx on sara_tasks (trace_id);

alter table sara_tasks enable row level security;

revoke all on sara_tasks from anon, authenticated;

revoke execute on function sara_create_task(uuid, text, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function sara_create_task(uuid, text, text, text, uuid, timestamptz) to service_role;

revoke execute on function sara_complete_task(uuid, uuid, text, int, text) from public, anon, authenticated;
grant execute on function sara_complete_task(uuid, uuid, text, int, text) to service_role;

commit;
