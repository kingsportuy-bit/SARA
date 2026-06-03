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
7. `docs/ENTITY_CATALOG.md`
8. `docs/INFORME_ANALISIS_ARQUITECTURA_FEATURES.md`
9. `docs/agents/COMMUNICATION_PROTOCOL.md`
10. La task asignada en `docs/TASKS/`

Regla de sesion:
- opencode debe leer `docs/INICIAL.md` al comenzar cada nueva sesion de trabajo.
- la task asignada no reemplaza `docs/INICIAL.md`; la task define el alcance puntual y `INICIAL.md` define el contexto operativo real.

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

## Regla de revision de Codex
Codex no aprueba el diff de opencode a ciegas.

Antes de aceptar una entrega, Codex debe:
- ejecutar `npm run typecheck`
- ejecutar `npm test`
- leer el diff completo
- revisar especificamente que opencode no haya completado mas alcance del pedido por iniciativa propia
- verificar que no haya creado tablas, modulos o features de dominio por adelantado
- verificar que no haya escrituras fuera del writer canonico
- verificar que no haya logica de negocio en ingress o clasificadores
- verificar que toda tabla o evento de trazabilidad tenga `schema_version`
- verificar que no se tocaron objetos ajenos a `sara_`
- verificar que no se expusieron secretos

Riesgo principal a vigilar:
- opencode puede tender a hacer "un poco mas" porque parece conveniente.
- Ese excedente debe rechazarse aunque funcione.
- En `TASK-20260602-004`, cualquier creacion anticipada de `sara_notes`, `sara_tasks`, `sara_plans`, `sara_objectives` u otra tabla/modulo de dominio queda fuera de alcance.
