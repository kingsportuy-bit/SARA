# CONTRATOS.md - SARA

## API publica inicial (v0)

### POST /api/v1/webhooks/chatwoot
Responsable: `chatwoot-ingress`

Entrada:
- body crudo de webhook Chatwoot
- headers `X-Chatwoot-Signature`
- headers `X-Chatwoot-Timestamp`
- headers `X-Chatwoot-Delivery` (cuando exista)

Acepta procesamiento solo si:
- `event = message_created`
- `account.id = 7`
- `inbox.id = 45`
- `conversation.id = 85`
- mensaje entrante del usuario
- firma valida
- entrega y mensaje no procesados previamente

Salida HTTP:
- `202 Accepted`: entrega persistida o duplicado reconocido
- `401 Unauthorized`: firma invalida
- `400 Bad Request`: payload invalido

Efecto:
- Persistir entrega y mensaje en tablas `sara_`.
- Crear o extender buffer durable a `now() + 20 seconds`.
- No invocar LLM dentro del request del webhook.

Nota worker post-buffer:
- El worker intenta primero el pipeline modular: clasifica modulo, detecta intencion, enruta, ejecuta modulo y compone respuesta.
- Si detecta `notes.create` ejecutable, ejecuta el modulo y confirma solo con evidencia real (`noteId` + `eventId`).
- Si no hay accion ejecutable (modulo desconocido, intencion no detectada, ruta no ejecutable), usa DeepSeek como fallback.
- DeepSeek nunca ejecuta ni confirma acciones.

### Contrato interno: message-buffer.claim-due
Entrada:
- timestamp actual
- limite de lotes

Salida:
- buffers vencidos reclamados atomicamente
- mensajes ordenados por fecha de creacion
- `trace_id`
- `processing_run_id`

### Contrato interno: intent-classifier.classify
Entrada:
- mensajes consolidados
- contexto vigente
- `trace_id`

Salida JSON versionada:
- `intent`
- `confidence`
- `requested_action`
- `required_module`
- `missing_data`
- `reasoning_summary`

### Contrato interno: action-executor.execute
Entrada:
- accion solicitada
- payload validado
- `trace_id`

Salida:
- `status`: `executed | failed | skipped`
- `evidence`
- `state_changes`
- `error` (si aplica)

Regla:
- Solo `status = executed` con evidencia habilita confirmar la accion al usuario.

### Contrato interno: response-composer.compose
Entrada:
- mensajes consolidados
- intencion detectada
- resultado real de accion
- estado actualizado
- `trace_id`

Salida:
- respuesta final
- referencias de evidencia utilizadas

### POST /api/v1/checkins
Entrada:
- area
- energia
- foco
- estado_emocional
- observaciones

Salida:
- checkin_id
- flags_activadas
- recomendaciones

### POST /api/v1/decisions/evaluate
Entrada:
- decision_tipo
- contexto
- datos_relevantes
- protocolo_objetivo

Salida:
- decision_id
- resultado
- motivo
- protocolo_aplicado
- evidencia

### GET /api/v1/dashboard/summary
Salida:
- estado_general
- avances_semana
- desvíos
- riesgos
- ajustes_sugeridos

## Pipeline de comprension y respuesta (v0 - esqueleto)

### coarse-classifier.classify
Responsable: `coarse-classifier`

Entrada (`CoarseClassificationInput`):
- `schemaVersion`: `"coarse_classification_input.v1"`
- `traceId`: string
- `messages`: array de `{ id, content, createdAt }`
- `sessionContext?`: contexto conversacional activo

Salida (`CoarseClassificationResult`):
- `schemaVersion`: `"coarse_classification_result.v1"`
- `traceId`: string
- `module`: `"notes"` | `"daily-log"` | `"session-context"` | `"unknown"`
- `confidence`: number (0-1)
- `missingData`: string[]
- `reasoningSummary`: string

Estado actual: detecta modulo `"notes"` con confianza 0.9 para prefijos de creacion (`nota:`, `guarda una nota:`, `anota esto`, `crear nota`, `aprendizaje:`, `idea:`, `problema:`, `riesgo:`, `mejora:`, `observacion:`), consultas de listado (`que notas tengo`, `listar notas`, `ultimas notas`, `mis notas`) y busqueda (`busca notas sobre`, `notas sobre`). Resto retorna `"unknown"` con 0.5. No realiza stripping de encabezados Chatwoot; recibe contenido ya normalizado por `message-normalizer`.

### module-intent-classifier.classify
Responsable: `module-intent-classifier`

Entrada (`ModuleIntentInput`):
- `schemaVersion`: `"module_intent_input.v1"`
- `traceId`: string
- `module`: resultado del clasificador grueso
- `messages`: mensajes consolidados
- `sessionContext?`: contexto

Salida (`ModuleIntentResult`):
- `schemaVersion`: `"module_intent_result.v1"`
- `traceId`: string
- `module`: mismo que entrada
- `action`: string
- `confidence`: number
- `entities`: Record<string, unknown>
- `missingData`: string[]
- `requiresConfirmation`: boolean
- `reasoningSummary`: string

Estado actual: Para modulo `notes`, detecta `notes.create` por patrones explicitos (`nota:`, `guarda una nota:`, `anota esto:`), `notes.list` para consultas de listado (`que notas tengo`, `listar notas`, `ultimas notas`, `mis notas`), y `notes.search` para busquedas (`busca notas sobre foco`, `notas sobre foco`) extrayendo el termino de busqueda en `entities.query`. No realiza stripping de encabezados Chatwoot; recibe contenido ya normalizado por `message-normalizer`.

### module-router.route
Responsable: `module-router`

Entrada: `ModuleIntentResult`
Salida (`RouteResult`):
- `schemaVersion`: `"route_result.v1"`
- `traceId`: string
- `module`: string
- `action`: string
- `executable`: boolean
- `reason?`: string

Regla: el router valida que el modulo y la accion existan en el registro. Sin modulos registrados, siempre retorna `executable: false`.

### action-executor.execute
Responsable: `action-executor`

Entrada (`ActionExecutionInput`):
- `schemaVersion`: `"action_execution_input.v1"`
- `traceId`: string
- `module`: string
- `action`: string
- `entities`: Record<string, unknown>
- `requiresConfirmation`: boolean

Salida (`ActionExecutionResult`):
- `schemaVersion`: `"action_execution_result.v1"`
- `traceId`: string
- `status`: `"executed"` | `"failed"` | `"skipped"` | `"needs_confirmation"`
- `evidence`: Record<string, unknown>
- `stateChanges`: array de `{ entityType, entityId?, eventType, payload }`
- `error?`: string

Guardas:
- Si `requiresConfirmation = true`, retorna `"needs_confirmation"`.
- Si `intentConfidenceSufficient() = false`, no debe invocarse el executor.
- Sin modulos de dominio registrados, retorna `"skipped"`.

### response-composer.compose
Responsable: `response-composer`

Entrada (`ResponseCompositionInput`):
- `schemaVersion`: `"response_composition_input.v1"`
- `traceId`: string
- `messages`: mensajes consolidados
- `classification`: `{ coarse, intent }`
- `actionResult`: resultado real del executor

Salida (`ResponseCompositionResult`):
- `schemaVersion`: `"response_composition_result.v1"`
- `traceId`: string
- `content`: string
- `evidenceUsed`: Record<string, unknown>

Regla: el compositor redacta segun el estado real (missingData, confidence baja, needs_confirmation, skipped, failed, executed). No confirma acciones no ejecutadas.

### intentConfidenceSufficient (guard)
Responsable: `action-executor`

Entrada: `ModuleIntentResult`
Salida: `boolean`

Retorna `true` solo si `confidence >= 0.75` y `missingData` esta vacio.

### message-normalizer.normalize
Responsable: `message-normalizer`

Entrada:
- `messages`: array de `{ id: number, content: string, createdAt: string }` (mensajes crudos del buffer)

Salida (`NormalizedMessage[]`):
- `id`: string
- `content`: string (contenido normalizado sin encabezados de canal)
- `originalContent`: string (contenido original intacto)
- `createdAt`: string
- `normalization.removedChatwootGroupHeader`: boolean

Regla:
- `sara_messages` conserva contenido crudo.
- El worker usa contenido normalizado para clasificar/intencionar/responder.
- Los modulos de dominio no conocen formato Chatwoot.
- Remueve encabezados markdown de grupo Chatwoot del tipo `**autor:** ` al inicio del mensaje.

### buffer-processor (orquestador post-buffer)
Responsable: `buffer-processor`

Flujo por cada `ClaimedBuffer`:
1. Convierte mensajes `{ id, content, created_at }` a `{ id, content, createdAt }`.
2. Normaliza mensajes con `messageNormalizer.normalize` antes de clasificar.
3. Ejecuta `coarseClassifier.classify` con contenido ya normalizado.
4. Si `module = "unknown"` o `action = "none"` o `route.executable = false`: usa DeepSeek fallback.
5. Si `intent.confidence < 0.75` o `missingData` no es array vacio: responde con `responseComposer` sin ejecutar accion.
6. Construye `ActionExecutionInput` con `intent.confidence` y `intent.missingData`.
7. Ejecuta `actionExecutor.execute`.
8. Ejecuta `responseComposer.compose`.
9. Envia respuesta por Chatwoot y completa buffer con `store.complete`.

DeepSeek como fallback solo para mensajes sin accion ejecutable. Nunca ejecuta ni confirma acciones.

## Modulo notes (v0)

### notes.create
Responsable: `notes`

Entrada (`CreateNoteInput`):
- `schemaVersion`: `"notes_create_input.v1"`
- `traceId`: string
- `content`: string (no vacio)
- `noteType`: `NoteType` (aprendizaje | idea | problema | riesgo | mejora | observacion)
- `source`: `"chatwoot"` | `"manual"` | `"system"`
- `areaId?`: uuid
- `relatedEntityType?`: string
- `relatedEntityId?`: uuid
- `tags`: string[]

Salida (`CreateNoteResult`):
- `schemaVersion`: `"notes_create_result.v1"`
- `traceId`: string
- `status`: `"created"` | `"failed"`
- `noteId?`: uuid (solo si status = created)
- `eventId?`: uuid (solo si status = created)
- `evidence.noteId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"note_created"`
- `error?`: string (solo si status = failed)

Reglas de negocio:
- `content` no puede ser vacio.
- `noteType` debe ser uno de los valores validos.
- Si `relatedEntityId` existe, `relatedEntityType` debe existir (validado en RPC).
- Cada creacion emite evento `note_created` en `sara_events`.

### RPC `sara_create_note`
Responsable: DB

Firma:
```
sara_create_note(p_trace_id uuid, p_content text, p_note_type text, p_source text, p_area_id uuid, p_related_entity_type text, p_related_entity_id uuid, p_tags jsonb)
```

Retorna JSON con `note_id`, `event_id`, `trace_id`, `schema_version`.
Valida: content no vacio, noteType valido, relacion entidad consistente.
Ejecutable solo por `service_role`.

### notes.list
Responsable: `notes`

Entrada (`ListNotesInput`):
- `schemaVersion`: `"notes_list_input.v1"`
- `traceId`: string
- `limit?`: number (default 5, max 10)
- `noteType?`: NoteType (filtro opcional)

Salida (`ListNotesResult`):
- `schemaVersion`: `"notes_list_result.v1"`
- `traceId`: string
- `status`: `"success"` | `"failed"`
- `notes`: array de `{ id, content, noteType, source, tags, createdAt }`
- `count`: number
- `error?`: string

Consulta `sara_notes` ordenado por `created_at desc`. Read-only, no usa RPC de escritura.

### notes.search
Responsable: `notes`

Entrada (`SearchNotesInput`):
- `schemaVersion`: `"notes_search_input.v1"`
- `traceId`: string
- `query`: string (no vacio)
- `limit?`: number (default 5, max 10)
- `noteType?`: NoteType (filtro opcional)

Salida (`SearchNotesResult`):
- `schemaVersion`: `"notes_search_result.v1"`
- `traceId`: string
- `status`: `"success"` | `"failed"`
- `query`: string
- `notes`: array de `{ id, content, noteType, source, tags, createdAt }`
- `count`: number
- `error?`: string

Busca por `ILIKE` sobre `content` en `sara_notes`. Read-only.

Reglas de respuesta:
- Con resultados list: `"Estas son tus ultimas notas:\n1. [tipo] preview..."`
- Con resultados search: `"Resultados de busqueda para \"query\":\n1. [tipo] preview..."`
- Sin resultados list: `"No encontre notas todavia."`
- Sin resultados search: `"No encontre notas para \"query\"."`
- Content preview truncado a 60 caracteres.

### Tablas autorizadas
- `sara_events`: registro canonico de eventos (note_created, task_created, task_completed, etc.)
- `sara_notes`: notas con schema_version, note_type, content, source, area_id, tags, trace_id
- `sara_tasks`: tareas con schema_version, title, description, status, source, area_id, due_at, completed_at, trace_id
- Todas con RLS habilitado, acceso revocado a anon/authenticated.

## Modulo tasks (v0)

### tasks.create
Responsable: `tasks`

Entrada (`CreateTaskInput`):
- `schemaVersion`: `"tasks_create_input.v1"`
- `traceId`: string
- `title`: string (no vacio)
- `source`: `"chatwoot"` | `"manual"` | `"system"`
- `description?`: string
- `areaId?`: uuid

Salida (`CreateTaskResult`):
- `schemaVersion`: `"tasks_create_result.v1"`
- `traceId`: string
- `status`: `"created"` | `"failed"`
- `taskId?`: uuid (solo si status = created)
- `eventId?`: uuid (solo si status = created)
- `evidence.taskId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"task_created"`
- `error?`: string

Reglas:
- `title` no puede ser vacio.
- `source = "chatwoot"` por defecto.
- Cada creacion emite evento `task_created` en `sara_events`.
- Solo confirma con `taskId` y `eventId`.

### RPC `sara_create_task`
Firma:
```
sara_create_task(p_trace_id uuid, p_title text, p_description text, p_source text, p_area_id uuid, p_due_at timestamptz)
```
Retorna JSON con `task_id`, `event_id`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### tasks.list
Responsable: `tasks`

Entrada (`ListTasksInput`):
- `schemaVersion`: `"tasks_list_input.v1"`
- `traceId`: string
- `limit?`: number (default 5, max 10)
- `status?`: `TaskStatus` (default `pending`)

Salida (`ListTasksResult`):
- `schemaVersion`: `"tasks_list_result.v1"`
- `traceId`: string
- `status`: `"success"` | `"failed"`
- `tasks`: array de `TaskRecord`
- `count`: number
- `error?`: string

Consulta `sara_tasks` filtrado por status (`pending` default), ordenado por `created_at desc`. Read-only.

### tasks.complete
Responsable: `tasks`

Entrada (`CompleteTaskInput`):
- `schemaVersion`: `"tasks_complete_input.v1"`
- `traceId`: string
- `taskId?`: uuid
- `titleMatch?`: string (debe matchear una unica tarea pendiente)
- `position?`: number (indice humano 1-based)
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`CompleteTaskResult`):
- `schemaVersion`: `"tasks_complete_result.v1"`
- `traceId`: string
- `status`: `"completed"` | `"failed"`
- `taskId?`: uuid
- `eventId?`: uuid
- `title?`: string
- `evidence.taskId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"task_completed"`
- `error?`: string

Reglas:
- Requiere al menos un identificador: `taskId`, `titleMatch` o `position` > 0.
- `position` se resuelve contra la lista de pendientes ordenada por `created_at desc`.
- `titleMatch` busca por ILIKE parcial en `title`, pero solo ejecuta si hay una unica tarea pendiente coincidente.
- Si `titleMatch` coincide con multiples tareas pendientes, falla sin cambiar estado.
- Solo confirma con `taskId` y `eventId`.
- Emite evento `task_completed` en `sara_events`.

### RPC `sara_complete_task`
Firma:
```
sara_complete_task(p_trace_id uuid, p_task_id uuid, p_title_match text, p_position int, p_source text)
```
Retorna JSON con `task_id`, `event_id`, `title`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

Reglas de respuesta:
- Crear: `"Tarea creada: <title>"`
- Listar con resultados: `"Estas son tus tareas pendientes:\n1. <title1>\n2. <title2>"`
- Listar sin resultados: `"No encontre tareas pendientes."`
- Completar: `"Tarea completada: <title>"`

## Modulo session-context (v0 MVP)

### Tabla `sara_session_contexts`
Responsable: `session-context`

Campos:
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

Restricciones:
- Unique constraint `sara_session_contexts_unique_conversation` en `(account_id, inbox_id, conversation_id)`.
- RLS habilitado, acceso revocado a anon/authenticated, solo service_role autorizado.

### session-context.get
Responsable: `session-context`

RPC: `sara_get_session_context(account_id bigint, inbox_id bigint, conversation_id bigint)`
Retorna jsonb con el contexto activo (no expirado) o null.
Ejecutable solo por service_role.

### session-context.upsert
Responsable: `session-context`

RPC: `sara_upsert_session_context(p_trace_id uuid, p_account_id bigint, p_inbox_id bigint, p_conversation_id bigint, p_active_module text, p_active_flow text, p_focused_entity_type text, p_focused_entity_id uuid, p_awaiting_confirmation boolean, p_confirmation_payload jsonb, p_context jsonb, p_ttl_minutes int)`
Upsert con merge de context jsonb. Si es nuevo emite `session_context_started`, si actualiza emite `session_context_updated`. TTL default 30 minutos.
Retorna jsonb con registro completo, eventId e isNew.
Ejecutable solo por service_role.

### session-context.clear
Responsable: `session-context`

RPC: `sara_clear_session_context(p_trace_id uuid, p_account_id bigint, p_inbox_id bigint, p_conversation_id bigint)`
Elimina el contexto activo. Emite `session_context_cleared`.
Retorna jsonb con cleared y sessionContextId.
Ejecutable solo por service_role.

### Foco conversacional
Despues de acciones ejecutadas el bufferProcessor actualiza automaticamente:
- `tasks.create`: foco en la tarea creada (focusedEntityType=task, focusedEntityId=taskId, activeFlow=task_created, context.lastTaskTitle=title)
- `tasks.list`: si hay 1 unica pendiente foco en ella; si hay multiples guarda lastTaskList con posiciones e ids
- `tasks.complete`: limpia foco si la tarea completada era la enfocada (activeFlow=task_completed)
- `notes.create/list/search`: enfoca nota si se creo o si hay un unico resultado

### Resolucion de referencias simples
El `moduleIntentClassifier` resuelve frases como `completar esa`, `completar la ultima tarea`, `marcar esa como hecha` usando:
- `sessionContext.focusedEntityType` + `focusedEntityId` si el foco esta en una tarea
- `context.lastTaskList` si contiene exactamente una tarea
Si hay ambiguedad, retorna `missingData=["task"]` y no ejecuta.

Eventos emitidos en `sara_events`:
- `session_context_started`
- `session_context_updated`
- `session_context_cleared`
- `confirmation_requested` (reservado, no implementado en MVP)
- `confirmation_resolved` (reservado, no implementado en MVP)

## Modulo reminders (v0 MVP)

### reminders.create
Responsable: `reminders`

Entrada (`CreateReminderInput`):
- `schemaVersion`: `"reminders_create_input.v1"`
- `traceId`: string
- `title`: string (no vacio)
- `message?`: string
- `dueAt`: ISO timestamptz futuro
- `source`: `"chatwoot"` | `"manual"` | `"system"`
- `accountId`: number
- `inboxId`: number
- `conversationId`: number
- `relatedEntityType?`: string
- `relatedEntityId?`: uuid

Salida (`CreateReminderResult`):
- `schemaVersion`: `"reminders_create_result.v1"`
- `traceId`: string
- `status`: `"created"` | `"failed"`
- `reminderId?`: uuid
- `eventId?`: uuid
- `dueAt?`: ISO timestamptz
- `title?`: string
- `evidence.reminderId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"reminder_created"`
- `error?`: string

Reglas:
- `title` no puede ser vacio.
- `dueAt` debe ser futuro.
- El parseo temporal ocurre antes de ejecutar la accion.
- Si falta fecha/hora o es ambigua, `missingData=["dueAt"]` y no se ejecuta.
- Solo confirma creacion con `reminderId` y `eventId`.
- No crea recurrencias.
- No integra calendario externo.

### reminders.list
Responsable: `reminders`

Entrada (`ListRemindersInput`):
- `schemaVersion`: `"reminders_list_input.v1"`
- `traceId`: string
- `status?`: `"pending"` | `"sent"` | `"canceled"` | `"failed"` (default `"pending"`)
- `limit?`: number (default 5, max 10)
- `accountId`: number
- `inboxId`: number
- `conversationId`: number

Salida (`ListRemindersResult`):
- `schemaVersion`: `"reminders_list_result.v1"`
- `traceId`: string
- `status`: `"success"` | `"failed"`
- `reminders`: array de `{ id, title, message?, status, dueAt, createdAt }`
- `count`: number
- `error?`: string

Consulta `sara_reminders` read-only, filtrada por conversacion y estado.

### reminders.cancel
Responsable: `reminders`

Entrada (`CancelReminderInput`):
- `schemaVersion`: `"reminders_cancel_input.v1"`
- `traceId`: string
- `reminderId?`: uuid
- `titleMatch?`: string
- `position?`: number (indice humano 1-based)
- `source`: `"chatwoot"` | `"manual"` | `"system"`
- `accountId`: number
- `inboxId`: number
- `conversationId`: number

Salida (`CancelReminderResult`):
- `schemaVersion`: `"reminders_cancel_result.v1"`
- `traceId`: string
- `status`: `"canceled"` | `"failed"`
- `reminderId?`: uuid
- `eventId?`: uuid
- `title?`: string
- `evidence.reminderId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"reminder_canceled"`
- `error?`: string

Reglas:
- Requiere `reminderId`, `titleMatch` o `position`.
- `position` se resuelve contra recordatorios pendientes ordenados por `due_at asc`.
- `titleMatch` solo ejecuta si hay una unica coincidencia pendiente.
- Si hay ambiguedad, falla sin cambiar estado.
- Solo confirma cancelacion con `reminderId` y `eventId`.

### reminders.dispatch-due
Responsable: `reminders-dispatcher`

Entrada:
- timestamp actual
- limite de reclamo

Salida:
- recordatorios vencidos reclamados atomicamente
- envios intentados por Chatwoot
- eventos de envio/fallo registrados

Reglas:
- Reclama solo `status = pending` y `due_at <= now()`.
- Al reclamar pasa a `processing` para evitar doble envio.
- Si Chatwoot confirma envio, pasa a `sent` y emite `reminder_sent`.
- Si falla el envio, pasa a `failed` y emite `reminder_failed`.
- No debe enviar recordatorios cancelados.
- No debe tocar conversaciones fuera de account `7`, inbox `45`, conversation `85` en este MVP.

### RPC `sara_create_reminder`
Firma:
```
sara_create_reminder(p_trace_id uuid, p_title text, p_message text, p_due_at timestamptz, p_source text, p_account_id bigint, p_inbox_id bigint, p_conversation_id bigint, p_related_entity_type text, p_related_entity_id uuid)
```
Retorna JSON con `reminder_id`, `event_id`, `due_at`, `title`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_cancel_reminder`
Firma:
```
sara_cancel_reminder(p_trace_id uuid, p_reminder_id uuid, p_title_match text, p_position int, p_source text, p_account_id bigint, p_inbox_id bigint, p_conversation_id bigint)
```
Retorna JSON con `reminder_id`, `event_id`, `title`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_claim_due_reminders`
Firma:
```
sara_claim_due_reminders(p_limit int, p_account_id bigint, p_inbox_id bigint, p_conversation_id bigint)
```
Reclama recordatorios vencidos `pending` de la conversacion indicada, los pasa a `processing` y retorna filas para enviar.
Ejecutable solo por `service_role`.

### RPC `sara_mark_reminder_sent`
Firma:
```
sara_mark_reminder_sent(p_trace_id uuid, p_reminder_id uuid, p_source text)
```
Marca `sent`, registra `sent_at` y emite `reminder_sent`.
Ejecutable solo por `service_role`.

### RPC `sara_mark_reminder_failed`
Firma:
```
sara_mark_reminder_failed(p_trace_id uuid, p_reminder_id uuid, p_source text, p_failure_reason text)
```
Marca `failed`, registra `failed_at`, `failure_reason` y emite `reminder_failed`.
Ejecutable solo por `service_role`.

### Parseo temporal MVP
Responsable: `reminder-time-parser`

Soporta de forma deterministica:
- `en N minutos`
- `en N horas`
- `en N dias`
- `hoy a las HH`
- `hoy a las HH:MM`
- `manana a las HH`
- `manana a las HH:MM`

Zona horaria operativa: `America/Montevideo`.

No soporta todavia:
- recurrencias;
- dias de semana;
- meses en lenguaje natural;
- calendario externo;
- zonas horarias configurables;
- horarios inteligentes.

Reglas de respuesta:
- Crear: `"Recordatorio creado para <fecha/hora>: <title>"`
- Listar con resultados: `"Estos son tus recordatorios pendientes:\n1. <fecha/hora> - <title>"`
- Listar sin resultados: `"No encontre recordatorios pendientes."`
- Cancelar: `"Recordatorio cancelado: <title>"`
- Disparo: `"Recordatorio: <title>"`

## Modulo daily-log (v0 MVP)

### daily-log.morning
Responsable: `daily-log`

Entrada (`DailyLogMorningInput`):
- `schemaVersion`: `"daily_log_morning_input.v1"`
- `traceId`: string
- `date`: string ISO `YYYY-MM-DD` en timezone `America/Montevideo`
- `wakeEnergy?`: number entero 1-10
- `sleepHours?`: number >= 0
- `morningIntention?`: string
- `mood?`: string
- `notes?`: string[]
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`DailyLogMorningResult`):
- `schemaVersion`: `"daily_log_morning_result.v1"`
- `traceId`: string
- `status`: `"updated"` | `"failed"`
- `dailyLogId?`: uuid
- `eventId?`: uuid
- `date?`: string
- `evidence.dailyLogId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"daily_log_created"` | `"daily_log_morning_updated"`
- `error?`: string

Reglas:
- Si no existe log para la fecha, lo crea.
- Si existe, actualiza solo campos de mañana provistos.
- No borra campos no provistos.
- `wakeEnergy` debe estar entre 1 y 10.
- `sleepHours` no puede ser negativo.
- Solo confirma con `dailyLogId` y `eventId`.

### daily-log.evening
Responsable: `daily-log`

Entrada (`DailyLogEveningInput`):
- `schemaVersion`: `"daily_log_evening_input.v1"`
- `traceId`: string
- `date`: string ISO `YYYY-MM-DD` en timezone `America/Montevideo`
- `eveningReview?`: string
- `mood?`: string
- `notes?`: string[]
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`DailyLogEveningResult`):
- `schemaVersion`: `"daily_log_evening_result.v1"`
- `traceId`: string
- `status`: `"updated"` | `"failed"`
- `dailyLogId?`: uuid
- `eventId?`: uuid
- `date?`: string
- `evidence.dailyLogId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"daily_log_created"` | `"daily_log_evening_updated"`
- `error?`: string

Reglas:
- Si no existe log para la fecha, lo crea.
- Si existe, actualiza solo campos de noche provistos.
- No borra campos no provistos.
- Solo confirma con `dailyLogId` y `eventId`.

### daily-log.summary
Responsable: `daily-log`

Entrada (`DailyLogSummaryInput`):
- `schemaVersion`: `"daily_log_summary_input.v1"`
- `traceId`: string
- `date`: string ISO `YYYY-MM-DD` en timezone `America/Montevideo`

Salida (`DailyLogSummaryResult`):
- `schemaVersion`: `"daily_log_summary_result.v1"`
- `traceId`: string
- `status`: `"success"` | `"failed"`
- `dailyLog?`: `{ id, date, wakeEnergy?, sleepHours?, morningIntention?, eveningReview?, mood?, notes, createdAt, updatedAt }`
- `error?`: string

Consulta `sara_daily_log` read-only para una fecha.

### RPC `sara_upsert_daily_log_morning`
Firma:
```
sara_upsert_daily_log_morning(p_trace_id uuid, p_date date, p_wake_energy int, p_sleep_hours numeric, p_morning_intention text, p_mood text, p_notes jsonb, p_source text)
```
Retorna JSON con `daily_log_id`, `event_id`, `event_type`, `date`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_upsert_daily_log_evening`
Firma:
```
sara_upsert_daily_log_evening(p_trace_id uuid, p_date date, p_evening_review text, p_mood text, p_notes jsonb, p_source text)
```
Retorna JSON con `daily_log_id`, `event_id`, `event_type`, `date`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### Parseo MVP desde Chatwoot
Responsable: `daily-log-intent-parser`

Soporta:
- `buen dia energia 7 dormi 6.5 foco terminar propuestas`
- `checkin manana energia 8 dormi 7 intencion ordenar agenda`
- `cierre del dia avance termine propuestas`
- `resumen del dia`
- `como estuvo mi dia`

Reglas:
- Si no se especifica fecha, usar fecha actual en `America/Montevideo`.
- No usar LLM para ejecutar ni inventar datos faltantes.
- Si faltan todos los campos actualizables en morning/evening, responder con missingData y no ejecutar.

No soporta todavia:
- analitica avanzada;
- recomendaciones medicas;
- score complejo de productividad;
- correlaciones historicas;
- reportes semanales;
- integracion con areas/objetivos.

Reglas de respuesta:
- Morning: `"Registro de manana actualizado para <date>."`
- Evening: `"Cierre del dia actualizado para <date>."`
- Summary con datos: `"Resumen de <date>:\nEnergia: ...\nSueno: ...\nIntencion: ...\nCierre: ..."`
- Summary sin datos: `"No encontre registro diario para <date>."`

## Modulo areas (v0 MVP)

### areas.create
Responsable: `areas`

Entrada (`CreateAreaInput`):
- `schemaVersion`: `"areas_create_input.v1"`
- `traceId`: string
- `name`: string (no vacio)
- `slug`: string (no vacio, unico)
- `description?`: string
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`CreateAreaResult`):
- `schemaVersion`: `"areas_create_result.v1"`
- `traceId`: string
- `status`: `"created"` | `"failed"`
- `areaId?`: uuid
- `eventId?`: uuid
- `name?`: string
- `slug?`: string
- `evidence.areaId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"area_created"`
- `error?`: string

Reglas:
- `name` no puede ser vacio.
- `slug` se genera de forma deterministica y ASCII-safe.
- No se duplican slugs existentes.
- El area nace con `status = active`.
- Solo confirma con `areaId` y `eventId`.

### areas.list
Responsable: `areas`

Entrada (`ListAreasInput`):
- `schemaVersion`: `"areas_list_input.v1"`
- `traceId`: string
- `status?`: `"active"` | `"paused"` | `"archived"` (default `"active"`)
- `limit?`: number (default 10, max 20)

Salida (`ListAreasResult`):
- `schemaVersion`: `"areas_list_result.v1"`
- `traceId`: string
- `status`: `"success"` | `"failed"`
- `areas`: array de `{ id, name, slug, description?, status, createdAt, updatedAt }`
- `count`: number
- `error?`: string

Consulta `sara_areas` read-only, filtrada por estado y ordenada por `name asc`.

### areas.archive
Responsable: `areas`

Entrada (`ArchiveAreaInput`):
- `schemaVersion`: `"areas_archive_input.v1"`
- `traceId`: string
- `areaId?`: uuid
- `slug?`: string
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`ArchiveAreaResult`):
- `schemaVersion`: `"areas_archive_result.v1"`
- `traceId`: string
- `status`: `"archived"` | `"failed"`
- `areaId?`: uuid
- `eventId?`: uuid
- `name?`: string
- `slug?`: string
- `evidence.areaId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"area_archived"`
- `error?`: string

Reglas:
- Requiere `areaId` o `slug`.
- No borra datos.
- Solo cambia `status` a `archived`.
- Solo confirma con `areaId` y `eventId`.

### areas.assign-note
Responsable: `areas`

Entrada (`AssignNoteAreaInput`):
- `schemaVersion`: `"areas_assign_note_input.v1"`
- `traceId`: string
- `noteId`: uuid
- `areaId?`: uuid
- `areaSlug?`: string
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`AssignNoteAreaResult`):
- `schemaVersion`: `"areas_assign_note_result.v1"`
- `traceId`: string
- `status`: `"assigned"` | `"failed"`
- `noteId?`: uuid
- `areaId?`: uuid
- `areaName?`: string
- `areaSlug?`: string
- `eventId?`: uuid
- `evidence.noteId?`: uuid
- `evidence.areaId?`: uuid
- `evidence.areaSlug?`: string
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"note_area_assigned"`
- `error?`: string

Reglas:
- Requiere nota existente.
- Requiere area activa existente.
- No crea nota.
- No crea area implicitamente.
- Solo confirma con `noteId`, `areaId` y `eventId`.

### areas.assign-task
Responsable: `areas`

Entrada (`AssignTaskAreaInput`):
- `schemaVersion`: `"areas_assign_task_input.v1"`
- `traceId`: string
- `taskId`: uuid
- `areaId?`: uuid
- `areaSlug?`: string
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`AssignTaskAreaResult`):
- `schemaVersion`: `"areas_assign_task_result.v1"`
- `traceId`: string
- `status`: `"assigned"` | `"failed"`
- `taskId?`: uuid
- `title?`: string
- `areaId?`: uuid
- `areaName?`: string
- `areaSlug?`: string
- `eventId?`: uuid
- `evidence.taskId?`: uuid
- `evidence.areaId?`: uuid
- `evidence.areaSlug?`: string
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"task_area_assigned"`
- `error?`: string

Reglas:
- Requiere tarea existente.
- Requiere area activa existente.
- No crea tarea.
- No crea area implicitamente.
- Solo confirma con `taskId`, `areaId` y `eventId`.

### RPC `sara_create_area`
Firma:
```
sara_create_area(p_trace_id uuid, p_name text, p_slug text, p_description text, p_source text)
```
Retorna JSON con `area_id`, `event_id`, `name`, `slug`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_archive_area`
Firma:
```
sara_archive_area(p_trace_id uuid, p_area_id uuid, p_slug text, p_source text)
```
Retorna JSON con `area_id`, `event_id`, `name`, `slug`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_assign_note_area`
Firma:
```
sara_assign_note_area(p_trace_id uuid, p_note_id uuid, p_area_id uuid, p_area_slug text, p_source text)
```
Actualiza `sara_notes.area_id` y emite `note_area_assigned`.
Retorna JSON con `note_id`, `area_id`, `area_name`, `area_slug`, `event_id`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_assign_task_area`
Firma:
```
sara_assign_task_area(p_trace_id uuid, p_task_id uuid, p_area_id uuid, p_area_slug text, p_source text)
```
Actualiza `sara_tasks.area_id` y emite `task_area_assigned`.
Retorna JSON con `task_id`, `title`, `area_id`, `area_name`, `area_slug`, `event_id`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### Parseo MVP desde Chatwoot
Responsable: `areas-intent-parser`

Soporta:
- `crear area salud`
- `nueva area trabajo`
- `que areas tengo`
- `listar areas`
- `archivar area salud`
- `asociar esa tarea al area salud`
- `asignar ultima tarea a salud`
- `asociar esa nota al area aprendizaje`

Reglas:
- Si falta nombre de area en create, `missingData=["areaName"]`.
- Si falta area en archive/assign, `missingData=["area"]`.
- Si falta entidad en assign, `missingData=["entity"]`.
- Para referencias como `esa tarea` o `esa nota`, usar solo `session-context` seguro.
- No usar LLM para ejecutar ni inventar datos faltantes.

No soporta todavia:
- proyectos;
- objetivos;
- planes;
- dashboards;
- permisos por area;
- jerarquias de areas;
- reactivacion de areas archivadas.

Reglas de respuesta:
- Crear: `"Area creada: <name>"`
- Listar con resultados: `"Estas son tus areas activas:\n1. <name>"`
- Listar sin resultados: `"No encontre areas activas."`
- Archivar: `"Area archivada: <name>"`
- Asignar nota: `"Nota asociada al area <areaName>."`
- Asignar tarea: `"Tarea asociada al area <areaName>: <title>"`

## Modulo objectives (v0 MVP)

### objectives.create
Responsable: `objectives`

Entrada (`CreateObjectiveInput`):
- `schemaVersion`: `"objectives_create_input.v1"`
- `traceId`: string
- `title`: string (no vacio)
- `slug`: string (no vacio, unico activo)
- `description?`: string
- `areaId?`: uuid
- `areaSlug?`: string
- `targetDate?`: string ISO `YYYY-MM-DD`
- `successCriteria`: string[]
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`CreateObjectiveResult`):
- `schemaVersion`: `"objectives_create_result.v1"`
- `traceId`: string
- `status`: `"created"` | `"failed"`
- `objectiveId?`: uuid
- `eventId?`: uuid
- `title?`: string
- `slug?`: string
- `areaId?`: uuid
- `areaName?`: string
- `evidence.objectiveId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"objective_created"`
- `error?`: string

Reglas:
- `title` no puede ser vacio.
- `slug` se genera de forma deterministica y ASCII-safe.
- No se duplican slugs activos.
- Si se informa area, debe existir y estar activa.
- No genera plan.
- No genera tareas.
- Solo confirma con `objectiveId` y `eventId`.

### objectives.list
Responsable: `objectives`

Entrada (`ListObjectivesInput`):
- `schemaVersion`: `"objectives_list_input.v1"`
- `traceId`: string
- `status?`: `"active"` | `"achieved"` | `"archived"` (default `"active"`)
- `areaId?`: uuid
- `areaSlug?`: string
- `limit?`: number (default 10, max 20)

Salida (`ListObjectivesResult`):
- `schemaVersion`: `"objectives_list_result.v1"`
- `traceId`: string
- `status`: `"success"` | `"failed"`
- `objectives`: array de `{ id, title, slug, description?, areaId?, areaName?, status, targetDate?, successCriteria, createdAt, updatedAt, achievedAt?, archivedAt? }`
- `count`: number
- `error?`: string

Consulta `sara_objectives` read-only, filtrada por estado y opcionalmente por area.

### objectives.achieve
Responsable: `objectives`

Entrada (`AchieveObjectiveInput`):
- `schemaVersion`: `"objectives_achieve_input.v1"`
- `traceId`: string
- `objectiveId?`: uuid
- `slug?`: string
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`AchieveObjectiveResult`):
- `schemaVersion`: `"objectives_achieve_result.v1"`
- `traceId`: string
- `status`: `"achieved"` | `"failed"`
- `objectiveId?`: uuid
- `eventId?`: uuid
- `title?`: string
- `slug?`: string
- `evidence.objectiveId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"objective_achieved"`
- `error?`: string

Reglas:
- Requiere `objectiveId` o `slug`.
- No borra datos.
- Solo cambia `status` a `achieved` y setea `achieved_at`.
- Solo confirma con `objectiveId` y `eventId`.

### objectives.archive
Responsable: `objectives`

Entrada (`ArchiveObjectiveInput`):
- `schemaVersion`: `"objectives_archive_input.v1"`
- `traceId`: string
- `objectiveId?`: uuid
- `slug?`: string
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`ArchiveObjectiveResult`):
- `schemaVersion`: `"objectives_archive_result.v1"`
- `traceId`: string
- `status`: `"archived"` | `"failed"`
- `objectiveId?`: uuid
- `eventId?`: uuid
- `title?`: string
- `slug?`: string
- `evidence.objectiveId?`: uuid
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"objective_archived"`
- `error?`: string

Reglas:
- Requiere `objectiveId` o `slug`.
- No borra datos.
- Solo cambia `status` a `archived` y setea `archived_at`.
- Solo confirma con `objectiveId` y `eventId`.

### objectives.assign-task
Responsable: `objectives`

Entrada (`AssignTaskObjectiveInput`):
- `schemaVersion`: `"objectives_assign_task_input.v1"`
- `traceId`: string
- `taskId`: uuid
- `objectiveId?`: uuid
- `objectiveSlug?`: string
- `source`: `"chatwoot"` | `"manual"` | `"system"`

Salida (`AssignTaskObjectiveResult`):
- `schemaVersion`: `"objectives_assign_task_result.v1"`
- `traceId`: string
- `status`: `"assigned"` | `"failed"`
- `taskId?`: uuid
- `taskTitle?`: string
- `objectiveId?`: uuid
- `objectiveTitle?`: string
- `objectiveSlug?`: string
- `eventId?`: uuid
- `evidence.taskId?`: uuid
- `evidence.objectiveId?`: uuid
- `evidence.objectiveSlug?`: string
- `evidence.eventId?`: uuid
- `evidence.eventType?`: `"task_objective_assigned"`
- `error?`: string

Reglas:
- Requiere tarea existente.
- Requiere objetivo activo existente.
- No crea tarea.
- No crea objetivo implicitamente.
- No crea plan.
- Solo confirma con `taskId`, `objectiveId` y `eventId`.

### RPC `sara_create_objective`
Firma:
```
sara_create_objective(p_trace_id uuid, p_title text, p_slug text, p_description text, p_area_id uuid, p_area_slug text, p_target_date date, p_success_criteria jsonb, p_source text)
```
Retorna JSON con `objective_id`, `event_id`, `title`, `slug`, `area_id`, `area_name`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_achieve_objective`
Firma:
```
sara_achieve_objective(p_trace_id uuid, p_objective_id uuid, p_slug text, p_source text)
```
Retorna JSON con `objective_id`, `event_id`, `title`, `slug`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_archive_objective`
Firma:
```
sara_archive_objective(p_trace_id uuid, p_objective_id uuid, p_slug text, p_source text)
```
Retorna JSON con `objective_id`, `event_id`, `title`, `slug`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### RPC `sara_assign_task_objective`
Firma:
```
sara_assign_task_objective(p_trace_id uuid, p_task_id uuid, p_objective_id uuid, p_objective_slug text, p_source text)
```
Actualiza `sara_tasks.objective_id` y emite `task_objective_assigned`.
Retorna JSON con `task_id`, `task_title`, `objective_id`, `objective_title`, `objective_slug`, `event_id`, `trace_id`, `schema_version`.
Ejecutable solo por `service_role`.

### Parseo MVP desde Chatwoot
Responsable: `objectives-intent-parser`

Soporta:
- `crear objetivo mejorar mi energia`
- `crear objetivo mejorar mi energia area salud`
- `nuevo objetivo facturar mas`
- `que objetivos tengo`
- `listar objetivos`
- `marcar objetivo mejorar mi energia como logrado`
- `logre objetivo mejorar mi energia`
- `archivar objetivo mejorar mi energia`
- `asociar esa tarea al objetivo mejorar mi energia`
- `asignar ultima tarea al objetivo mejorar mi energia`

Reglas:
- Si falta titulo de objetivo en create, `missingData=["objectiveTitle"]`.
- Si falta objetivo en achieve/archive/assign, `missingData=["objective"]`.
- Si falta tarea en assign, `missingData=["task"]`.
- Para referencias como `esa tarea`, usar solo `session-context` seguro.
- No usar LLM para ejecutar ni inventar datos faltantes.

No soporta todavia:
- planes;
- proyectos;
- OKRs avanzados;
- scoring automatico;
- recomendaciones;
- tareas generadas automaticamente;
- dependencias entre tareas;
- reportes historicos.

Reglas de respuesta:
- Crear: `"Objetivo creado: <title>"`
- Listar con resultados: `"Estos son tus objetivos activos:\n1. <title>"`
- Listar sin resultados: `"No encontre objetivos activos."`
- Lograr: `"Objetivo logrado: <title>"`
- Archivar: `"Objetivo archivado: <title>"`
- Asignar tarea: `"Tarea asociada al objetivo <objectiveTitle>: <taskTitle>"`
