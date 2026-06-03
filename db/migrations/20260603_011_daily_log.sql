begin;

create table if not exists sara_daily_log (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  date date not null,
  wake_energy integer,
  sleep_hours numeric,
  morning_intention text,
  evening_review text,
  mood text,
  notes jsonb not null default '[]'::jsonb,
  trace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sara_daily_log_date_unique unique (date),
  constraint sara_daily_log_wake_energy_check check (wake_energy is null or (wake_energy >= 1 and wake_energy <= 10)),
  constraint sara_daily_log_sleep_hours_check check (sleep_hours is null or sleep_hours >= 0)
);

create or replace function sara_upsert_daily_log_morning(
  p_trace_id uuid,
  p_date date,
  p_wake_energy int,
  p_sleep_hours numeric,
  p_morning_intention text,
  p_mood text,
  p_notes jsonb,
  p_source text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_event_id uuid;
  v_is_new boolean := false;
  v_event_type text;
begin
  if p_wake_energy is not null and (p_wake_energy < 1 or p_wake_energy > 10) then
    raise exception 'wake_energy must be between 1 and 10';
  end if;

  if p_sleep_hours is not null and p_sleep_hours < 0 then
    raise exception 'sleep_hours cannot be negative';
  end if;

  select id into v_log_id from sara_daily_log where date = p_date;

  if v_log_id is null then
    v_is_new := true;
    insert into sara_daily_log (
      schema_version, date, wake_energy, sleep_hours, morning_intention, mood, notes, trace_id
    ) values (
      'daily_log.v1', p_date, p_wake_energy, p_sleep_hours, p_morning_intention, p_mood, coalesce(p_notes, '[]'::jsonb), p_trace_id
    ) returning id into v_log_id;
  else
    update sara_daily_log
    set
      wake_energy = coalesce(p_wake_energy, wake_energy),
      sleep_hours = coalesce(p_sleep_hours, sleep_hours),
      morning_intention = coalesce(p_morning_intention, morning_intention),
      mood = coalesce(p_mood, mood),
      notes = notes || coalesce(p_notes, '[]'::jsonb),
      trace_id = p_trace_id,
      updated_at = now()
    where id = v_log_id;
  end if;

  if v_is_new then
    v_event_type := 'daily_log_created';
  else
    v_event_type := 'daily_log_morning_updated';
  end if;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', v_event_type, 'daily_log', v_log_id, p_trace_id, p_source,
    jsonb_build_object(
      'daily_log_id', v_log_id,
      'date', p_date,
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'daily_log_id', v_log_id,
    'event_id', v_event_id,
    'event_type', v_event_type,
    'date', p_date,
    'trace_id', p_trace_id,
    'schema_version', 'daily_log_morning_result.v1'
  );
end;
$$;

create or replace function sara_upsert_daily_log_evening(
  p_trace_id uuid,
  p_date date,
  p_evening_review text,
  p_mood text,
  p_notes jsonb,
  p_source text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_event_id uuid;
  v_is_new boolean := false;
  v_event_type text;
begin
  select id into v_log_id from sara_daily_log where date = p_date;

  if v_log_id is null then
    v_is_new := true;
    insert into sara_daily_log (
      schema_version, date, evening_review, mood, notes, trace_id
    ) values (
      'daily_log.v1', p_date, p_evening_review, p_mood, coalesce(p_notes, '[]'::jsonb), p_trace_id
    ) returning id into v_log_id;
  else
    update sara_daily_log
    set
      evening_review = coalesce(p_evening_review, evening_review),
      mood = coalesce(p_mood, mood),
      notes = notes || coalesce(p_notes, '[]'::jsonb),
      trace_id = p_trace_id,
      updated_at = now()
    where id = v_log_id;
  end if;

  if v_is_new then
    v_event_type := 'daily_log_created';
  else
    v_event_type := 'daily_log_evening_updated';
  end if;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', v_event_type, 'daily_log', v_log_id, p_trace_id, p_source,
    jsonb_build_object(
      'daily_log_id', v_log_id,
      'date', p_date,
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'daily_log_id', v_log_id,
    'event_id', v_event_id,
    'event_type', v_event_type,
    'date', p_date,
    'trace_id', p_trace_id,
    'schema_version', 'daily_log_evening_result.v1'
  );
end;
$$;

create index if not exists sara_daily_log_date_idx on sara_daily_log (date);
create index if not exists sara_daily_log_trace_idx on sara_daily_log (trace_id);

alter table sara_daily_log enable row level security;

revoke all on sara_daily_log from anon, authenticated;

revoke execute on function sara_upsert_daily_log_morning(uuid, date, int, numeric, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function sara_upsert_daily_log_morning(uuid, date, int, numeric, text, text, jsonb, text) to service_role;

revoke execute on function sara_upsert_daily_log_evening(uuid, date, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function sara_upsert_daily_log_evening(uuid, date, text, text, jsonb, text) to service_role;

commit;
