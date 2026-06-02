# LEY_ARQUITECTURA.md - SARA

## Principio central
NO MEZCLAR CAPAS DE RESPONSABILIDAD.

Esta es la ley primera de construccion. No se acepta una implementacion que funcione mezclando responsabilidades.

## Leyes derivadas
1. Cada funcionalidad pertenece a un modulo propietario.
2. Los modulos se comunican solo mediante contratos publicos versionados.
3. Cada cambio funcional incluye tests propios y ejecuta la regresion existente.
4. Agregar un modulo no debe modificar comportamiento existente salvo cambio explicito y documentado.
5. Toda entrada, decision, ejecucion y escritura de estado debe ser trazable.
6. La base compartida solo puede ser accedida mediante objetos propios con prefijo `sara_`.

## Adaptacion clave para SARA
SARA es API-first: no usa n8n como runtime de orquestacion. Toda automatizacion y decision corre por servicios API, jobs y eventos con contratos versionados.

## Capas core sugeridas (C1-C8)
- C1 Contexto: construccion de estado operativo vigente.
- C2 Origen: deteccion de superficie (app, API, cron, importacion, manual).
- C3 Clasificacion: parseo semantico + tipado de evento/intencion.
- C4 Routing: seleccion de modulo propietario.
- C5 Decision de dominio: reglas por area (finanzas, salud, etc.).
- C6 Politica y recomendacion: aplicacion de protocolos y generacion de salida.
- C7 Ejecucion: persistencia de acciones, eventos, tareas o ajustes.
- C8 Writer canonico de estado: unico punto de escritura del estado agregado.

## Estado y banderas (flags)
Usar estado estructurado y flags es normal y recomendable. Se define:
- `fase_sistema`
- `estado_area`
- `session_ctx`
- `plan_ctx`
- `metricas_ctx`
- `flags` (bloqueos, riesgos, protocolos activos)

Regla: un solo writer canonico actualiza el estado agregado para evitar inconsistencias.

## Antipatrones prohibidos
- Mezclar decision de negocio con acceso a DB y salida al usuario en el mismo modulo.
- Permitir multiples writers sobre el mismo estado agregado.
- Acoplar modulos por internals en lugar de contratos publicos API/evento.
- Tomar decisiones criticas sin evidencia de datos.
- Consultar, crear, alterar o eliminar tablas, vistas, funciones, triggers, politicas o secuencias ajenas al prefijo `sara_`.
- Incorporar funcionalidad sin tests del modulo y sin ejecutar regresion.
