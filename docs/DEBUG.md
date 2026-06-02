# DEBUG.md - SARA

## Flujo obligatorio
1. Capturar `trace_id`/`request_id` y evidencia.
2. Reconstruir input esperado vs output real.
3. Determinar alcance: puntual o estructural.
4. Diseñar fix con alcance correcto.
5. Aplicar fix en branch de task.
6. Ejecutar validaciones del servicio y del flujo.
7. Ejecutar deploy segun `docs/DEPLOY.md` (si aplica).
8. Correr smoke test post-deploy.
9. Registrar evidencia en `docs/CHANGELOG.md`.
10. Actualizar `docs/REGRESSION_CASES.md` y `docs/ERROR_REGISTRY.md` si aplica.

## Regla bloqueante
No se cierra bug sin evidencia reproducible de cierre.
