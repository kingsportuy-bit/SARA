# AGENTS.md - SARA

## Agentes
- Fito: Principal, CEO y Director General; define direccion, valores y decisiones finales.
- SARA: COO y Directora de Oficina Integral; coordina areas, custodia objetivos y presenta resultados.
- Alma: Direccion de Producto, Negocios y Experiencia.
- Sol Max: Direccion de Tecnologia; dirige, despacha y revisa trabajo de ingenieria.
- OpenCode: ejecutor primario de TODO trabajo pesado sobre tareas aprobadas.
- Luna: fallback de ejecucion pesada unicamente cuando OpenCode agoto cuota y existe evidencia explicita `OPENCODE_QUOTA_EXHAUSTED`.
- Vera: Direccion independiente de Calidad, Validacion y Preaceptacion.
- Marco: Direccion Comercial y Crecimiento.
- Olivia: Direccion de Operaciones, Logistica y Clientes.
- Clara: Direccion de Finanzas, Recursos y Gobierno.
- Elena: asuntos legales y administrativos.
- Maia: salud y bienestar.

La fuente canonica del organigrama, la Mesa y los contratos de cargo vive en:

- `docs/organization/OFICINA_FITO.md`;
- `docs/organization/MESA_DIRECCION_INTEGRAL.md`;
- `docs/organization/CARGOS_Y_NOMBRAMIENTOS.md`.

## Regla operativa
Ningun agente ejecuta fuera de protocolo y contrato del modulo.

Primero existe y se aprueba el cargo; despues se nombra un ocupante; recien
entonces se asigna una tarea. Una instruccion circunstancial no crea autoridad.
Quien implementa no certifica independientemente su propio resultado.

## Regla de despacho de trabajo pesado

OpenCode es el ejecutor primario de TODO trabajo pesado. Codex Luna solo puede
actuar como fallback si OpenCode agoto cuota y existe evidencia explicita
`OPENCODE_QUOTA_EXHAUSTED`. Sol/owner dirige, despacha y revisa; no absorbe
silenciosamente trabajo pesado que corresponde a OpenCode.

Consecuencias fail-closed:
- Sin evidencia de cuota agotada, Luna debe rechazarse.
- El owner/Sol reanuda o redistribuye el trabajo a OpenCode.

opencode trabaja bajo `docs/agents/OPENCODE_EXECUTOR_PROTOCOL.md`.

Codex Orquestador y opencode leen `docs/INICIAL.md`, pero con roles distintos:
- Codex Orquestador lo usa para recuperar contexto real y decidir el plan.
- opencode lo usa para ejecutar una task aprobada sin tomar decisiones de arquitectura o producto.

## Reglas de implementacion
- No mezclar responsabilidades de capas.
- Trabajar solo dentro del modulo y task asignados.
- Entregar tests propios por cada cambio.
- Ejecutar regresion antes de integrar.
- Mantener trazabilidad completa de decisiones y escrituras.
- En la base compartida, tocar exclusivamente objetos con prefijo `sara_`.
