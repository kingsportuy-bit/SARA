# DEPLOY.md - SARA

## Objetivo
Desplegar SARA desde Git hacia el VPS sin alterar servicios existentes.

## Infraestructura verificada (2026-06-02)
- VPS: `codexa` (`31.97.28.4`).
- Directorio reservado: `/opt/sara`.
- Runtime: Docker `29.3.0`.
- Orquestacion: Docker Swarm activo con nodo manager.
- Proxy: servicio `traefik_traefik` con Traefik `v3.4.0`.
- Red compartida para publicacion: overlay Swarm `codexanet`.
- URL publica: `https://sara.codexa.uy`.
- TLS: resolver Traefik `letsencryptresolver`.

## Flujo obligatorio
1. Implementar localmente dentro de una task aprobada.
2. Ejecutar tests del modulo y regresion.
3. Registrar evidencia y actualizar `docs/CHANGELOG.md`.
4. Commit y push al repositorio Git.
5. En VPS, actualizar `/opt/sara` desde Git.
6. Construir la imagen Docker desde el codigo actualizado.
7. Desplegar o actualizar el stack Swarm `sara`.
8. Verificar servicio, logs, Traefik y smoke test en `https://sara.codexa.uy`.
9. Registrar resultado del deploy y riesgos residuales.

## Restricciones
- No copiar codigo manualmente al VPS como flujo normal de deploy.
- No modificar stacks, redes, labels o archivos de otras aplicaciones.
- No publicar puertos directos si Traefik puede enrutar el servicio.
- Conectar el servicio web de SARA a `codexanet`.
- Reusar el patron validado de las apps existentes antes del primer deploy.

## Labels Traefik esperadas
- `traefik.enable=true`
- `traefik.docker.network=codexanet`
- Router HTTPS con regla `Host(\`sara.codexa.uy\`)`
- `traefik.http.routers.sara.tls.certresolver=letsencryptresolver`
- Puerto interno del servicio definido por la app

## Rollback
1. Volver en Git al ultimo commit estable.
2. Actualizar `/opt/sara` desde Git.
3. Reconstruir imagen y redeployar stack `sara`.
4. Ejecutar smoke tests.
5. Registrar incidente en `docs/INCIDENTS.md`.
