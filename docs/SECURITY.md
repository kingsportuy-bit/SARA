# SECURITY.md - SARA

## Principios no negociables
- No versionar secretos reales.
- Guardar valores reales solo en `.env.local` y en el entorno seguro del VPS.
- Aplicar minimo privilegio.
- Registrar cambios criticos en `docs/CHANGELOG.md`.

## Base compartida Supabase/Postgres
SARA comparte base de datos con otras aplicaciones en produccion.

Regla absoluta:
- SARA solo puede consultar, crear, alterar o eliminar objetos cuyo nombre comience con `sara_`.
- Esto incluye tablas, vistas, funciones, triggers, secuencias, indices y politicas RLS.
- Queda prohibido inspeccionar o modificar datos de objetos ajenos salvo autorizacion explicita del operador para una auditoria puntual.
- Toda migracion debe validarse para confirmar que afecta exclusivamente objetos `sara_`.

## Supabase
- Prefijo obligatorio: `sara_`.
- `service_role` solo en backend seguro.
- Migraciones versionadas en `db/migrations`.
- Rollback documentado por migracion.
- Aplicar RLS a tablas expuestas por API cuando corresponda.

## Git
- El repositorio remoto debe crearse antes del primer deploy.
- Rama principal: `main`.
- Todo deploy parte de un commit existente en Git.
- Todo cambio relevante referencia Task ID.
- Formato de commit: `<tipo>(TASK-ID): descripcion`.

## VPS
- Host verificado: `31.97.28.4`.
- Usuario operativo actual: `root`.
- Directorio reservado: `/opt/sara`.
- Antes de desplegar, revisar el estado de Swarm, Traefik y stacks existentes.
- No modificar configuraciones de otras aplicaciones.

## Secretos esperados (sin valores en docs)
- `GIT_REPO_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `VPS_HOST`
- `VPS_USER`
- `VPS_PORT`
- `VPS_DEPLOY_PATH`
- `VPS_SSH_PRIVATE_KEY_PATH`

## Auditoria
- Incidentes de seguridad: `docs/INCIDENTS.md`.
- Cambios operativos: `docs/CHANGELOG.md`.
- Evidencia de deploy: `docs/SESSION_CLOSE.md`.
