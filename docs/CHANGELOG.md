# CHANGELOG.md - SARA

2026-05-31 | v0.1.0 | bootstrap | estructura inicial documental y arquitectura API-first
2026-05-31 | v0.1.1 | gobernanza | checklist bootstrap completado y task TASK-20260531-001 promovida a APPROVED
2026-05-31 | v0.1.2 | security | matriz RBAC y politicas de acceso Git/Supabase/VPS definidas sin secretos en repo
2026-06-02 | v0.1.3 | gobernanza | ley primera de capas, modularidad, tests por cambio y trazabilidad 100% formalizadas
2026-06-02 | v0.1.4 | infra | VPS Swarm y Traefik verificados, `/opt/sara` creado, URL `sara.codexa.uy` documentada y base compartida aislada por prefijo `sara_`
2026-06-02 | v0.1.5 | architecture | flujo Chatwoot personal, buffer durable de 20 segundos, dos etapas LLM, modulos de accion y writer canonico diagramados
2026-06-02 | v0.1.6 | security | secretos retirados de `.env.example`, integraciones trasladadas a `.env.local` y claves Chatwoot/DeepSeek normalizadas
2026-06-02 | v0.2.0 | chatwoot-bootstrap | servicio Fastify, migracion `sara_*`, buffer durable, bypass temporal DeepSeek, salida Chatwoot, stack Swarm y tests iniciales implementados
2026-06-02 | v0.2.1 | deploy | stack `sara_api` desplegado `1/1`, migracion aplicada, webhook Chatwoot `id=13` registrado y smoke HTTPS validado
2026-06-02 | v0.2.2 | chatwoot-scope | alcance personal migrado a `account=7`, `inbox=45`, `conversation=85`; webhook de SARA movido al account correcto y descarte de copias externas cubierto por test
2026-06-02 | v0.2.3 | traceability | writer canonico extendido para registrar cada ejecucion del worker en `sara_processing_runs` con estados `started`, `completed` y `failed`
2026-06-02 | v0.2.4 | hotfix | alias explicito agregado al `RETURNING` del writer trazable para evitar ambiguedad PostgreSQL durante el reclamo de buffers
2026-06-02 | v0.2.5 | agents | protocolo operativo de opencode agregado como agente ejecutor sin decision propia
2026-06-02 | v0.2.6 | analysis | informe integral de arquitectura, operativa y features preparado para revision experta
2026-06-02 | v0.2.7 | analysis | correccion experta incorporada: session-context, daily-log, current_value por eventos, clasificador en dos pasos y Delta como bounded context separado
2026-06-02 | v0.2.8 | agents | documentos previos a opencode completados: entity catalog Fase A, task TASK-20260602-004 y regla de revision Codex
2026-06-02 | v0.2.9 | onboarding | INICIAL actualizado como puerta de entrada real para nuevos hilos y sesiones opencode
2026-06-02 | v0.2.10 | analysis | informe actualizado para experto sobre cobertura documental pre-opencode
2026-06-02 | v0.2.11 | agents | roles Codex Orquestador y opencode explicitados en INICIAL y AGENTS
2026-06-02 | v0.2.12 | agents | regla anti-scope-creep agregada para revisar entregas de opencode
2026-06-02 | v0.2.13 | pipeline | esqueleto modular de comprension y respuesta: contratos TypeScript (coarse-classifier, module-intent-classifier, module-router, action-executor, response-composer), 5 modulos skeleton con guardas `intentConfidenceSufficient`, 5 test suites (22 tests), bootstrap mantenido como fallback
2026-06-02 | v0.2.14 | planning | TASK-20260602-005 preparada para implementar `notes.create` con alcance cerrado: solo `sara_events`, `sara_notes`, writer canonico, contratos y tests
2026-06-02 | v0.3.0 | notes | `notes.create` primer modulo real: migracion `sara_events` + `sara_notes` + RPC `sara_create_note`, contratos `notes.ts`, `notesModule` con validacion de contenido/tipo, `notesStore` adaptador Supabase, `registerModule`/`createActionExecutor` con handlers, detector de intencion `notes.create` por patrones, 22 tests nuevos (55 total), documentacion actualizada
2026-06-02 | v0.3.1 | hotfix | RPC `sara_create_note` corregida a `search_path = public`, `actionExecutor` con guarda de contenido para `notes.create` (bloquea si content falta/vacio), `responseComposer` verifica evidencia `noteId`/`eventId` antes de confirmar ejecucion, +7 tests de regresion (62 total)
2026-06-02 | v0.3.2 | hotfix | `ActionExecutionInput` extendido con `intentConfidence`/`intentMissingData`, `actionExecutor` valida confidence >= 0.75 y missingData vacio para `notes.create`, `responseComposer` exige ambos `noteId` && `eventId` para confirmar, +7 tests de guardas (69 total)
2026-06-02 | v0.3.3 | hotfix | `actionExecutor` ahora bloquea `notes.create` si `intentMissingData` es undefined o no-array (no solo si tiene elementos), +2 tests de borde (71 total), `TEST_SUITE.md` corregido "y" en vez de "o"
2026-06-03 | v0.3.4 | planning | TASK-20260603-006 preparada para conectar `notes.create` al worker post-buffer con DeepSeek como fallback, sin deploy ni migraciones nuevas
2026-06-03 | v0.4.0 | pipeline | `bufferProcessor` conecta `notes.create` al worker real: `coarseClassifier` detecta modulo `notes` por patrones, `supabaseStore` comparte cliente con `notesStore`, `server.ts` registra handler y wiring completo, DeepSeek como fallback solo para mensajes sin accion ejecutable, +10 tests (82 total)
2026-06-03 | v0.4.1 | docs | nota bootstrap en `CONTRATOS.md` actualizada para reflejar worker post-buffer con pipeline modular y fallback DeepSeek
2026-06-03 | v0.4.2 | fix | `stripChatwootHeader` en `patterns.ts` remueve encabezado markdown `**autor:**` antes de clasificar; coarse y fine classifier normalizan contenido para detectar `notes.create` en mensajes de grupo Chatwoot; +4 tests (86 total)
2026-06-03 | v0.4.3 | planning | TASK-20260603-007 preparada para extraer normalizacion Chatwoot a capa propia y completar MVP read-only de notas con `notes.list` y `notes.search`
2026-06-03 | v0.5.0 | normalization | capa `messageNormalizer` creada con contrato propio; encabezado de grupo Chatwoot removido antes de clasificadores; `stripChatwootHeader` eliminado de `patterns.ts`, `coarseClassifier` y `moduleIntentClassifier`; `bufferProcessor` normaliza contenido antes de pipeline; `notes.list` y `notes.search` implementados con repositorio read-only sobre `sara_notes`; deteccion de intenciones de listar/buscar notas en clasificador grueso y fino; `responseComposer` formatea resultados de list/search; wiring completo en `server.ts`; +45 tests (131 total); documentacion actualizada
2026-06-03 | v0.5.1 | hardening | `messageNormalizer` restringido a encabezados Chatwoot con telefono + autor para no borrar markdown bold legitimo al inicio; +1 test de regresion (132 total)
2026-06-03 | v0.5.2 | hotfix | `responseComposer` numera resultados de notas desde 1 en respuestas list/search; test de regresion agregado
2026-06-03 | v0.5.3 | planning | TASK-20260603-008 preparada para implementar modulo `tasks` MVP con `sara_tasks`, eventos `task_created`/`task_completed`, acciones create/list/complete y alcance cerrado sin recordatorios/calendario
2026-06-03 | v0.6.0 | tasks | TASK-20260603-008 implementado: migracion `sara_tasks` con RPCs `sara_create_task` y `sara_complete_task`, contratos `tasks.ts`, `tasksModule` con validaciones de negocio, `tasksStore` adaptador Supabase, deteccion de modulo `tasks` en `coarseClassifier`, deteccion de intenciones `tasks.create`/`tasks.list`/`tasks.complete` en `moduleIntentClassifier`, guards generalizados en `actionExecutor`, respuestas en `responseComposer`, wiring completo en `server.ts`, +63 tests (195 total), documentacion actualizada
2026-06-03 | v0.6.1 | hardening | `sara_complete_task` rechaza `titleMatch` ambiguo y solo completa por titulo cuando hay una unica tarea pendiente coincidente; test de migracion agregado
2026-06-03 | v0.6.2 | planning | TASK-20260603-009 preparada para implementar `session-context` MVP: foco conversacional efimero, upsert/get/clear de `sara_session_contexts`, eventos trazables y resolucion segura de referencias simples
