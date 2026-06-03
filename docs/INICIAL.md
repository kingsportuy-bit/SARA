# INICIAL.md - SARA

## Estado del sistema (actualizado: 2026-06-03)
- Produccion: worker post-buffer con pipeline modular operativo en VPS
- En progreso: normalizacion de mensajes Chatwoot como capa propia y cierre MVP read-only de notas
- Bloqueos activos: activar firma HMAC de Chatwoot cuando se recupere `CHATWOOT_WEBHOOK_SECRET`
- Primer flujo vertical: Chatwoot -> buffer durable -> DeepSeek bootstrap -> respuesta Chatwoot -> trazabilidad `sara_*`
- Pipeline modular base: implementado y validado; DeepSeek queda como fallback solo para mensajes sin accion ejecutable.
- Primer modulo real: `notes.create` implementado, conectado al worker, desplegado y probado en produccion con `sara_notes` + `sara_events`.

## Stack actual
- Backend: Node.js 22 + TypeScript + Fastify
- Frontend: pendiente
- DB: Supabase/Postgres compartida
- Infra: VPS `codexa` + Docker Swarm + Traefik + red `codexanet`
- URL: https://sara.codexa.uy

## Alcance Chatwoot vigente
- Account: `7`
- Inbox: `45`
- Conversation: `85`
- Solo mensajes `message_created` entrantes.
- Todo otro account, inbox, conversacion o mensaje saliente se ignora.

## Regla madre no negociable
LAS DECISIONES SE TOMAN CON DATOS Y PROTOCOLOS, NO CON EL ESTADO EMOCIONAL DEL MOMENTO.

## Ley primera de arquitectura
NO MEZCLAR CAPAS DE RESPONSABILIDAD.

Reglas derivadas:
- Las normalizaciones del canal (por ejemplo encabezados de grupos Chatwoot) viven antes de los clasificadores, no dentro de modulos de dominio.
- Cada modulo tiene propietario y contrato.
- El LLM clasifica o redacta, pero no decide ejecutar.
- Las reglas de negocio viven en codigo.
- Las acciones se confirman solo despues de ejecutarse y verificarse.
- Las acciones destructivas requieren confirmacion explicita.
- Todo estado importante se registra con trazabilidad.
- En DB compartida solo se tocan objetos con prefijo `sara_`.

## Mapa de lectura obligatoria (orden)
1. docs/BIBLIA.md
2. docs/LEY_ARQUITECTURA.md
3. docs/AGENTS.md
4. docs/SYSTEM.md
5. docs/BUSINESS.md
6. docs/CONTRATOS.md
7. docs/ARQUITECTURA_CHATWOOT_V1.md
8. docs/ENTITY_CATALOG.md
9. docs/INFORME_ANALISIS_ARQUITECTURA_FEATURES.md
10. docs/agents/OPENCODE_EXECUTOR_PROTOCOL.md
11. docs/DEBUG.md
12. docs/DEPLOY.md
13. docs/INFRASTRUCTURE.md
14. docs/SECURITY.md
15. docs/TEST_SUITE.md
16. docs/REGRESSION_CASES.md
17. docs/ERROR_REGISTRY.md
18. docs/biblioteca/README.md

## Roles al iniciar un hilo nuevo
- Codex Orquestador: agente principal del proyecto. Lee `docs/INICIAL.md`, mantiene contexto, planifica, define contratos, prepara tasks para opencode, revisa diffs, valida evidencia y decide si se aprueba o se piden correcciones.
- opencode: agente ejecutor. Lee `docs/INICIAL.md` y la task asignada, implementa exactamente el alcance aprobado, documenta, valida y commitea. No decide feature, arquitectura ni alcance.

## Forma de trabajo con opencode
- Codex/orquestador planifica, define contratos y criterios de aceptacion.
- opencode ejecuta trabajo pesado solo sobre task aprobada.
- opencode no decide feature, arquitectura ni alcance.
- opencode debe leer `docs/INICIAL.md` al inicio de cada sesion de trabajo.
- opencode tambien debe leer la task asignada y los documentos obligatorios indicados en ella.
- Si falta informacion, opencode se bloquea y pide decision; no inventa supuestos.
- Codex revisa el diff completo y valida con `npm run typecheck`, `npm test` y `npm run build` antes de aprobar.

## Task activa o proxima
- Task: TASK-20260603-007
- Estado: APPROVED
- Owner: opencode
- Objetivo: separar normalizacion de mensajes Chatwoot como capa propia y completar MVP read-only de notas (`notes.list` y `notes.search`) sin crear nuevas tablas.

## Ultimo cierre de sesion
- Fecha: 2026-06-02
- Referencia: docs/SESSION_CLOSE.md#2026-06-02

