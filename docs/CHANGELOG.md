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
