begin;

create table if not exists sara_events (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  trace_id uuid,
  source text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sara_notes (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  note_type text not null,
  content text not null,
  source text not null,
  area_id uuid,
  related_entity_type text,
  related_entity_id uuid,
  tags jsonb not null default '[]'::jsonb,
  trace_id uuid,
  created_at timestamptz not null default now(),
  constraint sara_notes_content_check check (content <> ''),
  constraint sara_notes_note_type_check check (
    note_type in ('aprendizaje', 'idea', 'problema', 'riesgo', 'mejora', 'observacion')
  ),
  constraint sara_notes_entity_check check (
    related_entity_id is null or related_entity_type is not null
  )
);

create or replace function sara_create_note(
  p_trace_id uuid,
  p_content text,
  p_note_type text default 'observacion',
  p_source text default 'chatwoot',
  p_area_id uuid default null,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_tags jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note_id uuid;
  v_event_id uuid;
begin
  if p_content is null or trim(p_content) = '' then
    raise exception 'content cannot be empty';
  end if;

  if p_note_type not in ('aprendizaje', 'idea', 'problema', 'riesgo', 'mejora', 'observacion') then
    raise exception 'invalid note_type: %', p_note_type;
  end if;

  if p_related_entity_id is not null and p_related_entity_type is null then
    raise exception 'related_entity_type is required when related_entity_id is provided';
  end if;

  insert into sara_notes (
    schema_version, note_type, content, source, area_id,
    related_entity_type, related_entity_id, tags, trace_id
  ) values (
    'notes.v1', p_note_type, trim(p_content), p_source, p_area_id,
    p_related_entity_type, p_related_entity_id, p_tags, p_trace_id
  ) returning id into v_note_id;

  insert into sara_events (
    schema_version, event_type, entity_type, entity_id, trace_id, source, payload
  ) values (
    'event.v1', 'note_created', 'note', v_note_id, p_trace_id, p_source,
    jsonb_build_object(
      'note_id', v_note_id,
      'note_type', p_note_type,
      'source', p_source
    )
  ) returning id into v_event_id;

  return jsonb_build_object(
    'note_id', v_note_id,
    'event_id', v_event_id,
    'trace_id', p_trace_id,
    'schema_version', 'notes_create_result.v1'
  );
end;
$$;

create index if not exists sara_events_entity_idx on sara_events (entity_type, entity_id);
create index if not exists sara_events_trace_idx on sara_events (trace_id);
create index if not exists sara_notes_trace_idx on sara_notes (trace_id);

alter table sara_events enable row level security;
alter table sara_notes enable row level security;

revoke all on sara_events from anon, authenticated;
revoke all on sara_notes from anon, authenticated;

revoke execute on function sara_create_note(uuid, text, text, text, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function sara_create_note(uuid, text, text, text, uuid, text, uuid, jsonb) to service_role;

commit;
