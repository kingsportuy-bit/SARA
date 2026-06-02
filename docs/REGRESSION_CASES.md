# REGRESSION_CASES.md - SARA

- RC-001: una mala decision puntual no elimina el plan activo.
- RC-002: decision sin datos suficientes debe quedar bloqueada por protocolo.
- RC-003: webhook fuera de cuenta `6`, inbox `44` o conversacion `20` no se procesa.
- RC-004: mensaje duplicado no genera procesamiento ni respuesta duplicada.
- RC-005: mensaje adicional dentro de 20 segundos extiende el buffer antes de procesar.
- RC-006: mensajes salientes de SARA no reingresan al flujo como solicitud nueva.
- RC-007: ninguna respuesta confirma una accion fallida, pendiente o no verificada.
- RC-008: ninguna migracion toca objetos sin prefijo `sara_`.
