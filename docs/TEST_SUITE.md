# TEST_SUITE.md - SARA

## Regla permanente
- Cada funcionalidad o fix incluye tests propios del modulo.
- Antes de integrar se ejecutan tests del modulo y regresion existente.
- Un modulo nuevo no se cierra si rompe comportamiento previo no incluido explicitamente en su task.
- Toda prueba registra evidencia trazable.
- Toda migracion valida que solo afecta objetos con prefijo `sara_`.

## Inventario inicial
- PENDING: contract tests API v0
- PENDING: unit tests modulo decisiones
- PENDING: integration test checkin -> decision -> dashboard
- PENDING: guard test migraciones limitadas a prefijo `sara_`
