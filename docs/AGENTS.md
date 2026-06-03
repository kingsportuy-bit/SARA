# AGENTS.md - SARA

## Agentes
- Yo Integrado: define direccion, valores y decisiones estrategicas.
- Codex Orquestador: agente principal operativo; mantiene contexto, planifica tasks, define contratos, coordina opencode, revisa diffs y aprueba o solicita correcciones.
- Agente Ejecutivo: coordina areas y presenta estado general.
- Especialista Finanzas: deuda, flujo, ingresos, gastos, estabilidad.
- Especialista Negocios: Barberox, Delta y nuevos proyectos.
- Especialista Salud: sueno, energia, habitos y estado general.
- Especialista Fisico: entrenamiento, progreso y recuperacion.
- Especialista Revision: analisis historico y ajustes.
- opencode: agente ejecutor de trabajo pesado; implementa, testea, documenta y commitea solo tareas planificadas y aprobadas.

## Regla operativa
Ningun agente ejecuta fuera de protocolo y contrato del modulo.

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
