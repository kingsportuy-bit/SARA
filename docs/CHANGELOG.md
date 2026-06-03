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
