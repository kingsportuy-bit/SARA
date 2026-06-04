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
- PASS: sara_upsert_session_context permite limpiar foco y renueva TTL en cada upsert
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
- `npm run typecheck`: PASS (hardening foco/TTL TASK-20260603-009)
- `npm test`: PASS (227 tests, hardening foco/TTL TASK-20260603-009)
- `npm run build`: PASS (hardening foco/TTL TASK-20260603-009)

## Evidencia local 2026-06-03 (TASK-20260603-010)
- `npm run typecheck`: PASS
- `npm test`: PASS (295 tests)
- `npm run build`: PASS
- `npm run typecheck`: PASS (hardening SQL/dispatcher scope TASK-20260603-010)
- `npm test`: PASS (299 tests, hardening SQL/dispatcher scope TASK-20260603-010)
- `npm run build`: PASS (hardening SQL/dispatcher scope TASK-20260603-010)

## Evidencia productiva 2026-06-03 (TASK-20260603-010)
- PASS: `GET https://sara.codexa.uy/health`
- PASS: migracion `20260603_010_reminders.sql` aplicada en VPS.
- PASS: `sara_reminders` existe en DB compartida.
- PASS: RPCs `sara_create_reminder`, `sara_cancel_reminder`, `sara_claim_due_reminders`, `sara_mark_reminder_sent`, `sara_mark_reminder_failed` existen.
- PASS: Chatwoot recibio `recordame en 2 minutos tomar agua`.
- PASS: SARA respondio `Recordatorio creado para 03/06/2026 18:46: tomar agua`.
- PASS: dispatcher envio `Recordatorio: tomar agua`.
- PASS: DB dejo el recordatorio `tomar agua` en `status = sent`.
- PASS: `sara_events` registro `reminder_created` y `reminder_sent`.

## Modulo reminders (TASK-20260603-010)

Estado: DONE + DEPLOYED + VALIDATED

### Migracion y DB
- PASS: migracion solo crea/modifica objetos `sara_`
- PASS: `sara_reminders` tiene RLS y anon/authenticated revocado
- PASS: `sara_reminders` valida estados permitidos (pending, processing, sent, canceled, failed)
- PASS: `sara_create_reminder` rechaza title vacio
- PASS: `sara_create_reminder` rechaza `due_at` pasado
- PASS: `sara_create_reminder` emite `reminder_created`
- PASS: `sara_cancel_reminder` cancela por id
- PASS: `sara_cancel_reminder` cancela por posicion
- PASS: `sara_cancel_reminder` falla si `titleMatch` es ambiguo
- PASS: `sara_claim_due_reminders` reclama solo vencidos pending y los pasa a processing
- PASS: `sara_mark_reminder_sent` marca sent y emite `reminder_sent` (solo en processing)
- PASS: `sara_mark_reminder_failed` marca failed y emite `reminder_failed`

### Reminders Module
- PASS: remindersModule.create acepta input valido con reminderId y eventId
- PASS: remindersModule.create rechaza title vacio
- PASS: remindersModule.create rechaza title solo espacios
- PASS: remindersModule.create rechaza dueAt pasado
- PASS: remindersModule.create rechaza dueAt faltante
- PASS: remindersModule.list retorna recordatorios pendientes por conversacion
- PASS: remindersModule.cancel completa con evidencia (reminderId, eventId, title)
- PASS: remindersModule.cancel completa por titleMatch
- PASS: remindersModule.cancel completa por position
- PASS: remindersModule.cancel falla sin identificador
- PASS: remindersModule.cancel falla con position 0

### Reminders Store
- PASS: remindersStore.createReminder llama RPC `sara_create_reminder`
- PASS: remindersStore.createReminder retorna failed en error de RPC
- PASS: remindersStore.listReminders consulta `sara_reminders` filtrado por conversacion
- PASS: remindersStore.listReminders mapea campos correctamente
- PASS: remindersStore.cancelReminder llama RPC `sara_cancel_reminder`
- PASS: remindersStore.cancelReminder retorna failed en error de RPC
- PASS: remindersStore.claimDueReminders llama RPC `sara_claim_due_reminders`
- PASS: remindersStore.markReminderSent llama RPC `sara_mark_reminder_sent`
- PASS: remindersStore.markReminderFailed llama RPC `sara_mark_reminder_failed`

### Time Parser
- PASS: reminderTimeParser parsea `en N minutos`
- PASS: reminderTimeParser parsea `en N horas`
- PASS: reminderTimeParser parsea `en N dias`
- PASS: reminderTimeParser parsea `manana a las HH`
- PASS: reminderTimeParser parsea `manana a las HH:MM`
- PASS: reminderTimeParser parsea `hoy a las HH`
- PASS: reminderTimeParser parsea `hoy a las HH:MM`
- PASS: reminderTimeParser rechaza texto ambiguo sin tiempo
- PASS: reminderTimeParser rechaza zero/negativo minutos
- PASS: formatDueAt formatea ISO a dd/mm/yyyy HH:MM

### Classifiers
- PASS: coarseClassifier detecta modulo `reminders` para recordame, recuerdame
- PASS: coarseClassifier detecta modulo `reminders` para crear recordatorio, agendar recordatorio
- PASS: coarseClassifier detecta modulo `reminders` para que recordatorios tengo, listar recordatorios
- PASS: coarseClassifier detecta modulo `reminders` para cancelar recordatorio, eliminar recordatorio
- PASS: moduleIntentClassifier detecta reminders.create y extrae title y dueAt
- PASS: moduleIntentClassifier detecta reminders.list
- PASS: moduleIntentClassifier detecta reminders.cancel con position, titleMatch, reminderId
- PASS: moduleIntentClassifier retorna missingData cuando no se puede parsear tiempo
- PASS: moduleIntentClassifier retorna missingData cuando no hay title
- PASS: moduleIntentClassifier resuelve referencias con sessionContext (cancelar ese)
- PASS: moduleIntentClassifier no resuelve referencia ambigua sin sessionContext

### Response Composer
- PASS: responseComposer confirma reminder create solo con reminderId y eventId
- PASS: responseComposer no confirma reminder create sin evidencia
- PASS: responseComposer confirma reminder cancel solo con reminderId y eventId
- PASS: responseComposer no confirma reminder cancel sin evidencia
- PASS: responseComposer formatea reminder list desde indice 1 con fecha/hora
- PASS: responseComposer muestra mensaje vacio para reminder list sin resultados

### Regresion
- PASS: notes.create/list/search sigue pasando
- PASS: tasks.create/list/complete sigue pasando
- PASS: session-context sigue pasando
- PASS: Chatwoot scope 7/45/85 sigue pasando

## Evidencia local 2026-06-03 (TASK-20260603-010)
- `npm run typecheck`: PASS
- `npm test`: PASS (295 tests)
- `npm run build`: PASS

## Modulo daily-log (TASK-20260603-011)

Estado: DONE + DEPLOYED + VALIDATED

### DB / Migracion
- PASS: migracion solo crea/modifica objetos `sara_`.
- PASS: `sara_daily_log` tiene unique por `date`.
- PASS: `sara_daily_log` tiene RLS y anon/authenticated revocado.
- PASS: `sara_daily_log` valida `wake_energy` entre 1 y 10.
- PASS: `sara_daily_log` valida `sleep_hours >= 0`.
- PASS: RPCs morning/evening crean o actualizan y emiten eventos (`daily_log_created`, `daily_log_morning_updated`, `daily_log_evening_updated`).
- PASS: RPCs restringidas a service_role.

### Parser
- PASS: `dailyLogParser` detecta energia, sueno, intencion y fecha MVP.
- PASS: `dailyLogParser` detecta cierre/reflexion en evening.
- PASS: `dailyLogParser` usa fecha actual America/Montevideo por defecto.
- PASS: `dailyLogParser` soporta ayer.
- PASS: `dailyLogParser` falla sin campos actualizables para morning/evening.

### Modulo y Store
- PASS: `dailyLogModule.morning` valida energia y sueno (rango, no negativo).
- PASS: `dailyLogModule.morning` falla sin campos actualizables.
- PASS: `dailyLogModule.evening` falla sin campos actualizables.
- PASS: `dailyLogModule.summary` consulta read-only.
- PASS: `dailyLogStore` llama RPCs correctas (morning/evening).
- PASS: `dailyLogStore.summary` consulta `sara_daily_log`.

### Clasificadores
- PASS: `coarseClassifier` detecta modulo `daily-log`.
- PASS: `moduleIntentClassifier` detecta `daily-log.morning`.
- PASS: `moduleIntentClassifier` detecta `daily-log.evening`.
- PASS: `moduleIntentClassifier` detecta `daily-log.summary`.
- PASS: `moduleIntentClassifier` no ejecuta morning/evening sin campos.

### Executor y Composer
- PASS: `moduleRouter` marca daily-log ejecutable tras registro.
- PASS: `actionExecutor` despacha morning/evening/summary con guardas.
- PASS: `actionExecutor` bloquea daily-log.morning sin campos.
- PASS: `actionExecutor` bloquea daily-log.evening sin campos.
- PASS: `responseComposer` confirma morning solo con dailyLogId y eventId.
- PASS: `responseComposer` confirma evening solo con dailyLogId y eventId.
- PASS: `responseComposer` formatea summary con datos.
- PASS: `responseComposer` muestra sin dato para campos ausentes.
- PASS: `responseComposer` muestra no encontrado sin registro diario.

### Worker
- PASS: `bufferProcessor` ejecuta daily-log.morning y no llama DeepSeek.
- PASS: `bufferProcessor` ejecuta daily-log.evening y no llama DeepSeek.
- PASS: `bufferProcessor` ejecuta daily-log.summary y no llama DeepSeek.
- PASS: `bufferProcessor` actualiza session-context despues de daily-log.
- PASS: `bufferProcessor` no falla accion principal si falla actualizar contexto.

### Regresion
- PASS: `notes.create/list/search` sigue pasando.
- PASS: `tasks.create/list/complete` sigue pasando.
- PASS: `session-context` sigue pasando.
- PASS: `reminders` sigue pasando.
- PASS: Chatwoot scope `7/45/85` sigue pasando.

## Evidencia local 2026-06-03 (TASK-20260603-011)
- `npm run typecheck`: PASS
- `npm test`: PASS (380 tests)
- `npm run build`: PASS
- `npm run typecheck`: PASS (hardening parser/guardas TASK-20260603-011)
- `npm test`: PASS (387 tests, hardening parser/guardas TASK-20260603-011)
- `npm run build`: PASS (hardening parser/guardas TASK-20260603-011)

## Modulo areas (TASK-20260603-012)

Estado: DONE + DEPLOYED + VALIDATED

### DB y migraciones
- PASS: migracion solo crea/modifica objetos `sara_`.
- PASS: `sara_areas` tiene unique por `slug`.
- PASS: `sara_areas` tiene RLS y anon/authenticated revocado.
- PASS: `sara_areas` valida status permitido.
- PASS: `sara_create_area` rechaza nombre vacio.
- PASS: `sara_create_area` rechaza slug duplicado.
- PASS: `sara_archive_area` falla si no encuentra area.
- PASS: areas RPCs restringidas a `service_role`.

### Parser
- PASS: `areasParser` parsea crear area.
- PASS: `areasParser` parsea listar areas.
- PASS: `areasParser` parsea archivar area.
- PASS: `areasParser` parsea asignar tarea a area.
- PASS: `areasParser` parsea asignar nota a area.
- PASS: `areasParser` genera slug deterministico ASCII-safe.
- PASS: `areasParser` retorna `missingData` cuando falta area.

### Modulo
- PASS: `areasModule.create` valida name.
- PASS: `areasModule.create` valida slug.
- PASS: `areasModule.list` consulta read-only.
- PASS: `areasModule.archive` requiere area identificable.
- PASS: `areasModule.assignNote` requiere area y note.
- PASS: `areasModule.assignTask` requiere area y task.

### Store
- PASS: `areasStore.createArea` llama RPC `sara_create_area`.
- PASS: `areasStore.archiveArea` llama RPC `sara_archive_area`.
- PASS: `areasStore.assignNoteArea` llama RPC `sara_assign_note_area`.
- PASS: `areasStore.assignTaskArea` llama RPC `sara_assign_task_area`.
- PASS: `areasStore` propaga `areaSlug` en evidencia de asignaciones.
- PASS: `areasStore.listAreas` consulta `sara_areas`.

### Clasificadores
- PASS: `coarseClassifier` detecta modulo areas.
- PASS: `moduleIntentClassifier` detecta `areas.create`.
- PASS: `moduleIntentClassifier` detecta `areas.list`.
- PASS: `moduleIntentClassifier` detecta `areas.archive`.
- PASS: `moduleIntentClassifier` detecta `areas.assign-note`.
- PASS: `moduleIntentClassifier` detecta `areas.assign-task`.
- PASS: `moduleIntentClassifier` no ejecuta assign ambiguo.

### Executor y composer
- PASS: `actionExecutor` despacha create/list/archive/assign.
- PASS: `actionExecutor` bloquea mutaciones con confianza baja.
- PASS: `actionExecutor` bloquea create sin name.
- PASS: `actionExecutor` bloquea assign sin entityId.
- PASS: `responseComposer` confirma create/archive/assign solo con evidencia.
- PASS: `responseComposer` formatea list.

### Regresion
- PASS: `notes.create/list/search` sigue pasando.
- PASS: `tasks.create/list/complete` sigue pasando.
- PASS: `session-context` sigue pasando.
- PASS: `reminders` sigue pasando.
- PASS: `daily-log` sigue pasando.
- PASS: Chatwoot scope `7/45/85` sigue pasando.

## Evidencia local 2026-06-03 (TASK-20260603-012)
- `npm run typecheck`: PASS
- `npm test`: PASS (460 tests)
- `npm run build`: PASS
- `npm run typecheck`: PASS (hardening areaSlug TASK-20260603-012)
- `npm test`: PASS (460 tests, hardening areaSlug TASK-20260603-012)
- `npm run build`: PASS (hardening areaSlug TASK-20260603-012)

## Evidencia productiva 2026-06-03 (TASK-20260603-012)
- PASS: `GET https://sara.codexa.uy/health`
- PASS: migracion `20260603_012_areas.sql` aplicada en VPS.
- PASS: `sara_areas` existe en DB compartida.
- PASS: RPCs `sara_create_area`, `sara_archive_area`, `sara_assign_note_area` y `sara_assign_task_area` existen.
- PASS: Chatwoot recibio `crear area salud`.
- PASS: SARA respondio `Area creada: salud`.
- PASS: Chatwoot recibio `que areas tengo`.
- PASS: SARA respondio con el area activa `salud`.
- PASS: Chatwoot recibio `tarea: comprar vitaminas`.
- PASS: SARA respondio `Tarea creada: comprar vitaminas`.
- PASS: Chatwoot recibio `asociar esa tarea al area salud`.
- PASS: SARA respondio `Tarea asociada al area salud: comprar vitaminas`.
- PASS: DB dejo `sara_tasks.area_id` asociado a `sara_areas.id`.
- PASS: `sara_events` registro `area_created`, `task_created` y `task_area_assigned`.
- PASS: `sara_session_contexts` quedo enfocado en la tarea asignada con `lastAreaSlug = salud`.

## Evidencia productiva 2026-06-03 (TASK-20260603-011)
- PASS: `GET https://sara.codexa.uy/health`
- PASS: migracion `20260603_011_daily_log.sql` aplicada en VPS.
- PASS: `sara_daily_log` existe en DB compartida.
- PASS: RPCs `sara_upsert_daily_log_morning` y `sara_upsert_daily_log_evening` existen.
- PASS: Chatwoot recibio `buen dia energia 7 dormi 6.5 foco terminar propuestas`.
- PASS: SARA respondio `Registro de manana actualizado para 2026-06-03.`
- PASS: Chatwoot recibio `cierre del dia avance termine propuestas y camine`.
- PASS: SARA respondio `Cierre del dia actualizado para 2026-06-03.`
- PASS: Chatwoot recibio `resumen del dia`.
- PASS: SARA respondio con energia `7`, sueno `6.5`, intencion `terminar propuestas` y cierre `termine propuestas y camine`.
- PASS: DB dejo el registro diario en `sara_daily_log`.
- PASS: `sara_events` registro `daily_log_created` y `daily_log_evening_updated`.
- PASS: `sara_session_contexts` quedo enfocado en `daily-log`.

## Modulo objectives (TASK-20260603-013)

### Migracion
- PASS: migracion solo crea/modifica objetos `sara_`.
- PASS: `sara_objectives` tiene unique por `slug`.
- PASS: `sara_objectives` tiene RLS y anon/authenticated revocado.
- PASS: `sara_objectives` valida status permitido (`active`, `achieved`, `archived`).
- PASS: `sara_objectives` valida `success_criteria` como array JSON.
- PASS: `sara_tasks.objective_id` existe y es nullable.

### Store
- PASS: `objectivesStore.createObjective` llama `sara_create_objective` RPC.
- PASS: `objectivesStore.createObjective` maneja error RPC.
- PASS: `objectivesStore.achieveObjective` llama `sara_achieve_objective` RPC.
- PASS: `objectivesStore.archiveObjective` llama `sara_archive_objective` RPC.
- PASS: `objectivesStore.assignTaskObjective` llama `sara_assign_task_objective` RPC.
- PASS: `objectivesStore.listObjectives` consulta `sara_objectives`.

### Parser
- PASS: `objectivesParser` parsea crear objetivo.
- PASS: `objectivesParser` parsea crear objetivo con area.
- PASS: `objectivesParser` parsea crear objetivo con criterios.
- PASS: `objectivesParser` parsea crear objetivo con fecha target.
- PASS: `objectivesParser` parsea listar objetivos.
- PASS: `objectivesParser` parsea lograr objetivo.
- PASS: `objectivesParser` parsea lograr objetivo con acentos reales.
- PASS: `objectivesParser` parsea archivar objetivo.
- PASS: `objectivesParser` parsea asignar tarea a objetivo.
- PASS: `objectivesParser` genera slug deterministico ASCII-safe.
- PASS: `objectivesParser` retorna missingData sin titulo.

### Modulo
- PASS: `objectivesModule.create` crea con input valido.
- PASS: `objectivesModule.create` rechaza titulo vacio.
- PASS: `objectivesModule.create` rechaza slug vacio.
- PASS: `objectivesModule.list` consulta read-only.
- PASS: `objectivesModule.achieve` requiere objetivo identificable.
- PASS: `objectivesModule.archive` requiere objetivo identificable.
- PASS: `objectivesModule.assignTask` requiere objetivo y task.

### Pipeline
- PASS: `coarseClassifier` detecta modulo objectives.
- PASS: `coarseClassifier` prioriza `objectives` sobre `daily-log` cuando un objetivo contiene `energia`.
- PASS: `coarseClassifier` prioriza `objectives.assign-task` sobre `daily-log` cuando el objetivo contiene `energia`.
- PASS: `coarseClassifier` conserva `daily-log` para check-ins reales como `buen dia energia 7`.
- PASS: `moduleIntentClassifier` detecta `objectives.create`.
- PASS: `moduleIntentClassifier` detecta `objectives.list`.
- PASS: `moduleIntentClassifier` detecta `objectives.achieve`.
- PASS: `moduleIntentClassifier` detecta `objectives.archive`.
- PASS: `moduleIntentClassifier` detecta `objectives.assign-task`.
- PASS: `moduleIntentClassifier` no ejecuta assign ambiguo.
- PASS: `moduleRouter` marca objectives ejecutable tras registro.
- PASS: `actionExecutor` despacha create/list/achieve/archive/assign-task.
- PASS: `actionExecutor` bloquea mutaciones con confianza baja.
- PASS: `responseComposer` confirma create/achieve/archive/assign solo con evidencia.
- PASS: `responseComposer` formatea list.

### Regresion
- PASS: `notes.create/list/search` sigue pasando.
- PASS: `tasks.create/list/complete` sigue pasando.
- PASS: `session-context` sigue pasando.
- PASS: `reminders` sigue pasando.
- PASS: `daily-log` sigue pasando.
- PASS: `areas` sigue pasando.
- PASS: Chatwoot scope `7/45/85` sigue pasando.

## Evidencia local 2026-06-03 (TASK-20260603-013)
- `npm run typecheck`: PASS
- `npm test`: PASS (501 tests)
- `npm run build`: PASS
- `npm run typecheck`: PASS (hardening parser/constraint TASK-20260603-013)
- `npm test`: PASS (502 tests, hardening parser/constraint TASK-20260603-013)
- `npm run build`: PASS (hardening parser/constraint TASK-20260603-013)
- `npm run typecheck`: PASS (hotfix prioridad objectives/daily-log TASK-20260603-013)
- `npm test`: PASS (505 tests, hotfix prioridad objectives/daily-log TASK-20260603-013)
- `npm run build`: PASS (hotfix prioridad objectives/daily-log TASK-20260603-013)
