# TEST_SUITE.md - SARA

## Regla permanente
- Cada funcionalidad o fix incluye tests propios del modulo.
- Antes de integrar se ejecutan tests del modulo y regresion existente.
- Un modulo nuevo no se cierra si rompe comportamiento previo no incluido explicitamente en su task.
- Toda prueba registra evidencia trazable.
- Toda migracion valida que solo afecta objetos con prefijo `sara_`.

## Inventario inicial
- PASS: webhook Chatwoot acepta solo cuenta `6`, inbox `44`, conversacion `20`
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

## Evidencia local 2026-06-02
- `npm run typecheck`: PASS
- `npm test`: PASS (7 tests)
- `npm run build`: PASS
- `npm audit --audit-level=high`: PASS (0 vulnerabilidades)
