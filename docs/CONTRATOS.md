# CONTRATOS.md - SARA

## API publica inicial (v0)

### POST /api/v1/checkins
Entrada:
- area
- energia
- foco
- estado_emocional
- observaciones

Salida:
- checkin_id
- flags_activadas
- recomendaciones

### POST /api/v1/decisions/evaluate
Entrada:
- decision_tipo
- contexto
- datos_relevantes
- protocolo_objetivo

Salida:
- decision_id
- resultado
- motivo
- protocolo_aplicado
- evidencia

### GET /api/v1/dashboard/summary
Salida:
- estado_general
- avances_semana
- desvíos
- riesgos
- ajustes_sugeridos
