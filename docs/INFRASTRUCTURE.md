# INFRASTRUCTURE.md - SARA

## VPS verificado (2026-06-02)
- Host: `codexa`
- IP: `31.97.28.4`
- Usuario SSH actual: `root`
- Directorio SARA: `/opt/sara` (creado)

## Plataforma
- Docker: `29.3.0`
- Docker Swarm: activo, manager disponible
- Traefik: `traefik_traefik`, imagen `traefik:v3.4.0`
- Red de publicacion: `codexanet` (`overlay`, `swarm`)
- Puertos publicados por Traefik: `80`, `443`

## Publicacion SARA
- URL: `https://sara.codexa.uy`
- DNS: configurado mediante Cloudflare
- Patron a reutilizar: servicio Swarm conectado a `codexanet` con labels Traefik y TLS `letsencryptresolver`

## Reglas
- No modificar stacks existentes.
- No desplegar hasta tener repositorio Git remoto.
- Actualizar VPS desde Git en `/opt/sara`.
- Mantener secretos fuera del repo.
