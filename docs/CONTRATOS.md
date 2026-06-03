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

Estado actual: detecta modulo `"notes"` con confianza 0.9 para prefijos `nota:`, `guarda una nota:`, `anota esto`, `crear nota`, `aprendizaje:`, `idea:`, `problema:`, `riesgo:`, `mejora:`, `observacion:`. Resto retorna `"unknown"` con 0.5.

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

Estado actual: esqueleto retorna accion `"none"` con confianza 0.1. Para modulo `notes`, detecta `notes.create` por patrones explicitos (`nota:`, `guarda una nota:`, `anota esto:`).

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

### buffer-processor (orquestador post-buffer)
Responsable: `buffer-processor`

Flujo por cada `ClaimedBuffer`:
1. Convierte mensajes `{ id, content, created_at }` a `{ id, content, createdAt }`.
2. Ejecuta `coarseClassifier.classify`.
3. Si `module = "unknown"` o `action = "none"` o `route.executable = false`: usa DeepSeek fallback.
4. Si `intent.confidence < 0.75` o `missingData` no es array vacio: responde con `responseComposer` sin ejecutar accion.
5. Construye `ActionExecutionInput` con `intent.confidence` y `intent.missingData`.
6. Ejecuta `actionExecutor.execute`.
7. Ejecuta `responseComposer.compose`.
8. Envia respuesta por Chatwoot y completa buffer con `store.complete`.

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

### Tablas autorizadas
- `sara_events`: registro canonico de eventos (note_created, etc.)
- `sara_notes`: notas con schema_version, note_type, content, source, area_id, tags, trace_id
- Ambas con RLS habilitado, acceso revocado a anon/authenticated.
