# VIBECODING_BOOTSTRAP.md


Leé VIBECODING_BOOTSTRAP.md completo.

Luego ejecutá esto en orden:

1. Creá toda la estructura de carpetas definida en sección 1.
2. Creá todos los archivos base con sus templates correspondientes 
   (secciones 14, 15, 18, 19).
3. Poblá INICIAL.md con este contexto:
   - Proyecto: <nombre>
   - Stack: <stack>
   - Objetivo inicial: <qué construimos primero>
4. Creá la primera task con estado SPEC para ese objetivo.
5. Reportá qué creaste y cuál es la task activa.

No hagas nada fuera de esta lista. No sugieras. No preguntes. Ejecutá.


## Objetivo

Bootstrap generico para crear proyectos multi-agente orientados a microservicios,
con foco en trazabilidad, testing, seguridad y gobernanza operativa.

Este documento define el sistema minimo para operar de forma repetible:
- con varios agentes en paralelo,
- con contratos entre servicios,
- con cierre documental despues de cada sesion,
- con evidencia para debug, deploy e incidentes.

---

## 1) Estructura minima recomendada

```text
/docs
  INICIAL.md
  ONBOARDING_AGENTE.md
  AGENTS.md
  BIBLIA.md
  LEY_ARQUITECTURA.md
  SYSTEM.md
  BUSINESS.md
  CONTRATOS.md
  DEBUG.md
  DEPLOY.md
  SECURITY.md
  CHANGELOG.md
  BACKLOG.md
  TEST_SUITE.md
  REGRESSION_CASES.md
  ERROR_REGISTRY.md
  INCIDENTS.md
  PROTOCOLO_ACTUALIZAR_OBJETIVO.md
  SESSION_CLOSE.md
  /agents
    COMMUNICATION_PROTOCOL.md
    COMMUNICATION_<AGENTE>.md
  /tasks
    TASK_TEMPLATE.md
    /closed
  /biblioteca
    README.md
    /modulos
    /capas
    /superficies
/services
  /<service-a>
  /<service-b>
/db
  /migrations
  /seeds
/infra
/scripts
/versions
```

---

## 2) Reglas base (no negociables)

1. `INICIAL.md` es la unica puerta de entrada para cualquier agente.
2. Toda documentacion se navega y actualiza desde `docs/biblioteca/README.md`.
3. Ningun cambio llega a prod sin validacion + evidencia + changelog.
4. Ningun secreto real se versiona en el repo.
5. Ningun agente ejecuta fuera de tarea formal `approved`.
6. Toda sesion cierra con sincronizacion de estado tecnico y documental.

---

## 3) Modelo operativo multi-agente

### Roles minimos

- Operador: decide negocio, prioridad y riesgo aceptable.
- Orquestador IA: arquitectura, integracion, revision, deploy.
- Agentes ejecutores: implementan bajo spec, no aprueban.

### Canales

- Protocolo comun: `docs/agents/COMMUNICATION_PROTOCOL.md`.
- Un canal por agente: `docs/agents/COMMUNICATION_<AGENTE>.md`.

### Estado de tareas

`IDEA -> SPEC -> APPROVED -> IN_PROGRESS -> REVIEW -> DONE` (+ `BLOCKED`).

### Regla de integracion

Ningun agente ejecutor integra directo en produccion.
Entrega para revision; orquestador valida e integra.

---

## 4) Arquitectura para microservicios

### Principios

- Cada microservicio tiene responsabilidad unica.
- Comunicacion entre servicios solo por API/eventos/colas documentadas.
- Sin acoplamiento a internals de otro servicio.
- Contratos versionados (request/response/event schemas).

### Contratos obligatorios por servicio

En `docs/CONTRATOS.md` cada servicio define:
- endpoints/eventos publicos,
- payload de entrada/salida,
- codigos de error controlados,
- consumidores/productores,
- version de contrato.

### Superficies

Documentar en `docs/biblioteca/superficies/`:
- API gateway,
- panel web,
- workers,
- webhooks,
- cron jobs.

---

## 5) Trazabilidad (refuerzo)

### Niveles de trazabilidad

1. Trazabilidad por request/evento:
- `trace_id` global,
- `request_id` por salto,
- `service_name`, `service_version`, `environment`, `timestamp`.

2. Trazabilidad por cambio:
- entrada en `CHANGELOG.md` por release,
- link a task cerrada,
- evidencia de pruebas.

3. Trazabilidad por incidente:
- `INCIDENTS.md` con severidad, timeline, RCA, acciones.

### Estandar minimo de logging

Todo servicio debe loggear (estructurado JSON):
- `trace_id`, `request_id`, `service`, `route/event`, `status`, `latency_ms`.

### Formato minimo de CHANGELOG

`YYYY-MM-DD | vX.Y.Z | servicio/modulo | cambio | evidencia`

---

## 6) Testing (refuerzo para microservicios)

### Piramide minima

1. Unit tests por servicio.
2. Contract tests entre servicios (consumer/provider).
3. Integration tests por flujo critico.
4. Smoke tests post-deploy por superficie.
5. Regression tests de bugs historicos.

### Registros documentales

- `TEST_SUITE.md`: inventario de casos con estado (`PASS/FAIL/PENDING`) y evidencia.
- `REGRESSION_CASES.md`: casos que nunca deben romperse.
- `ERROR_REGISTRY.md`: patrones conocidos + causa raiz + fix.

### Gate de release (bloqueante)

No se libera si falla cualquiera de:
- unit,
- contract,
- smoke,
- regresion critica,
- validacion de seguridad.

---

## 7) Git y releases

### Flujo sugerido

- ramas: `main`, `develop`, `feat/*`, `fix/*`, `hotfix/*`.
- PR obligatorio para merge a `main`.
- tags semanticos: `vMAJOR.MINOR.PATCH`.

### Definition of Done (DoD)

Una tarea queda `DONE` solo si:
- codigo mergeado,
- tests requeridos en verde,
- docs actualizadas,
- changelog actualizado,
- evidencia anexada,
- riesgos residuales declarados.

---

## 8) Base de datos (Postgres/Supabase compatible)

### Reglas

- Toda mutacion de schema via migracion versionada en `db/migrations`.
- Toda migracion con rollback definido.
- Sin cambios manuales en prod sin registro.

### Trazabilidad DB

Cada release debe indicar:
- migraciones aplicadas,
- impacto por servicio,
- evidencia de aplicacion.

---

## 9) Seguridad operativa

### Matriz de acceso

`SECURITY.md` debe listar por agente:
- repo,
- ambientes,
- DB,
- secretos,
- acciones permitidas.

### Secretos

- solo placeholders en repo,
- rotacion ante exposicion,
- protocolo de incidente obligatorio.

---

## 10) Protocolo de debugging (runbook generico)

Archivo canonico: `docs/DEBUG.md`.

### Flujo obligatorio

1. Capturar `trace_id`/`request_id`/evidencia.
2. Reconstruir input, output esperado, output real.
3. Determinar alcance: puntual (servicio) o estructural (contrato).
4. Diseñar fix con alcance correcto.
5. Aplicar fix en branch de trabajo.
6. Ejecutar validaciones del servicio y del flujo completo.
7. Deploy segun `DEPLOY.md`.
8. Smoke test post-deploy.
9. Registrar evidencia en `CHANGELOG.md`.
10. Si aplica, actualizar `REGRESSION_CASES.md` y `ERROR_REGISTRY.md`.

### Regla bloqueante

No se cierra bug sin evidencia reproducible de cierre.

---

## 11) Protocolo de actualizacion de objetivo

Archivo canonico: `docs/PROTOCOLO_ACTUALIZAR_OBJETIVO.md`.

### Cuando se usa

- cambio de direccion del producto,
- cambio de prioridad estructural,
- cambio de regla madre o principio de arquitectura.

### Flujo

1. Operador define el nuevo objetivo en terminos de negocio.
2. Orquestador traduce impacto tecnico.
3. Se actualiza en orden:
- `BIBLIA.md` (si cambia direccion fundamental),
- `SYSTEM.md`,
- `BUSINESS.md`,
- `CONTRATOS.md` (si cambia interfaces),
- `INICIAL.md` (si cambia lectura obligatoria),
- `biblioteca/README.md` y fichas afectadas.
4. Se registra entrada de gobernanza en `CHANGELOG.md`.
5. Se crean o re-priorizan tasks en `docs/tasks/`.

### Regla

No ejecutar implementacion grande hasta cerrar esta actualizacion documental.

---

## 12) Protocolo de cierre de sesion y sync de archivos

Archivo canonico: `docs/SESSION_CLOSE.md`.

Objetivo: dejar el sistema consistente para retomar sin perdida de contexto.

### Checklist de cierre (obligatorio)

1. Estado de tasks actualizado (`IN_PROGRESS`, `BLOCKED`, `REVIEW`, `DONE`).
2. `SYSTEM.md` actualizado si cambio estado real.
3. `CHANGELOG.md` actualizado si hubo integracion/deploy.
4. `TEST_SUITE.md` actualizado con resultados nuevos.
5. `REGRESSION_CASES.md` y/o `ERROR_REGISTRY.md` actualizados si hubo bug/fix.
6. Fichas de biblioteca afectadas actualizadas.
7. Canales de agentes actualizados (entregas, bloqueos, cerrados).
8. Si hay deploy: evidencia linkeada.
9. Si no hubo deploy: dejar explicitamente "sin deploy".

### Regla de sync

Una sesion no queda cerrada hasta que codigo y documentacion reflejen el mismo estado.

---

## 13) Checklist de bootstrap

- [ ] Estructura de carpetas creada
- [ ] Documentos base creados
- [ ] Protocolo de agentes activo
- [ ] Tasks con template y carpeta `closed/`
- [ ] Contratos iniciales por microservicio
- [ ] TEST_SUITE + REGRESSION_CASES + ERROR_REGISTRY iniciales
- [ ] SECURITY + matriz de acceso definida
- [ ] CHANGELOG con entrada de setup
- [ ] DEPLOY con gates y rollback
- [ ] INCIDENTS.md creado
- [ ] PROTOCOLO_ACTUALIZAR_OBJETIVO.md creado
- [ ] SESSION_CLOSE.md creado
- [ ] Entornos definidos (`dev`, `staging`, `prod`) con secretos y permisos separados

---

## 14) Plantillas cortas

### Template de task

```markdown
# TASK-YYYYMMDD-001
estado: SPEC
owner: <agente>
aprobador: <orquestador>
objetivo: <resultado>
alcance_permitido: <lista>
alcance_prohibido: <lista>
validaciones: <tests/checks>
evidencia: <links/logs>
```

### Template de incidente

```markdown
# INC-YYYYMMDD-001
severidad: SEV-1..4
impacto: <usuarios/sistemas>
timeline: <UTC>
causa_raiz: <RCA>
mitigacion: <accion>
prevencion: <acciones permanentes>
relacionado: <task/changelog/regression>
```

### Template de contract test

```markdown
ID: CT-<servicio>-<numero>
provider: <service>
consumer: <service>
entrada: <payload>
salida_esperada: <payload/codigo>
estado: PASS|FAIL|PENDING
ultima_ejecucion: YYYY-MM-DD
```

### Template de cierre de sesion

```markdown
fecha: YYYY-MM-DD
sesion: <id opcional>
resumen: <que se hizo>
deploy: si|no
tasks_actualizadas: <ids>
docs_actualizados: <lista>
evidencia: <links>
pendientes: <lista corta>
```

---

## 15) Template obligatorio de INICIAL.md

Todo proyecto generado con este bootstrap debe crear `docs/INICIAL.md` con esta estructura minima:

```markdown
# INICIAL.md - <NOMBRE_PROYECTO>

## Estado del sistema (actualizado: YYYY-MM-DD)
- Produccion: <estado real>
- En progreso: <modulos/tasks>
- Bloqueos activos: <si/no + referencia>

## Stack (lenguajes, frameworks, plataformas, versiones)
- Backend: <stack + version>
- Frontend: <stack + version>
- DB: <motor + version>
- Infra: <cloud/plataforma>

## Reglas no negociables (top 5)
1. <regla + link>
2. <regla + link>
3. <regla + link>
4. <regla + link>
5. <regla + link>

## Mapa de lectura obligatoria (orden)
1. docs/BIBLIA.md
2. docs/LEY_ARQUITECTURA.md
3. docs/AGENTS.md
4. docs/SYSTEM.md
5. docs/BUSINESS.md
6. docs/CONTRATOS.md
7. docs/DEBUG.md
8. docs/DEPLOY.md
9. docs/SECURITY.md
10. docs/biblioteca/README.md

## Task activa o proxima
- Task: <TASK-ID o "sin task activa">
- Estado: <estado>
- Owner: <agente>

## Ultimo cierre de sesion
- Fecha: YYYY-MM-DD
- Referencia: docs/SESSION_CLOSE.md#<entrada>
```

---

## 16) Convenciones de branching por task

Conectar siempre task con rama para trazabilidad de extremo a extremo.

### Naming de ramas

- `feat/TASK-YYYYMMDD-001-descripcion-corta`
- `fix/TASK-YYYYMMDD-002-descripcion-corta`
- `hotfix/TASK-YYYYMMDD-003-descripcion-corta`

### Responsabilidad operativa

- Quien crea la rama: agente ejecutor owner de la task.
- Quien abre PR: orquestador (o ejecutor con revision obligatoria del orquestador).
- Quien aprueba merge a `main`: orquestador + operador si impacta negocio/riesgo alto.

### Reglas

1. No hay rama sin task asociada.
2. El ID de task debe estar en nombre de rama, PR y commit principal.
3. No mergear sin actualizar docs afectadas y evidencias de test.

### Convencion de commits (obligatoria)

Formato:

`<tipo>(TASK-ID): descripcion corta`

Ejemplos:
- `feat(TASK-20250530-001): agregar endpoint de autenticacion`
- `fix(TASK-20250530-002): corregir validacion de contrato en servicio pagos`
- `docs(TASK-20250530-003): actualizar runbook de debugging`

Tipos sugeridos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

### Politica de ramas para tasks BLOCKED

Si una task pasa a `BLOCKED`:

1. La rama no se mergea.
2. Se agrega marcador de bloqueo en el canal del agente y en la task.
3. Si hay trabajo util parcial, se conserva la rama y se renombra opcionalmente:
   `blocked/TASK-...-motivo-corto`.
4. Si el trabajo no es reutilizable, cerrar PR (si existe) y borrar rama
   solo despues de documentar motivo en task/canal.
5. Al desbloquear, continuar sobre la misma rama bloqueada o crear `fix/TASK-...`
   dejando referencia cruzada.
---

## 17) Supabase especifico (cuando aplique)

Si el proyecto usa Supabase, definir estas reglas desde el dia 1:

### Seguridad y acceso

1. RLS habilitado por defecto en tablas de negocio.
2. `service_role` solo en backend seguro (nunca cliente).
3. Politicas RLS versionadas y auditables.

### Auth

- Definir explicitamente: Supabase Auth o proveedor externo.
- Documentar mapeo entre identidad (`auth.uid`) y modelos de dominio.

### Edge Functions y servicios

- Definir frontera: que vive en Edge Functions vs microservicios externos.
- Documentar contratos y ownership de cada endpoint.

### Realtime/subscriptions

- Definir que canales usan realtime.
- Definir politicas RLS para eventos realtime.
- Definir fallback cuando realtime no entrega eventos.

### Entornos

- Proyectos separados por entorno: `dev`, `staging`, `prod`.
- Secretos separados por entorno.
- Regla de promocion: `dev -> staging -> prod` con evidencia.

### Migraciones

- Fuente de verdad: archivos de migracion versionados.
- No aplicar cambios manuales en prod sin ticket + changelog.
- Definir comando oficial (`supabase db push` / pipeline SQL) y rollback.

---

## 18) Onboarding de agentes/plataformas

Crear `docs/ONBOARDING_AGENTE.md` con template minimo:

```markdown
# ONBOARDING_AGENTE.md

## Identidad del agente
- Nombre:
- Rol:
- Entorno/herramienta (IDE, CLI, plataforma):

## Permisos por defecto
- Repo:
- Produccion:
- Base de datos:
- Secretos:

## Lectura inicial obligatoria (orden)
1. docs/INICIAL.md
2. docs/AGENTS.md
3. docs/SECURITY.md
4. docs/agents/COMMUNICATION_PROTOCOL.md
5. docs/TASKS/TASK_TEMPLATE.md (o docs/tasks/TASK_TEMPLATE.md)

## Canal de comunicacion
- Archivo: docs/agents/COMMUNICATION_<AGENTE>.md
- Formato de entregas:
- Formato de bloqueos:

## Primera tarea de calibracion
- Task ID:
- Objetivo:
- Criterio de aprobado:

## Checklist de habilitacion
- [ ] Canal creado
- [ ] Permisos validados
- [ ] Task de calibracion ejecutada
- [ ] Revision del orquestador completada
```

---

## 19) Plantillas obligatorias de LEY_ARQUITECTURA.md y BIBLIA.md

### 19.1 Template de LEY_ARQUITECTURA.md (tecnico, con parte fija + variable)

```markdown
# LEY_ARQUITECTURA.md - <NOMBRE_PROYECTO>

## Ambito de este documento

Este documento define estandares tecnicos y arquitectura transversal.

Incluye:
- separacion por capas/modulos,
- contratos tecnicos,
- antipatrones prohibidos,
- estandares de integracion, naming y observabilidad.

No incluye negocio funcional (eso vive en `docs/BIBLIA.md`).

## Parte fija (no vacia, base comun entre proyectos)

### Principios tecnicos no negociables
1. No mezclar responsabilidades entre capas/modulos.
2. Toda integracion entre servicios se hace por contrato publico.
3. Sin acceso a internals de otro servicio/modulo.
4. Unico writer canonico por dominio de estado.
5. Ningun secreto real en repo.

### Estandares transversales
- Naming tecnico ASCII: `[a-zA-Z0-9_]`.
- Contratos versionados para API/eventos.
- Logging estructurado minimo: `trace_id`, `request_id`, `service`, `status`.
- Manejo de errores con codigos controlados.

### Antipatrones prohibidos
- Servicio que decide negocio + persiste + notifica en el mismo bloque sin contrato.
- Fallback a ramas/estados no ejecutados.
- Reglas de negocio criticas hardcodeadas fuera de `BUSINESS.md`.
- Integraciones sin timeout/retry controlado.

## Parte variable (completar por proyecto)

### Stack y arquitectura concreta
- Backend:
- Frontend:
- DB:
- Infra:

### Modulos/servicios activos
- <servicio/modulo>:
  - responsabilidad:
  - entrada publica:
  - salida:
  - owner:

### Superficies activas
- API:
- Web:
- Workers:
- Webhooks:

### Decisiones tecnicas locales
- <decision + motivo + impacto>
```

### 19.2 Template de BIBLIA.md (negocio puro)

```markdown
# BIBLIA.md - <NOMBRE_PROYECTO>

## Ambito de este documento

Este documento define identidad y reglas invariantes de negocio del producto.

Incluye:
- objetivo del producto,
- reglas funcionales no negociables,
- definicion de actores de negocio,
- criterios de exito del sistema.

No incluye detalles tecnicos de implementacion (eso vive en `docs/LEY_ARQUITECTURA.md`).

## Regla madre de negocio

<frase unica de principio funcional del producto>

## Resultado esperado del producto

- <comportamiento esperado 1>
- <comportamiento esperado 2>
- <comportamiento esperado 3>

## Reglas de negocio invariantes

1. <regla>
2. <regla>
3. <regla>

## Actores de negocio

- <actor 1>: rol, limites, impacto.
- <actor 2>: rol, limites, impacto.

## Criterios de cierre correcto

Un cambio de negocio esta cerrado solo si:
1. Regla actualizada en `BUSINESS.md`.
2. Contratos tecnicos alineados en `CONTRATOS.md` (si aplica).
3. Evidencia de validacion real.
4. Registro en `CHANGELOG.md`.

## Como se actualiza esta biblia

Solo cuando cambia direccion de producto/negocio.
No se edita por refactors tecnicos.
Usar `PROTOCOLO_ACTUALIZAR_OBJETIVO.md`.
```


