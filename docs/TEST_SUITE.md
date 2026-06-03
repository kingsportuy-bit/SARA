# TEST_SUITE.md - SARA

## Regla permanente
- Cada funcionalidad o fix incluye tests propios del modulo.
- Antes de integrar se ejecutan tests del modulo y regresion existente.
- Un modulo nuevo no se cierra si rompe comportamiento previo no incluido explicitamente en su task.
- Toda prueba registra evidencia trazable.
- Toda migracion valida que solo afecta objetos con prefijo `sara_`.

## Inventario inicial
- PASS: webhook Chatwoot acepta solo account `7`, inbox `45`, conversation `85`
- PASS: webhook Chatwoot rechaza firma invalida o vencida
- PENDING: idempotencia por delivery ID y message ID
- PENDING: buffer extiende `process_after` por cada mensaje entrante valido
- PENDING: worker reclama una sola vez cada buffer vencido
- PASS: mensajes salientes no generan loop
- PENDING: respuesta no confirma accion sin evidencia exitosa
- PENDING: contract tests API v0
- PENDING: unit tests modulo decisiones
- PENDING: integration test checkin -> decision -> dashboard
- PASS: guard test migraciones limitadas a prefijo `sara_`
- PASS: smoke HTTPS `GET https://sara.codexa.uy/health`
- PASS: smoke webhook fuera de alcance responde `202` y descarta sin procesar

## Pipeline modular (TASK-20260602-004)
- PASS: coarseClassifier retorna esqueleto con schema version v1
- PASS: coarseClassifier preserva traceId
- PASS: coarseClassifier acepta sessionContext
- PASS: moduleIntentClassifier retorna action "none" con missingData
- PASS: moduleIntentClassifier preserva module de entrada
- PASS: moduleRouter rechaza modulo no registrado como no ejecutable
- PASS: moduleRouter rechaza modulo "unknown"
- PASS: moduleRouter rechaza modulo "daily-log"
- PASS: moduleRouter rechaza modulo "session-context" no registrado
- PASS: actionExecutor retorna "skipped" sin modulos de dominio
- PASS: actionExecutor retorna "needs_confirmation" cuando requiresConfirmation=true
- PASS: actionExecutor preserva traceId
- PASS: intentConfidenceSufficient retorna true con confidence >= 0.75 y sin missingData
- PASS: intentConfidenceSufficient retorna false con confidence < 0.75
- PASS: intentConfidenceSufficient retorna false con missingData no vacio
- PASS: responseComposer retorna schema v1 con traceId
- PASS: responseComposer informa missingData
- PASS: responseComposer informa confianza baja
- PASS: responseComposer informa needs_confirmation
- PASS: responseComposer informa skipped
- PASS: responseComposer informa executed
- PASS: responseComposer informa failed con mensaje de error

## Modulo notes (TASK-20260602-005)
- PASS: notesModule.create acepta input valido con noteId y eventId
- PASS: notesModule.create rechaza content vacio
- PASS: notesModule.create rechaza content solo espacios
- PASS: notesModule.create rechaza noteType invalido
- PASS: notesModule.create acepta los 6 noteType validos
- PASS: notesModule.create propaga error del repositorio
- PASS: notesModule.create pasa todos los campos al repositorio
- PASS: notesStore llama sara_create_note con parametros correctos
- PASS: notesStore retorna failed en error de RPC
- PASS: notesStore envia null para campos opcionales indefinidos
- PASS: moduleRouter marca notes.create ejecutable tras registerModule
- PASS: moduleRouter rechaza accion no registrada en modulo registrado
- PASS: actionExecutor despacha a handler notes.create y devuelve result
- PASS: actionExecutor retorna skipped para accion no registrada en modulo con handler
- PASS: actionExecutor no despacha si requiresConfirmation=true aunque haya handler
- PASS: moduleIntentClassifier detecta nota: y extrae content
- PASS: moduleIntentClassifier detecta guarda una nota:
- PASS: moduleIntentClassifier detecta anota esto:
- PASS: moduleIntentClassifier retorna missingData sin content
- PASS: moduleIntentClassifier no detecta notes.create en modulo unknown
- PASS: moduleIntentClassifier no detecta notes.create en daily-log
- PASS: moduleIntentClassifier sin falso positivo en mensajes no-note
- PASS: migrationGuard sigue pasando con nuevos objetos sara_events y sara_notes
- PASS: actionExecutor bloquea notes.create cuando content esta ausente
- PASS: actionExecutor bloquea notes.create cuando content es string vacio
- PASS: actionExecutor bloquea notes.create cuando content es solo espacios
- PASS: actionExecutor bloquea notes.create cuando content no es string
- PASS: actionExecutor no bloquea modulos no-notes sin content
- PASS: responseComposer confirma ejecucion solo si existe noteId o eventId
- PASS: responseComposer no confirma executed sin evidencia

## Evidencia local 2026-06-02
- `npm run typecheck`: PASS
- `npm test`: PASS (7 tests)
- `npm test`: PASS (8 tests luego de hardening del worker)
- `npm run build`: PASS
- `npm audit --audit-level=high`: PASS (0 vulnerabilidades)
- `npm run typecheck`: PASS (TASK-20260602-004)
- `npm test`: PASS (33 tests, TASK-20260602-004)
- `npm run build`: PASS (TASK-20260602-004)
- `npm run typecheck`: PASS (TASK-20260602-005)
- `npm test`: PASS (55 tests, TASK-20260602-005)
- `npm run build`: PASS (TASK-20260602-005)
- `npm run typecheck`: PASS (fix TASK-20260602-005)
- `npm test`: PASS (62 tests, fix TASK-20260602-005)
- `npm run build`: PASS (fix TASK-20260602-005)
