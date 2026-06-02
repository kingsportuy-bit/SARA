# PROTOCOLO_ACTUALIZAR_OBJETIVO.md - SARA

## Cuando se usa
- Cambio de direccion del producto.
- Cambio de prioridad estructural.
- Cambio de regla madre o principio de arquitectura.

## Flujo
1. Operador define nuevo objetivo de negocio.
2. Orquestador traduce impacto tecnico.
3. Actualizar en orden:
   - `docs/BIBLIA.md`
   - `docs/SYSTEM.md`
   - `docs/BUSINESS.md`
   - `docs/CONTRATOS.md` (si aplica)
   - `docs/INICIAL.md`
   - `docs/biblioteca/README.md` y fichas afectadas
4. Registrar entrada de gobernanza en `docs/CHANGELOG.md`.
5. Crear o repriorizar tasks en `docs/TASKS/`.

## Regla
No ejecutar implementacion grande hasta cerrar esta actualizacion documental.
