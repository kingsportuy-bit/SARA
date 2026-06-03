# ENTITY_CATALOG.md - SARA

Estado: FASE A MINIMA + TASKS MVP + SESSION CONTEXT MVP
Fecha: 2026-06-03

## Objetivo
Definir las entidades minimas que deben existir antes de entregar la primera task a opencode.

Este catalogo evita que los agentes inventen nombres, campos o relaciones durante la implementacion.

## Reglas
- Todas las tablas deben usar prefijo `sara_`.
- Ningun campo agregado de progreso puede actualizarse por fuera del writer canonico.
- Todo cambio importante de estado debe emitir un evento en `sara_events`.
- Toda tabla de trazabilidad debe incluir `schema_version`.
- Los datos efimeros viven en `sara_session_contexts`; los datos permanentes viven en tablas de dominio.

## 1. `sara_events`

### Proposito
Registro canonico de cambios relevantes del sistema.

### Owner
`canonical-state-writer`

### Campos
- `id uuid primary key`
- `schema_version text not null`
- `event_type text not null`
- `entity_type text not null`
- `entity_id uuid`
- `trace_id uuid`
- `source text not null`
- `payload jsonb not null`
- `created_at timestamptz not null`

### Invariantes
- `schema_version` es obligatorio.
- `event_type` debe ser estable y versionable.
- `payload` no reemplaza campos de busqueda basicos.
- Ningun modulo escribe eventos directamente; debe pasar por writer canonico.

### Eventos que emite
`sara_events` no emite eventos; registra eventos de otros modulos.

## 2. `sara_session_contexts`
Estado: AUTORIZADA PARA TASK-20260603-009


### Proposito
Guardar contexto conversacional efimero para resolver referencias, confirmaciones y flujos activos.

### Owner
`session-context`

### Campos
- `id uuid primary key`
- `schema_version text not null`
- `account_id bigint not null`
- `inbox_id bigint not null`
- `conversation_id bigint not null`
- `active_module text`
- `active_flow text`
- `focused_entity_type text`
- `focused_entity_id uuid`
- `awaiting_confirmation boolean not null`
- `confirmation_payload jsonb`
- `context jsonb not null`
- `expires_at timestamptz`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### Invariantes
- Debe existir como maximo un contexto activo por `account_id`, `inbox_id`, `conversation_id`.
- No es fuente canonica de verdad.
- Todo contexto pendiente de confirmacion debe tener `confirmation_payload`.
- Las confirmaciones viejas deben expirar.

### Eventos que emite
- `session_context_started`
- `session_context_updated`
- `session_context_cleared`
- `confirmation_requested`
- `confirmation_resolved`

## 3. `sara_daily_log`

### Proposito
Representar el dia operativo como unidad de analisis.

### Owner
`daily-log`

### Campos
- `id uuid primary key`
- `schema_version text not null`
- `date date not null`
- `wake_energy integer`
- `sleep_hours numeric`
- `morning_intention text`
- `evening_review text`
- `mood text`
- `notes jsonb not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### Invariantes
- Debe existir como maximo un daily log por `date`.
- `wake_energy`, si existe, debe estar en rango 1 a 10.
- `sleep_hours`, si existe, no puede ser negativo.
- No debe calcular metricas complejas; solo registrar datos del dia.

### Eventos que emite
- `daily_log_created`
- `daily_log_morning_updated`
- `daily_log_evening_updated`

## 4. `sara_areas`

### Proposito
Agrupar planes, notas, tareas y objetivos por area de vida o negocio.

### Owner
`areas`

### Campos
- `id uuid primary key`
- `schema_version text not null`
- `name text not null`
- `slug text not null`
- `description text`
- `status text not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### Estados
- `active`
- `paused`
- `archived`

### Invariantes
- `slug` debe ser unico.
- `status` debe estar dentro de los estados permitidos.
- Un area archivada no debe recibir nuevas entidades salvo reactivacion explicita.

### Eventos que emite
- `area_created`
- `area_updated`
- `area_archived`
- `area_reactivated`

## 5. `sara_notes`

### Proposito
Capturar conocimiento, observaciones, riesgos, ideas y aprendizajes.

### Owner
`notes`

### Campos
- `id uuid primary key`
- `schema_version text not null`
- `area_id uuid`
- `note_type text not null`
- `content text not null`
- `source text not null`
- `related_entity_type text`
- `related_entity_id uuid`
- `tags jsonb not null`
- `trace_id uuid`
- `created_at timestamptz not null`

### Tipos
- `aprendizaje`
- `idea`
- `problema`
- `riesgo`
- `mejora`
- `observacion`

### Invariantes
- `content` no puede estar vacio.
- `note_type` debe estar dentro de los tipos permitidos.
- Si existe `related_entity_id`, debe existir `related_entity_type`.
- La relacion polimorfica se acepta en Fase A por simplicidad; si pierde disciplina, se migrara a tablas puente.

### Eventos que emite
- `note_created`
- `note_linked`

## 6. `sara_tasks`

### Proposito
Representar acciones pendientes simples capturadas desde Chatwoot.

### Owner
`tasks`

### Campos
- `id uuid primary key`
- `schema_version text not null`
- `title text not null`
- `description text`
- `status text not null`
- `source text not null`
- `area_id uuid`
- `due_at timestamptz`
- `completed_at timestamptz`
- `trace_id uuid`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### Estados
- `pending`
- `completed`

### Invariantes
- `title` no puede estar vacio.
- `status` debe estar dentro de los estados permitidos.
- `completed_at` solo existe cuando `status = completed`.
- En MVP no hay recordatorios, recurrencias, prioridad ni calendario.
- Cada creacion o completado debe emitir evento en `sara_events`.

### Eventos que emite
- `task_created`
- `task_completed`

## Decisiones pendientes fuera de Fase A
- `sara_plans`
- `sara_objectives`
- `sara_protocols`
- `sara_usage_metrics`
- entidades de Delta, Gym, Finanzas, Salud y Barberox

Estas entidades no deben ser inventadas por opencode en la primera task.
