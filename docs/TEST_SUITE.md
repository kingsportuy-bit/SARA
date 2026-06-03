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

## Evidencia local 2026-06-02
- `npm run typecheck`: PASS
- `npm test`: PASS (7 tests)
- `npm test`: PASS (8 tests luego de hardening del worker)
- `npm run build`: PASS
- `npm audit --audit-level=high`: PASS (0 vulnerabilidades)
- `npm run typecheck`: PASS (TASK-20260602-004)
- `npm test`: PASS (33 tests, TASK-20260602-004)
- `npm run build`: PASS (TASK-20260602-004)
