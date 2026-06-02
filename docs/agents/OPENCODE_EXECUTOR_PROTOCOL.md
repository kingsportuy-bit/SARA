# OPENCODE_EXECUTOR_PROTOCOL.md - SARA

## Objetivo
Definir como trabaja opencode como agente ejecutor de trabajo pesado en SARA.

## Rol de opencode
opencode es un agente ejecutor.

Puede:
- Implementar tareas ya planificadas y aprobadas.
- Crear o modificar codigo dentro del alcance indicado.
- Crear o modificar tests dentro del alcance indicado.
- Actualizar documentacion operativa solicitada.
- Ejecutar validaciones indicadas.
- Hacer commit cuando la tarea lo exige.

No puede:
- Elegir la feature a construir.
- Cambiar arquitectura sin instruccion explicita.
- Ampliar alcance por criterio propio.
- Tocar tablas, funciones, vistas, triggers, politicas o datos ajenos a `sara_`.
- Cambiar credenciales, secretos o infraestructura sin instruccion explicita.
- Modificar otras apps del VPS.
- Confirmar acciones si no fueron ejecutadas y verificadas.
- Resolver ambiguedades tomando decisiones ocultas.

## Flujo de trabajo
1. Nosotros definimos la task, contrato y criterio de cierre.
2. opencode lee la task y documentos obligatorios.
3. opencode implementa exactamente el alcance aprobado.
4. opencode ejecuta las validaciones indicadas.
5. opencode actualiza documentacion y evidencia.
6. opencode hace commit con el formato definido.
7. Nosotros revisamos el commit y decidimos aprobar, corregir o pedir cambios.

## Documentos obligatorios antes de ejecutar
opencode debe leer, en este orden:
1. `docs/INICIAL.md`
2. `docs/LEY_ARQUITECTURA.md`
3. `docs/AGENTS.md`
4. `docs/SECURITY.md`
5. `docs/CONTRATOS.md`
6. `docs/DEPLOY.md`
7. `docs/agents/COMMUNICATION_PROTOCOL.md`
8. La task asignada en `docs/TASKS/`

## Regla de no decision
Si falta informacion, opencode debe detenerse y registrar bloqueo.

Formato obligatorio de bloqueo:

```text
BLOQUEO
Task:
Falta:
Impacto:
Decision requerida:
Opciones seguras:
```

No debe inventar supuestos para avanzar si el supuesto cambia arquitectura, datos, seguridad, contratos, deploy o comportamiento de usuario.

## Formato de encargo para opencode
Cada tarea entregada a opencode debe incluir:

```text
Task ID:
Objetivo:
Contexto:
Alcance permitido:
Alcance prohibido:
Contratos de entrada/salida:
Archivos esperados:
Tests obligatorios:
Validaciones obligatorias:
Documentacion a actualizar:
Commit esperado:
Criterio de aceptacion:
Si falta informacion:
```

## Formato de entrega de opencode
opencode debe dejar evidencia con este formato:

```text
ENTREGA
Task:
Commit:
Cambios realizados:
Tests ejecutados:
Resultado de tests:
Documentos actualizados:
Riesgos residuales:
Pendientes:
```

## Commits
Formato obligatorio:

```text
<tipo>(TASK-ID): descripcion breve
```

Ejemplos:
- `feat(TASK-20260602-003): agregar modulo de tareas personales`
- `test(TASK-20260602-003): cubrir contrato de tareas personales`
- `fix(TASK-20260602-003): corregir validacion de fecha`

## Deploy
opencode no despliega a VPS salvo instruccion explicita.

Si se le autoriza deploy, debe seguir `docs/DEPLOY.md`:
1. commit y push primero.
2. actualizar `/opt/sara` desde Git.
3. desplegar sin tocar otras apps.
4. validar health, logs, smoke test y evidencia.

## Checklist antes de commit
- [ ] La task existe y esta aprobada.
- [ ] No se mezclaron responsabilidades de capas.
- [ ] Cada modulo nuevo tiene contrato claro.
- [ ] Cada cambio funcional tiene test.
- [ ] La regresion indicada fue ejecutada.
- [ ] No se tocaron objetos DB ajenos a `sara_`.
- [ ] No se expusieron secretos.
- [ ] La documentacion requerida fue actualizada.
- [ ] La entrega incluye evidencia.

## Checklist para revision nuestra
- [ ] El commit corresponde al alcance.
- [ ] No hay decisiones no solicitadas.
- [ ] Tests y evidencias son suficientes.
- [ ] La arquitectura sigue modular.
- [ ] La trazabilidad queda completa.
- [ ] Se acepta, se corrige o se rechaza el trabajo.
