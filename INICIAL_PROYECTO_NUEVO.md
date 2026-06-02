# INICIAL_PROYECTO_NUEVO.md

## Uso

Si el operador dice "lee INICIAL_PROYECTO_NUEVO.md", este archivo es la unica
puerta de entrada para crear un proyecto nuevo desde cero.

No analizar ni crear archivos fuera de este protocolo hasta terminar los pasos.

---

## Objetivo

Crear un proyecto nuevo, generico y operativo para trabajo multi-agente,
orientado a microservicios, con trazabilidad, testing, seguridad, git y
protocolos documentales completos.

Fuente canonica de bootstrap:
- `docs/VIBECODING_BOOTSTRAP_V2.md`

---

## Flujo obligatorio

1. Leer completo `docs/VIBECODING_BOOTSTRAP_V2.md`.
2. Hacer al operador las preguntas minimas de bootstrap.
3. Esperar respuestas completas.
4. Crear estructura de carpetas y archivos base.
5. Completar templates con los datos del operador.
6. Verificar consistencia documental y operativa.
7. Entregar resumen de lo creado y lo pendiente.

---

## Preguntas minimas al operador (obligatorias)

Hacer estas preguntas antes de crear archivos:

1. Nombre del proyecto.
2. Objetivo funcional en 1-2 lineas.
3. Regla madre no negociable.
4. Stack tecnico (backend, frontend, DB, infra).
5. Agentes que participan (nombre, rol, permisos).
6. Modulos/servicios iniciales.
7. Entornos objetivo (`dev`, `staging`, `prod`).
8. Secretos a declarar (solo nombres, no valores).
9. Flujo de deploy actual (si existe) o confirmar que se define ahora.
10. Si usa Supabase (si/no).

Si falta alguna respuesta critica, pedirla antes de continuar.

---

## Regla de ejecucion

No improvisar estructura ni formatos.
Usar los templates y protocolos de `docs/VIBECODING_BOOTSTRAP_V2.md`.

Crear como minimo:
- docs base,
- protocolo de agentes,
- tasks,
- trazabilidad,
- testing documental,
- seguridad,
- protocolos de objetivo y cierre de sesion.

---

## Criterio de finalizacion

El setup inicial se considera terminado solo si:

- La estructura de carpetas esta creada.
- Los documentos obligatorios existen y no tienen placeholders sin resolver.
- `INICIAL.md` tiene estado, stack, mapa de lectura y task activa/proxima.
- `AGENTS.md` y canales de comunicacion estan listos.
- `SECURITY.md`, `CHANGELOG.md`, `TEST_SUITE.md`, `REGRESSION_CASES.md`,
  `ERROR_REGISTRY.md` y `BACKLOG.md` estan creados.
- Si aplica Supabase: reglas de RLS, entornos y migraciones documentadas.

---

## Respuesta obligatoria al terminar

Al terminar el setup, responder:

1. Archivos creados.
2. Campos pendientes de completar por falta de datos.
3. Siguiente accion recomendada (crear primera task).

Si todavia no hay una task concreta, cerrar diciendo exactamente:

"Proyecto inicial creado. Listo para arrancar la primera task."
