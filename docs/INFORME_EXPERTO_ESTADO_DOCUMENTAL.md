# INFORME_EXPERTO_ESTADO_DOCUMENTAL.md - SARA

Fecha: 2026-06-02
Estado: DOCUMENTACION PRE-OPENCODE ACTUALIZADA

## Objetivo
Responder a la correccion experta y dejar evidencia de que los documentos necesarios para entregar trabajo a opencode existen o fueron creados.

## Resumen
Se verifico la documentacion actual y se completaron los faltantes reales.

Resultado:
- `ENTITY_CATALOG.md`: no existia; fue creado.
- `OPENCODE_EXECUTOR_PROTOCOL.md`: ya existia; fue reforzado.
- `TASK-20260602-004.md`: no existia; fue creada como primera task cerrada para opencode.
- `INICIAL.md`: existia, pero estaba desactualizado; fue actualizado como puerta de entrada real para nuevos hilos.

## 1. `ENTITY_CATALOG.md`

Estado: creado.

Ruta:
- `docs/ENTITY_CATALOG.md`

Contenido actual:
- `sara_events`
- `sara_session_contexts`
- `sara_daily_log`
- `sara_areas`
- `sara_notes`

Cada entidad incluye:
- proposito
- owner
- campos exactos
- invariantes
- eventos que emite

Decision aplicada:
- solo Fase A minima.
- no se documentaron entidades futuras para evitar que opencode implemente mas alcance del aprobado.

## 2. `OPENCODE_EXECUTOR_PROTOCOL.md`

Estado: existia y fue reforzado.

Ruta:
- `docs/agents/OPENCODE_EXECUTOR_PROTOCOL.md`

Ya cubria:
- rol de opencode
- que puede hacer
- que no puede hacer
- regla de no decision
- formato de encargo
- formato de entrega
- commits
- deploy solo con instruccion explicita

Se agrego:
- regla de sesion: opencode debe leer `docs/INICIAL.md` al comenzar cada nueva sesion.
- aclaracion: la task asignada no reemplaza `INICIAL.md`.
- lectura obligatoria de `ENTITY_CATALOG.md`.
- lectura obligatoria de `INFORME_ANALISIS_ARQUITECTURA_FEATURES.md`.
- regla de revision de Codex: no aprobar diff a ciegas.

## 3. Primera task cerrada para opencode

Estado: creada.

Ruta:
- `docs/TASKS/TASK-20260602-004.md`

Objetivo:
- implementar el esqueleto modular de comprension y respuesta sin crear features de dominio complejas.

Incluye:
- estado `APPROVED`
- owner `opencode`
- alcance permitido
- alcance prohibido
- validaciones obligatorias
- documentos obligatorios
- contratos TypeScript inline
- criterio de aceptacion
- formato de bloqueo
- commit esperado

Decision aplicada:
- opencode no debe implementar `notes.create` todavia.
- opencode no debe crear tablas de dominio en esta task.
- opencode solo deja el esqueleto: clasificacion, routing, action-executor, writer y response-composer.

## 4. `INICIAL.md` como puerta de entrada

Estado: existia, pero estaba desactualizado; fue actualizado.

Ruta:
- `docs/INICIAL.md`

Antes:
- mencionaba preparacion de entorno.
- mencionaba task vieja.
- no incluia entity catalog, informe experto ni task opencode.
- no reflejaba Chatwoot real `7/45/85`.

Ahora incluye:
- estado real del sistema.
- flujo vertical bootstrap operativo.
- alcance Chatwoot vigente `account=7`, `inbox=45`, `conversation=85`.
- ley primera de arquitectura.
- regla de no mezclar capas.
- mapa de lectura actualizado.
- forma de trabajo con opencode.
- task activa `TASK-20260602-004`.

Respuesta directa:
- Si se abre un nuevo hilo y se entrega `docs/INICIAL.md`, ya tiene el contexto real y apunta a los documentos correctos.
- Para maxima seguridad, el nuevo hilo debe leer `INICIAL.md` y seguir el mapa de lectura que contiene.

## 5. Que debe leer opencode en cada sesion

opencode debe leer siempre:

1. `docs/INICIAL.md`
2. `docs/LEY_ARQUITECTURA.md`
3. `docs/AGENTS.md`
4. `docs/SECURITY.md`
5. `docs/CONTRATOS.md`
6. `docs/DEPLOY.md`
7. `docs/ENTITY_CATALOG.md`
8. `docs/INFORME_ANALISIS_ARQUITECTURA_FEATURES.md`
9. `docs/agents/COMMUNICATION_PROTOCOL.md`
10. la task asignada en `docs/TASKS/`

La task no reemplaza `INICIAL.md`.

Motivo:
- `INICIAL.md` contiene estado operativo real.
- la task contiene alcance puntual.
- `ENTITY_CATALOG.md` evita inventar entidades.
- el informe de analisis evita decisiones contrarias a la arquitectura revisada.

## 5.1 Que debe leer Codex Orquestador en un hilo nuevo

Codex Orquestador tambien debe empezar por:

1. `docs/INICIAL.md`
2. seguir el mapa de lectura que `INICIAL.md` indique segun la tarea

Diferencia de rol:
- Codex Orquestador lee para planificar, decidir contratos y revisar.
- opencode lee para ejecutar una task ya aprobada.

## 6. Regla Codex -> opencode

Codex define:
- contrato publico
- alcance permitido
- alcance prohibido
- criterio de aceptacion
- validaciones

opencode decide:
- implementacion interna dentro del contrato

opencode no decide:
- feature
- arquitectura
- nuevas entidades fuera del catalogo
- ampliacion de alcance
- deploy
- secretos

## 7. Regla de revision posterior

Codex no aprueba el trabajo de opencode a ciegas.

Debe:
- ejecutar `npm run typecheck`
- ejecutar `npm test`
- ejecutar `npm run build`
- leer el diff completo
- revisar que opencode no haya hecho mas de lo pedido
- rechazar tablas, modulos o features de dominio creadas por adelantado
- buscar escrituras fuera del writer canonico
- buscar logica de negocio en ingress o clasificadores
- buscar tablas/eventos sin `schema_version`
- verificar que no haya objetos DB ajenos a `sara_`
- verificar que no haya secretos

Riesgo principal no tecnico:
- opencode puede intentar completar mas de lo solicitado.
- Codex debe revisar especificamente que no aparezcan `sara_notes`, `sara_tasks`, `sara_plans`, `sara_objectives` u otras tablas/modulos de dominio antes de una task que los autorice.
- Si aparece trabajo adelantado, se pide correccion aunque los tests pasen.

## 8. Estado final

Con estos documentos, SARA queda lista para entregar la primera task a opencode.

No se cambio la arquitectura.

Se completo la documentacion previa necesaria para evitar que opencode tome decisiones que corresponden al orquestador.

## 9. Pendientes no bloqueantes

- Normalizar documentos historicos que aun mencionan el scope viejo `6/44/20`.
- Activar firma HMAC de Chatwoot cuando se consiga `CHATWOOT_WEBHOOK_SECRET`.
- Decidir si se commitean o se mantienen solo locales los archivos de insumo `MASTER.md`, `FEATURES.md` y `correcion_experto.md`.
