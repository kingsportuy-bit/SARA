# TEST_SUITE.md - SARA

## Regla permanente
- Cada funcionalidad o fix incluye tests propios del modulo.
- Antes de integrar se ejecutan tests del modulo y regresion existente.
- Un modulo nuevo no se cierra si rompe comportamiento previo no incluido explicitamente en su task.
- Toda prueba registra evidencia trazable.
- Toda migracion valida que solo afecta objetos con prefijo `sara_`.

## Inventario inicial
- PASS: webhook Chatwoot acepta solo account `7`, inbox `45`, conversation `85`
- PASS: webhook Chatwoot rechaza firma invalida o vencida
- PENDING: idempotencia por delivery ID y message ID
- PENDING: buffer extiende `process_after` por cada mensaje entrante valido
- PENDING: worker reclama una sola vez cada buffer vencido
- PASS: mensajes salientes no generan loop
- PENDING: respuesta no confirma accion sin evidencia exitosa
- PENDING: contract tests API v0
- PENDING: unit tests modulo decisiones
- PENDING: integration test checkin -> decision -> dashboard
- PASS: guard test migraciones limitadas a prefijo `sara_`
- PASS: smoke HTTPS `GET https://sara.codexa.uy/health`
- PASS: smoke webhook fuera de alcance responde `202` y descarta sin procesar

## Pipeline modular (TASK-20260602-004)
- PASS: coarseClassifier retorna esqueleto con schema version v1
- PASS: coarseClassifier preserva traceId
- PASS: coarseClassifier acepta sessionContext
- PASS: moduleIntentClassifier retorna action "none" con missingData
- PASS: moduleIntentClassifier preserva module de entrada
- PASS: moduleRouter rechaza modulo no registrado como no ejecutable
- PASS: moduleRouter rechaza modulo "unknown"
- PASS: moduleRouter rechaza modulo "daily-log"
- PASS: moduleRouter rechaza modulo "session-context" no registrado
- PASS: actionExecutor retorna "skipped" sin modulos de dominio
- PASS: actionExecutor retorna "needs_confirmation" cuando requiresConfirmation=true
- PASS: actionExecutor preserva traceId
- PASS: intentConfidenceSufficient retorna true con confidence >= 0.75 y sin missingData
- PASS: intentConfidenceSufficient retorna false con confidence < 0.75
- PASS: intentConfidenceSufficient retorna false con missingData no vacio
- PASS: responseComposer retorna schema v1 con traceId
- PASS: responseComposer informa missingData
- PASS: responseComposer informa confianza baja
- PASS: responseComposer informa needs_confirmation
- PASS: responseComposer informa skipped
- PASS: responseComposer informa executed
- PASS: responseComposer informa failed con mensaje de error

## Modulo notes (TASK-20260602-005)
- PASS: notesModule.create acepta input valido con noteId y eventId
- PASS: notesModule.create rechaza content vacio
- PASS: notesModule.create rechaza content solo espacios
- PASS: notesModule.create rechaza noteType invalido
- PASS: notesModule.create acepta los 6 noteType validos
- PASS: notesModule.create propaga error del repositorio
- PASS: notesModule.create pasa todos los campos al repositorio
- PASS: notesStore llama sara_create_note con parametros correctos
- PASS: notesStore retorna failed en error de RPC
- PASS: notesStore envia null para campos opcionales indefinidos
- PASS: moduleRouter marca notes.create ejecutable tras registerModule
- PASS: moduleRouter rechaza accion no registrada en modulo registrado
- PASS: actionExecutor despacha a handler notes.create y devuelve result
- PASS: actionExecutor retorna skipped para accion no registrada en modulo con handler
- PASS: actionExecutor no despacha si requiresConfirmation=true aunque haya handler
- PASS: moduleIntentClassifier detecta nota: y extrae content
- PASS: moduleIntentClassifier detecta guarda una nota:
- PASS: moduleIntentClassifier detecta anota esto:
- PASS: moduleIntentClassifier retorna missingData sin content
- PASS: moduleIntentClassifier no detecta notes.create en modulo unknown
- PASS: moduleIntentClassifier no detecta notes.create en daily-log
- PASS: moduleIntentClassifier sin falso positivo en mensajes no-note
- PASS: migrationGuard sigue pasando con nuevos objetos sara_events y sara_notes
- PASS: actionExecutor bloquea notes.create cuando content esta ausente
- PASS: actionExecutor bloquea notes.create cuando content es string vacio
- PASS: actionExecutor bloquea notes.create cuando content es solo espacios
- PASS: actionExecutor bloquea notes.create cuando content no es string
- PASS: actionExecutor no bloquea modulos no-notes sin content
- PASS: responseComposer confirma ejecucion solo si existen noteId y eventId
- PASS: responseComposer no confirma executed sin evidencia
- PASS: responseComposer no confirma con solo noteId (sin eventId)
- PASS: responseComposer no confirma con solo eventId (sin noteId)
- PASS: responseComposer confirma con ambos noteId y eventId
- PASS: actionExecutor bloquea notes.create con intentConfidence undefined
- PASS: actionExecutor bloquea notes.create con intentConfidence < 0.75
- PASS: actionExecutor bloquea notes.create con intentMissingData no vacio
- PASS: actionExecutor bloquea notes.create con intentMissingData undefined
- PASS: actionExecutor bloquea notes.create con intentMissingData no-array
- PASS: actionExecutor permite notes.create con confidence 0.75 exacto
- PASS: coarseClassifier detecta modulo notes con nota:, guarda una nota:, anota esto, crea una nota
- PASS: coarseClassifier detecta notes con prefijos de tipo (aprendizaje:, idea:, etc.)
- PASS: coarseClassifier mantiene unknown para mensaje normal sin prefijo
- PASS: bufferProcessor usa DeepSeek fallback para mensaje no-note
- PASS: bufferProcessor ejecuta notes.create completo con handler y responseComposer
- PASS: bufferProcessor bloquea ejecucion cuando nota no tiene contenido (missingData)
- PASS: bufferProcessor completa buffer con respuesta compuesta tras accion ejecutada
- PASS: bufferProcessor no confirma nota sin noteId y eventId en evidencia
- PASS: Chatwoot scope 7/45/85 intacto (regresion)
- PASS: coarseClassifier detecta notes con encabezado markdown Chatwoot
- PASS: moduleIntentClassifier detecta notes.create con encabezado Chatwoot
- PASS: moduleIntentClassifier extrae content sin encabezado
- PASS: bufferProcessor ejecuta notes.create con formato Chatwoot (encabezado + nota)

## Message normalizer (TASK-20260603-007)
- PASS: messageNormalizer remueve encabezado Chatwoot de grupo
- PASS: messageNormalizer preserva originalContent
- PASS: messageNormalizer no elimina contenido normal que no sea encabezado
- PASS: messageNormalizer no remueve bold inline
- PASS: messageNormalizer no remueve bold inicial si no tiene formato de encabezado Chatwoot
- PASS: messageNormalizer normaliza multiples mensajes preservando id mapping
- PASS: messageNormalizer retorna content vacio para mensaje solo-header
- PASS: messageNormalizer preserva createdAt
- PASS: messageNormalizer retorna array vacio para input vacio
- PASS: messageNormalizer remueve header con gap multilinea

## Notes list/search (TASK-20260603-007)
- PASS: coarseClassifier detecta notes de que notas tengo, listar notas, ultimas notas
- PASS: coarseClassifier detecta notes de busca notas sobre foco, notas sobre foco
- PASS: moduleIntentClassifier detecta notes.list de que notas tengo, listar notas, ultimas notas, mis notas
- PASS: moduleIntentClassifier detecta notes.search de busca notas sobre foco, notas sobre foco
- PASS: moduleIntentClassifier extrae query de busqueda
- PASS: moduleIntentClassifier prefiere search sobre list cuando hay query
- PASS: notesModule.list retorna notas con schema version
- PASS: notesModule.list pasa parametro limit al repositorio
- PASS: notesModule.list propaga fallo del repositorio
- PASS: notesModule.search rechaza query vacio
- PASS: notesModule.search pasa parametros al repositorio
- PASS: notesModule.search retorna resultados vacios sin matches
- PASS: notesStore.listNotes consulta sara_notes y mapea columnas
- PASS: notesStore.searchNotes consulta sara_notes con ilike
- PASS: actionExecutor despacha a notes.list sin guardas de create
- PASS: actionExecutor despacha a notes.search sin guardas de create
- PASS: bufferProcessor ejecuta notes.list con que notas tengo y no llama DeepSeek
- PASS: bufferProcessor ejecuta notes.search con busca notas sobre foco y no llama DeepSeek
- PASS: bufferProcessor usa DeepSeek fallback cuando ruta no ejecutable
- PASS: responseComposer formatea resultados de list con tipo y preview
- PASS: responseComposer numera resultados list/search desde 1, no desde 0
- PASS: responseComposer muestra mensaje vacio para list sin resultados
- PASS: responseComposer formatea resultados de search con query
- PASS: responseComposer muestra mensaje especifico para search sin resultados
- PASS: responseComposer trunca contenido largo en preview

## Evidencia local 2026-06-02
- `npm run typecheck`: PASS
- `npm test`: PASS (7 tests)
- `npm test`: PASS (8 tests luego de hardening del worker)
- `npm run build`: PASS
- `npm audit --audit-level=high`: PASS (0 vulnerabilidades)
- `npm run typecheck`: PASS (TASK-20260602-004)
- `npm test`: PASS (33 tests, TASK-20260602-004)
- `npm run build`: PASS (TASK-20260602-004)
- `npm run typecheck`: PASS (TASK-20260602-005)
- `npm test`: PASS (55 tests, TASK-20260602-005)
- `npm run build`: PASS (TASK-20260602-005)
- `npm run typecheck`: PASS (fix 3 TASK-20260602-005)
- `npm test`: PASS (71 tests, fix 3 TASK-20260602-005)
- `npm run build`: PASS (fix 3 TASK-20260602-005)
- `npm run typecheck`: PASS (TASK-20260603-006)
- `npm test`: PASS (82 tests, TASK-20260603-006)
- `npm run build`: PASS (TASK-20260603-006)
- `npm run typecheck`: PASS (fix header TASK-20260603-006)
- `npm test`: PASS (86 tests, fix header TASK-20260603-006)
- `npm run build`: PASS (fix header TASK-20260603-006)

## Evidencia local 2026-06-03 (TASK-20260603-007)
- `npm run typecheck`: PASS
- `npm test`: PASS (132 tests)
- `npm run build`: PASS
- `npm run typecheck`: PASS (hotfix numbering TASK-20260603-007)
- `npm test`: PASS (132 tests, hotfix numbering TASK-20260603-007)
- `npm run build`: PASS (hotfix numbering TASK-20260603-007)

## Modulo tasks (TASK-20260603-008)

### Migracion y DB
- PASS: migracion `sara_tasks` crea tabla, indices, RLS y RPCs
- PASS: migracion solo crea/modifica objetos `sara_`
- PASS: RPC `sara_create_task` valida title no vacio
- PASS: RPC `sara_complete_task` soporta taskId, titleMatch y position
- PASS: RPC `sara_complete_task` falla si titleMatch coincide con multiples tareas pendientes

### Tasks Module
- PASS: tasksModule.create acepta input valido con taskId y eventId
- PASS: tasksModule.create rechaza title vacio
- PASS: tasksModule.create rechaza title solo espacios
- PASS: tasksModule.list retorna tareas pendientes con schema version
- PASS: tasksModule.complete completa con evidencia (taskId, eventId, title)
- PASS: tasksModule.complete completa por titleMatch
- PASS: tasksModule.complete completa por position
- PASS: tasksModule.complete falla sin identificador
- PASS: tasksModule.complete falla con position 0
- PASS: tasksModule.complete falla con position negativo

### Tasks Store
- PASS: tasksStore.createTask llama RPC `sara_create_task` con parametros correctos
- PASS: tasksStore.createTask retorna failed en error de RPC
- PASS: tasksStore.listTasks consulta `sara_tasks` read-only
- PASS: tasksStore.listTasks mapea campos correctamente
- PASS: tasksStore.completeTask llama RPC `sara_complete_task` con taskId
- PASS: tasksStore.completeTask retorna failed en error de RPC

### Classifiers
- PASS: coarseClassifier detecta modulo `tasks` para tarea:, crear tarea:, tengo que, debo
- PASS: coarseClassifier detecta modulo `tasks` para que tareas tengo, listar tareas, mis tareas
- PASS: coarseClassifier detecta modulo `tasks` para completar tarea, complete, marcar tarea
- PASS: coarseClassifier mantiene `unknown` para mensaje no-task
- PASS: moduleIntentClassifier detecta tasks.create y extrae title
- PASS: moduleIntentClassifier detecta tasks.list
- PASS: moduleIntentClassifier detecta tasks.complete y extrae position
- PASS: moduleIntentClassifier detecta tasks.complete y extrae titleMatch
- PASS: moduleIntentClassifier retorna missingData cuando no hay title
- PASS: moduleIntentClassifier no detecta tasks en modulo no-tasks

### Router
- PASS: moduleRouter marca tasks.create ejecutable tras registro
- PASS: moduleRouter marca tasks.list ejecutable tras registro
- PASS: moduleRouter marca tasks.complete ejecutable tras registro

### Action Executor
- PASS: actionExecutor despacha a handler tasks.create
- PASS: actionExecutor bloquea tasks.create sin title
- PASS: actionExecutor bloquea tasks.create con confianza baja
- PASS: actionExecutor despacha a handler tasks.list
- PASS: actionExecutor despacha a handler tasks.complete
- PASS: actionExecutor bloquea tasks.complete sin identificador

### Response Composer
- PASS: responseComposer confirma task create solo con taskId y eventId
- PASS: responseComposer no confirma task create sin evidencia
- PASS: responseComposer confirma task complete solo con taskId y eventId
- PASS: responseComposer no confirma task complete sin evidencia
- PASS: responseComposer formatea task list desde indice 1
- PASS: responseComposer muestra mensaje vacio para task list sin resultados

### Buffer Processor (integracion)
- PASS: bufferProcessor ejecuta tasks.create con fakes y no llama DeepSeek
- PASS: bufferProcessor ejecuta tasks.list con fakes y no llama DeepSeek
- PASS: bufferProcessor ejecuta tasks.complete con position y no llama DeepSeek
- PASS: bufferProcessor bloquea tasks.complete sin datos suficientes y no ejecuta handler

### Session Context (TASK-20260603-009)
- PASS: sara_session_contexts tiene unique constraint en account/inbox/conversation
- PASS: sara_session_contexts tiene RLS y anon/authenticated revocado
- PASS: sessionContextModule.get retorna contexto vigente
- PASS: sessionContextModule.get retorna null si contexto no existe
- PASS: sessionContextModule.get ignora contexto expirado (store retorna null)
- PASS: sessionContextModule.upsert valida account/inbox/conversation
- PASS: sessionContextModule.upsert propaga error por falta de campos
- PASS: sessionContextModule.clear limpia contexto y emite resultado con evidencia
- PASS: sessionContextStore.get llama sara_get_session_context
- PASS: sessionContextStore.upsert llama sara_upsert_session_context con params correctos
- PASS: sessionContextStore.clear llama sara_clear_session_context
- PASS: bufferProcessor pasa sessionContext a coarseClassifier e moduleIntentClassifier
- PASS: bufferProcessor actualiza foco despues de tasks.create con evidencia
- PASS: bufferProcessor actualiza lastTaskList despues de tasks.list con multiple tareas
- PASS: bufferProcessor no falla accion principal si falla actualizar contexto
- PASS: moduleIntentClassifier resuelve completar esa con foco task en sessionContext
- PASS: moduleIntentClassifier resuelve completar la ultima tarea con foco task
- PASS: moduleIntentClassifier resuelve marcar esa como hecha con foco task
- PASS: moduleIntentClassifier resuelve desde lastTaskList cuando hay una unica tarea
- PASS: moduleIntentClassifier no resuelve referencia ambigua sin sessionContext
- PASS: moduleIntentClassifier no resuelve referencia ambigua con lastTaskList multiple

### Regresion
- PASS: notes.create/list/search sigue pasando (13 tests bufferProcessor + notes)
- PASS: Chatwoot scope 7/45/85 sigue pasando

## Evidencia local 2026-06-03 (TASK-20260603-008)
- `npm run typecheck`: PASS
- `npm test`: PASS (195 tests)
- `npm run build`: PASS
- `npm run typecheck`: PASS (hardening titleMatch TASK-20260603-008)
- `npm test`: PASS (196 tests, hardening titleMatch TASK-20260603-008)
- `npm run build`: PASS (hardening titleMatch TASK-20260603-008)

## Evidencia local 2026-06-03 (TASK-20260603-009)
- `npm run typecheck`: PASS
- `npm test`: PASS (226 tests)
- `npm run build`: PASS
