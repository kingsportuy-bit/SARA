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
