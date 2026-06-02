# SYSTEM.md - SARA

## Fuente de verdad
Todo dato relevante debe quedar registrado para permitir analisis futuros.

## Trazabilidad obligatoria
La trazabilidad es 100% obligatoria. Cada flujo debe permitir reconstruir:
1. Origen del dato o evento.
2. Modulo que lo recibio.
3. Reglas y protocolos aplicados.
4. Decision resultante.
5. Ejecucion realizada.
6. Escritura en estado canonico.
7. Version de codigo y task relacionada.

Campos minimos por flujo:
- `trace_id`
- `request_id`
- `event_id` (si aplica)
- `module_name`
- `module_version`
- `source`
- `created_at`
- `task_id` para cambios tecnicos

## Tipos de datos
- Datos automaticos
- Datos declarados
- Aprendizajes
- Decisiones
- Eventos
- Protocolos

## Contrato de estado canonico
- `direccion_actual`
- `planes_activos`
- `objetivos_activos`
- `estado_areas`
- `metricas_clave`
- `flags_operativas`
- `riesgos_activos`
- `ultima_revision_semanal`

## Regla de gobernanza
La emocion se registra como dato contextual, pero no dispara decisiones sin pasar por protocolo.
