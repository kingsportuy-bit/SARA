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
