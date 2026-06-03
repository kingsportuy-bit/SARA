# MODULE_ROADMAP.md - SARA

## Objetivo
Definir el orden de construccion de modulos de SARA para que cada nueva task tenga contexto, dependencias y limites claros.

Este documento evita que el roadmap viva en memoria del hilo.

## Reglas del roadmap
- Un modulo nuevo solo se implementa con task aprobada.
- Cada modulo debe tener contratos de entrada/salida.
- Cada accion debe tener tests propios y regresion de modulos previos.
- Cada cambio de estado debe emitir evento trazable en `sara_events`.
- Cada tabla nueva debe estar autorizada en `docs/ENTITY_CATALOG.md`.
- En DB compartida solo se tocan objetos con prefijo `sara_`.
- El LLM puede clasificar o redactar; no ejecuta acciones.
- Nunca se confirma una accion sin evidencia real.

## Estado actual

### 1. `notes` - productivo
Estado: DONE + DEPLOYED + VALIDATED

Acciones:
- `notes.create`
- `notes.list`
- `notes.search`

Sirve para:
- capturar observaciones, ideas, aprendizajes, problemas, riesgos y mejoras;
- consultar ultimas notas;
- buscar notas por texto.

No sirve para:
- editar notas;
- borrar notas;
- vincular notas a areas/proyectos de forma avanzada.

Tablas/eventos:
- `sara_notes`
- `sara_events`
- `note_created`

### 2. `tasks` - productivo
Estado: DONE + DEPLOYED + VALIDATED

Acciones:
- `tasks.create`
- `tasks.list`
- `tasks.complete`

Sirve para:
- crear tareas pendientes simples;
- listar tareas pendientes;
- completar tareas por posicion o match seguro.

No sirve para:
- recordatorios;
- calendario;
- recurrencias;
- prioridad inteligente;
- dependencias entre tareas.

Tablas/eventos:
- `sara_tasks`
- `sara_events`
- `task_created`
- `task_completed`

## Proximo orden recomendado

### 3. `session-context`
Estado: NEXT_RECOMMENDED

Proposito:
- recordar contexto conversacional efimero;
- resolver referencias como "la anterior", "esa", "la segunda";
- manejar confirmaciones pendientes;
- mejorar acciones que dependen del turno anterior.

Por que va ahora:
- `notes` y `tasks` ya funcionan.
- `tasks.complete` por posicion usa lista actual, pero no memoria conversacional.
- Antes de recordatorios o flujos mas largos conviene tener contexto seguro.

Acciones/funciones MVP sugeridas:
- `session-context.get`
- `session-context.set-focus`
- `session-context.clear`
- `confirmation.request`
- `confirmation.resolve`

Tabla autorizable:
- `sara_session_contexts`

Eventos esperados:
- `session_context_started`
- `session_context_updated`
- `session_context_cleared`
- `confirmation_requested`
- `confirmation_resolved`

No incluir todavia:
- memoria permanente;
- preferencias complejas;
- resumen automatico largo;
- embeddings;
- RAG.

### 4. `reminders`
Estado: PLANNED_AFTER_SESSION_CONTEXT

Proposito:
- convertir tareas o mensajes en recordatorios temporales.

Por que depende de `session-context`:
- necesita resolver referencias y confirmaciones con seguridad;
- implica tiempo, worker programado y riesgo de prometer avisos que no se ejecuten.

Acciones MVP sugeridas:
- `reminders.create`
- `reminders.list`
- `reminders.cancel`
- worker de disparo

Tabla autorizable:
- `sara_reminders`

No incluir todavia:
- calendario externo;
- recurrencias complejas;
- notificaciones multicanal;
- optimizacion inteligente de horarios.

### 5. `daily-log`
Estado: PLANNED

Proposito:
- registrar estado diario, energia, foco, sueno, intencion y cierre del dia.

Acciones MVP sugeridas:
- `daily-log.morning`
- `daily-log.evening`
- `daily-log.summary`

Tabla autorizable:
- `sara_daily_log`

No incluir todavia:
- analitica avanzada;
- recomendaciones medicas;
- score complejo de productividad.

### 6. `areas`
Estado: PLANNED

Proposito:
- agrupar notas, tareas y futuros objetivos por areas de vida o negocio.

Acciones MVP sugeridas:
- `areas.create`
- `areas.list`
- `areas.archive`
- asociar nota/tarea a area

Tabla autorizable:
- `sara_areas`

No incluir todavia:
- proyectos complejos;
- permisos por area;
- dashboards avanzados.

### 7. `objectives`
Estado: FUTURE

Proposito:
- manejar objetivos de mediano/largo plazo.

Depende de:
- `areas`
- `tasks`
- `daily-log`

Tabla autorizable:
- `sara_objectives`

No incluir todavia:
- OKRs avanzados;
- scoring automatico;
- planes largos generados por LLM sin aprobacion.

### 8. `plans`
Estado: FUTURE

Proposito:
- convertir objetivos en planes accionables.

Depende de:
- `objectives`
- `tasks`
- `session-context`

Tabla autorizable:
- `sara_plans`

No incluir todavia:
- automatizacion sin confirmacion;
- cambios masivos de tareas;
- dependencias complejas.

### 9. `protocols`
Estado: FUTURE

Proposito:
- aplicar reglas personales de decision y actuacion.

Depende de:
- datos suficientes de `daily-log`, `tasks`, `notes`, `areas` y `objectives`.

Tabla autorizable:
- `sara_protocols`

No incluir todavia:
- decisiones automaticas de alto impacto;
- reglas opacas sin trazabilidad;
- recomendaciones sin evidencia.

## Orden resumido
1. `notes` - listo.
2. `tasks` - listo.
3. `session-context` - siguiente recomendado.
4. `reminders` - despues de contexto.
5. `daily-log` - registro diario.
6. `areas` - agrupacion transversal.
7. `objectives` - objetivos.
8. `plans` - planes.
9. `protocols` - reglas avanzadas.

## Criterio para pasar al siguiente modulo
- El modulo actual esta desplegado.
- El modulo actual fue probado desde Chatwoot.
- Hay evidencia en DB y eventos.
- `npm run typecheck`, `npm test` y `npm run build` pasan.
- La task esta marcada DONE.
- `docs/CONTRATOS.md`, `docs/ENTITY_CATALOG.md`, `docs/TEST_SUITE.md` y `docs/CHANGELOG.md` estan actualizados.
- Codex Orquestador reviso scope creep y aprobo.

## Criterio para pausar el roadmap
- Aparece una regresion productiva.
- Una accion confirma sin evidencia.
- Una migracion toca objetos fuera de `sara_`.
- Un modulo mezcla responsabilidades de capas.
- El usuario cambia prioridad funcional.

## Nota para opencode
opencode no decide el siguiente modulo.

opencode solo implementa la task aprobada por Codex Orquestador.

Si este roadmap contradice la task activa, opencode debe bloquearse y pedir decision.
