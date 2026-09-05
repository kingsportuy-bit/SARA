# Reestructuración SARA/Codex — evidencia de trabajo

Fecha 2026-09-05. Pedido de Fito: puerta única por proyecto, leyes/contratos
obligatorios, Luna ejecutora principal en Codex, OpenCode retirado y roles/modelos
claros. No cambiar el funcionamiento productivo de Barberox en esta etapa.

## Cambios

Entradas AGENTS/INICIAL dirigen al gobierno de proyectos; Personal conserva
su CLI y privacidad. Organigrama conserva cargos, reemplaza ejecución OpenCode
por Luna y registra modelos/esfuerzos en CODEX_ROLES.json. Todos los nombramientos
son provisionales con calibración explícitamente pendiente, no una declaración
de calidad de todos los agentes. Modelos disponibles según herramientas Codex
y documentación oficial https://learn.chatgpt.com/docs/models, consultada hoy.

Originales preservados en docs/historico/gobierno-pre-codex-20260905. Protocolos
retirados quedan como marcadores hacia fuente vigente, sin condición de cuota.
Reportes antiguos identifican sus instrucciones de ejecución como históricas.

En Barberox se reconcilian AGENTS, INICIAL, gobierno, guía, protocolo, registro
documental e índice de protocolos; se conserva emergencia abierta. Borradores
de aceptación/configuración preparados antes de que Fito redirigiera el trabajo
fueron archivados como no integrados, no se presentan como controles activos.

## Participación real

- Coordinación: agente de esta tarea; no se afirma cambio del modelo del hilo.
- Luna: subagente Codex gpt-5.6-luna high, lector/verificador y tests.
- Vera: subagente Codex gpt-5.6-sol high, revisión independiente de fuentes y código.
- Otros cargos registrados no fueron convocados ni se les atribuye aprobación.

Vera detectó omisión de contratos referenciados en backticks, incompatibilidad
con labels Markdown y falta de campos de nombramiento. Se devolvieron al dueño
para corrección antes de aceptación. Esta revisión es de gobierno y herramientas,
no una certificación integral del producto Barberox ni de sus H01-H08.

## Qué garantiza y qué no

El lector produce texto completo y manifiesto verificable. La verificación
detecta fuentes faltantes/cambiadas y paquetes incompletos; no demuestra que un
agente comprendió ni que un plan cumple semánticamente. Eso exige revisión
responsable e independiente. El comando tampoco intercepta todas las herramientas
de Codex: AGENTS obliga a usarlo antes del despacho y de aceptar, y cada revisión
debe exigir su evidencia. No describirlo como una barrera técnica imposible de omitir.

El registro de modelos se pasa al despacho: no modifica silenciosamente el
selector de un hilo existente. Un cambio global de modelo/configuración de cuenta
no fue realizado. Ningún secreto, dato personal ni mensaje real forma parte de
estas pruebas. No se midió ahorro monetario y no se inventa una cifra.

## Validación y ubicación

Resultados finales: tests6/6 sin skip; catalogo real35/35 (27 fichas y8capas);
Luna reporto ademas216/216 pares. Manifiesto generado y verificado. Vera reviso
independientemente y emitio PASS focal, no certificacion de Barberox.
Archivo historico12/12 coincide con fuente previa normalizando LF. El diff
de historia conserva intencionalmente lineas finales originales; diff vigente
sin errores. Barberox validate-docs full PASS y OPERADOR sin modificaciones.
Commit Barberox f8e39d587ce5f46a8f51e1ba937643cb3a3cb3a7 integrado por fast-forward
en su checkout habitual; ningun nuevo deploy. Scripts/registro de modelos y
fuentes se versionan juntos con este informe en SARA.
El checkout habitual de SARA tiene cambios ajenos en package.json y archivos
sin seguimiento; deben permanecer intactos al integrar solo esta rama.
La rama Barberox conserva reconciliación productiva pendiente y no cierra la emergencia.
