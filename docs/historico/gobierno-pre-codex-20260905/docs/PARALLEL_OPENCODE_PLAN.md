# PARALLEL_OPENCODE_PLAN.md - SARA

## Objetivo

Permitir trabajo paralelo de varios opencode sin romper la arquitectura ni generar conflictos innecesarios.

## Regla principal

Las tasks paralelas solo implementan core aislado.

No pueden tocar:

- `src/modules/coarseClassifier.ts`
- `src/modules/moduleIntentClassifier.ts`
- `src/modules/moduleRouter.ts`
- `src/modules/actionExecutor.ts`
- `src/modules/responseComposer.ts`
- `src/workers/bufferProcessor.ts`
- `src/api/server.ts`

La integracion al pipeline se hace despues, en una unica task secuencial.

## Estado de base

Ya productivo:

1. `notes`
2. `tasks`
3. `session-context`
4. `reminders`
5. `daily-log`
6. `areas`

En cierre:

7. `objectives`

Pendiente de prueba productiva final:

- crear objetivo
- listar objetivos
- crear tarea
- asociar tarea a objetivo
- verificar DB/eventos/contexto

## Tasks paralelas preparadas

### opencode A

Task:

```text
docs/TASKS/TASK-20260603-014.md
```

Modulo:

```text
routines
```

Responsabilidad:

- rutinas fijas;
- pasos horarios;
- activar/pausar/archivar rutina;
- sin recordatorios automaticos;
- sin sesiones reales.

### opencode B

Task:

```text
docs/TASKS/TASK-20260603-015.md
```

Modulo:

```text
workouts
```

Responsabilidad:

- sesiones reales de gym;
- registrar ejercicios/series/reps/peso;
- terminar/cancelar sesion;
- sin timers;
- sin progreso avanzado.

### opencode C

Task:

```text
docs/TASKS/TASK-20260603-016.md
```

Modulo:

```text
timers
```

Responsabilidad:

- temporizadores cortos;
- descansos de gym;
- claim de vencidos;
- sin dispatcher productivo;
- sin enviar mensajes Chatwoot.

### opencode D

Task:

```text
docs/TASKS/TASK-20260603-017.md
```

Modulo:

```text
progress
```

Responsabilidad:

- consultas read-only de progreso;
- progreso por ejercicio;
- progreso por objetivo;
- resumen general;
- sin escribir DB;
- sin crear tablas.

### opencode E

Task:

```text
docs/TASKS/TASK-20260603-018.md
```

Modulo:

```text
plans
```

Responsabilidad:

- planes manuales;
- pasos de plan;
- completar pasos;
- sin crear tareas automaticas;
- sin LLM generando planes.

### opencode F

Task:

```text
docs/TASKS/TASK-20260603-019.md
```

Modulo:

```text
protocols
```

Responsabilidad:

- reglas personales;
- activar/archivar protocolos;
- evaluacion deterministica read-only;
- sin ejecutar acciones automaticas;
- sin LLM decidiendo.

## Task secuencial reservada

No ejecutar hasta que Codex Orquestador revise todas las tasks core:

```text
docs/TASKS/TASK-20260603-020.md
```

Responsabilidad:

- integrar todos los modulos al pipeline Chatwoot;
- registrar handlers;
- actualizar clasificadores;
- actualizar responseComposer;
- actualizar session-context;
- agregar tests end-to-end del worker.

## Prompt base para cada opencode

Usar este formato y cambiar solo el archivo de task:

```text
Lee docs/INICIAL.md.
Luego lee docs/PARALLEL_OPENCODE_PLAN.md.
Luego lee docs/TASKS/TASK-20260603-014.md.

Ejecuta exactamente esa task.
No tomes decisiones de arquitectura.
No agregues features no pedidas.
No toques archivos compartidos del pipeline.
No hagas deploy.
No cambies secretos.
No cambies scope Chatwoot.
No crees objetos DB sin prefijo sara_.

Al terminar:
- ejecuta npm run typecheck
- ejecuta npm test
- ejecuta npm run build
- actualiza solo la documentacion indicada por la task
- haz un commit con el formato obligatorio de la task
- reporta resumen, validaciones y commit

Si falta informacion, detente y reporta BLOQUEO.
```

## Riesgo principal

El riesgo no es tecnico; es de alcance.

Un opencode puede intentar completar mas de lo pedido.

Revision obligatoria Codex:

- verificar que no haya tocado pipeline compartido;
- verificar que no haya creado entidades fuera de la task;
- verificar que no haya creado acciones automaticas;
- verificar que no haya confirmado acciones sin evidencia;
- verificar que no haya inventado tablas sin prefijo `sara_`;
- verificar que no haya mezclado responsabilidades de capas.

## Orden recomendado de merge

Si todas las tasks vuelven correctas:

1. `routines`
2. `workouts`
3. `timers`
4. `progress`
5. `plans`
6. `protocols`
7. `pipeline integration`

Si una task rompe tests o toca archivos prohibidos, no se mergea hasta correccion.

