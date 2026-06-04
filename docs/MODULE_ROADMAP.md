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

### 3. `session-context` - productivo
Estado: DONE + DEPLOYED + VALIDATED

Proposito:
- recordar contexto conversacional efimero;
- resolver referencias como "la anterior", "esa", "la segunda";
- manejar confirmaciones pendientes;
- mejorar acciones que dependen del turno anterior.

Resultado actual:
- `notes` y `tasks` ya funcionan.
- `tasks.complete` ya puede resolver referencias simples como "esa" usando foco conversacional.
- Despues de completar una accion, el foco se limpia para no arrastrar acciones viejas.
- La prueba productiva por Chatwoot creo una tarea y luego la completo con "completar esa".

Acciones/funciones MVP:
- `session-context.get`
- `session-context.set-focus`
- `session-context.clear`

Tabla:
- `sara_session_contexts`

Eventos:
- `session_context_started`
- `session_context_updated`

No incluye todavia:
- memoria permanente;
- confirmaciones pendientes avanzadas;
- embeddings;
- RAG.

### 4. `reminders` - productivo
Estado: DONE + DEPLOYED + VALIDATED

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

Resultado actual:
- La prueba productiva por Chatwoot creo `tomar agua` con `recordame en 2 minutos tomar agua`.
- El dispatcher envio `Recordatorio: tomar agua`.
- DB dejo el recordatorio en `status = sent`.
- `sara_events` registro `reminder_created` y `reminder_sent`.

Tabla autorizable:
- `sara_reminders`

Task:
- `docs/TASKS/TASK-20260603-010.md`

No incluir todavia:
- calendario externo;
- recurrencias complejas;
- notificaciones multicanal;
- optimizacion inteligente de horarios.

### 5. `daily-log`
Estado: DONE + DEPLOYED + VALIDATED

Proposito:
- registrar estado diario, energia, foco, sueno, intencion y cierre del dia.

Acciones MVP sugeridas:
- `daily-log.morning`
- `daily-log.evening`
- `daily-log.summary`

Tabla autorizable:
- `sara_daily_log`

Task:
- `docs/TASKS/TASK-20260603-011.md`

Resultado actual:
- La prueba productiva por Chatwoot registro morning con energia `7`, sueno `6.5` e intencion `terminar propuestas`.
- La prueba productiva por Chatwoot registro evening con cierre `termine propuestas y camine`.
- `resumen del dia` respondio con los datos guardados.
- DB dejo el registro en `sara_daily_log`.
- `sara_events` registro `daily_log_created` y `daily_log_evening_updated`.

No incluir todavia:
- analitica avanzada;
- recomendaciones medicas;
- score complejo de productividad.

### 6. `areas`
Estado: DONE + DEPLOYED + VALIDATED

Proposito:
- agrupar notas, tareas y futuros objetivos por areas de vida o negocio.

Acciones MVP sugeridas:
- `areas.create`
- `areas.list`
- `areas.archive`
- `areas.assign-note`
- `areas.assign-task`

Tabla autorizable:
- `sara_areas`

Task:
- `docs/TASKS/TASK-20260603-012.md`

Resultado actual:
- La prueba productiva por Chatwoot creo el area `salud`.
- `que areas tengo` listo el area activa `salud`.
- La prueba productiva creo la tarea `comprar vitaminas`.
- `asociar esa tarea al area salud` asigno la tarea al area usando session-context.
- DB dejo `sara_tasks.area_id` apuntando a `sara_areas.id`.
- `sara_events` registro `area_created`, `task_created` y `task_area_assigned`.

No incluir todavia:
- proyectos complejos;
- permisos por area;
- dashboards avanzados.

### 7. `objectives`
Estado: HOTFIX_DEPLOYED_PENDING_PRODUCTIVE_VALIDATION

Proposito:
- manejar objetivos de mediano/largo plazo.

Depende de:
- `areas`
- `tasks`
- `daily-log`

Tabla autorizable:
- `sara_objectives`

Acciones MVP sugeridas:
- `objectives.create`
- `objectives.list`
- `objectives.achieve`
- `objectives.archive`
- `objectives.assign-task`

Task:
- `docs/TASKS/TASK-20260603-013.md`

No incluir todavia:
- OKRs avanzados;
- scoring automatico;
- planes largos generados por LLM sin aprobacion.

### 8. `routines`
Estado: SPEC_PARALLEL_SAFE

Proposito:
- guardar rutinas fijas con pasos horarios.

Depende de:
- `areas`
- `objectives` opcional

Tabla autorizable:
- `sara_routines`
- `sara_routine_steps`

Acciones MVP sugeridas:
- `routines.create`
- `routines.list`
- `routines.activate`
- `routines.pause`
- `routines.archive`

Task:
- `docs/TASKS/TASK-20260603-014.md`

No incluir todavia:
- sesiones reales de gym;
- timers de descanso;
- recordatorios automaticos;
- progreso.

### 9. `workouts`
Estado: SPEC_PARALLEL_SAFE

Proposito:
- registrar sesiones reales de gym, ejercicios, series, reps, peso y notas.

Depende de:
- `routines` opcional para rutina guiada
- `objectives` opcional para objetivo de salud/fuerza

Tabla autorizable:
- `sara_workout_sessions`
- `sara_workout_sets`

Acciones MVP sugeridas:
- `workouts.start`
- `workouts.log-set`
- `workouts.finish`
- `workouts.cancel`
- `workouts.list`

Task:
- `docs/TASKS/TASK-20260603-015.md`

No incluir todavia:
- timers automaticos;
- recomendaciones de entrenamiento;
- progreso avanzado;
- cambios de rutina.

### 10. `timers`
Estado: SPEC_PARALLEL_SAFE

Proposito:
- manejar temporizadores cortos e interactivos, especialmente descansos de gym.

Depende de:
- `session-context`
- `workouts` para uso guiado final

Tabla autorizable:
- `sara_timers`

Acciones MVP sugeridas:
- `timers.start`
- `timers.cancel`
- `timers.claim-due`
- `timers.mark-fired`

Task:
- `docs/TASKS/TASK-20260603-016.md`

No incluir todavia:
- calendario externo;
- recurrencias;
- dispatcher productivo sin integracion testeada.

### 11. `progress`
Estado: SPEC_PARALLEL_SAFE

Proposito:
- consultar progreso derivado de datos guardados, especialmente gym y objetivos.

Depende de:
- `workouts`
- `daily-log`
- `tasks`
- `objectives`

Tabla autorizable:
- ninguna nueva en MVP

Acciones MVP sugeridas:
- `progress.workout`
- `progress.objective`
- `progress.summary`

Task:
- `docs/TASKS/TASK-20260603-017.md`

No incluir todavia:
- escritura de metricas;
- recomendaciones medicas/deportivas avanzadas;
- scoring automatico opaco.

### 12. `plans`
Estado: FUTURE

Proposito:
- convertir objetivos en planes accionables.

Depende de:
- `objectives`
- `tasks`
- `session-context`

Tabla autorizable:
- `sara_plans`
- `sara_plan_steps`

Task:
- `docs/TASKS/TASK-20260603-018.md`

No incluir todavia:
- automatizacion sin confirmacion;
- cambios masivos de tareas;
- dependencias complejas.

### 13. `protocols`
Estado: FUTURE

Proposito:
- aplicar reglas personales de decision y actuacion.

Depende de:
- datos suficientes de `daily-log`, `tasks`, `notes`, `areas` y `objectives`.

Tabla autorizable:
- `sara_protocols`

Task:
- `docs/TASKS/TASK-20260603-019.md`

No incluir todavia:
- decisiones automaticas de alto impacto;
- reglas opacas sin trazabilidad;
- recomendaciones sin evidencia.

### 14. `pipeline integration`
Estado: SPEC_SEQUENTIAL_ONLY

Proposito:
- integrar al pipeline Chatwoot los modulos core preparados en paralelo.

Depende de:
- `routines`
- `workouts`
- `timers`
- `progress`
- `plans`
- `protocols`

Task:
- `docs/TASKS/TASK-20260603-020.md`

Regla:
- no ejecutar en paralelo con las tasks core.
- solo iniciar despues de revision Codex de cada core.

## Orden resumido
1. `notes` - listo.
2. `tasks` - listo.
3. `session-context` - listo.
4. `reminders` - listo.
5. `daily-log` - listo.
6. `areas` - listo.
7. `objectives` - pendiente validacion productiva final.
8. `routines` - rutinas fijas.
9. `workouts` - sesiones de gym.
10. `timers` - descansos/temporizadores.
11. `progress` - progreso read-only.
12. `plans` - planes.
13. `protocols` - reglas avanzadas.
14. `pipeline integration` - integrar cores paralelos.

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
