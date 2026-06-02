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
- `account.id = 6`
- `inbox.id = 44`
- `conversation.id = 20`
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

Nota bootstrap:
- Temporalmente, el worker envia el lote consolidado directo a DeepSeek y publica la respuesta en Chatwoot.
- Este bypass no puede ejecutar ni confirmar acciones.

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
