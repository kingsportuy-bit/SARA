# Desarrollo gobernado por SARA dentro de Codex

Vigente desde 2026-09-05, decisión explícita de Fito. Sustituye el despacho a
OpenCode y la condición OPENCODE_QUOTA_EXHAUSTED. Sus planes, entregas y protocolos
se conservan como historia, sin autoridad de ejecución actual.

## Una entrada y una responsabilidad

Fito habla naturalmente: «Hoy trabajamos con Barberox, pasa esto, quiero esto».
SARA identifica el proyecto, conserva su objetivo y selecciona el checkout real.
No exige comandos especiales ni que Fito vigile lecturas internas. Si el proyecto
ya está delimitado, no vuelve a pedir confirmación. Una duda real sobre qué
proyecto o regla cambiar se presenta a Fito antes de ejecutar.

Antes del plan: OPERADOR protegido, leyes, Biblia, negocio, contrato productivo,
Biblioteca y contratos de módulos/capas afectados. El paquete mínimo está en
PROJECTS.json y se entrega completo a SARA, mesa y especialistas aplicables.
La regla no depende de si la intención fue etiquetada fix, incidente o feature.
La optimización elimina historia irrelevante y duplicados; nunca leyes ni
contratos aplicables. Ningún resumen sustituye su fuente. Si el contexto no
cabe, se divide el encargo por responsabilidad manteniendo el núcleo rector.

## Recorrido

1. SARA carga fuentes y estado vigente del proyecto; identifica incumplimiento,
   nueva capacidad o cambio comercial. Comprueba emergencia/tarea y permisos.
2. Alma revisa negocio y Sol Max fronteras técnicas cuando el alcance lo requiere.
   Cada regla del plan tiene fuente, módulo dueño y criterio de aceptación.
3. Solo una decisión comercial nueva o cambio de ley/contrato vuelve a Fito con
   antes/después, impacto y recomendación. Se registra aprobación real y se
   actualizan coherentemente las fuentes ANTES de implementar. Corregir un
   incumplimiento no requiere reinventar el negocio ni pedirle que lea código.
4. Luna ejecuta el alcance acordado dentro de Codex con fuentes completas,
   pruebas propias y regresiones. Sol dirige; no hay dependencia de otro plan,
   proveedor externo, cuota de OpenCode o agente ajeno a Codex.
5. Vera revisa independientemente el mismo candidato y sus contratos, verifica
   comportamiento y vecinos, y devuelve defectos a Luna. Una misma ejecución
   no puede presentarse como revisión independiente por cambiar su nombre.
6. SARA presenta evidencia y límites. Sin cumplimiento contractual no declara
   aceptado, certificado o terminado. Una emergencia puede recuperarse antes
   de reconciliar STAGING, pero no cerrarse sin sus gates propios.

La Mesa es un conjunto de cargos, no diez procesos que deban correr siempre.
Convocar solo los pertinentes y registrar quién participó realmente. No atribuir
opiniones ni certificaciones a agentes que no fueron ejecutados.

## Paquete y verificación

Desde SARA, `node scripts/project-context.mjs --project barberox --root <checkout>
--role luna --module agenda_visual --layer C4_ROUTER --manifest <archivo.json>`.
SARA selecciona módulos/capas por análisis semántico y arquitectura; el script
no clasifica intenciones por palabras. Leer las fuentes del paquete una vez; la
salida compacta no sustituye su contenido. `--full` imprime el contenido y
`--governance full` incorpora tambien el organigrama cuando el alcance lo exige.
`--verify <archivo.json>` comprueba integridad y vigencia antes de despacho y
aceptación.
La salida y el manifiesto registran proyecto, raíz, rol, modelo y fuentes con
huella; ningún hash demuestra por sí mismo lectura ni comprensión.

El encargo requiere: objetivo, fuentes/huellas, reglas, dueño, límites, versión,
escenarios y efectos. La entrega requiere: cambios, pruebas/candidato, fallos,
pendientes, consumo disponible y riesgos. La revisión independiente requiere
comprobar el caso inicial, vecinos, permisos, idempotencia, voz, efectos y opciones
configurables. Contrato faltante, fuente vencida, contradicción sin resolver o
prueba fallida impiden aceptación. No se bloquea diagnóstico read-only por deuda
documental ajena; sí se impide fingir una certificación.

Los números configurables se comparan con configuración efectiva de la sucursal;
defaults no son leyes universales. Cambiar un override permitido no cambia la
ley; ampliar opciones o alterar invariantes sí requiere decisión comercial.

## Modelos y costos

Nombramientos técnicos: CODEX_ROLES.json. SARA/Sol/Vera usan Sol high; Luna usa
Luna high para ejecución delimitada; Alma usa Terra high; Clara/Marco/Olivia
Terra medium; Elena Sol high y Maia Terra high. Astra high se reserva a un
problema crítico que justifique escalamiento registrado; no es default.

Selección estratégica basada en capacidades disponibles en Codex y
[guía oficial de modelos](https://learn.chatgpt.com/docs/models), consultada
2026-09-05. Sol se reserva a juicio complejo, Terra a trabajo cotidiano y Luna a
encargos bien definidos. No se promete un porcentaje de ahorro ni precio API
como equivalente al consumo del plan Codex. Si Luna necesita más capacidad,
se conserva su cargo y se registra el cambio de modelo y motivo.

El despacho debe pasar explícitamente modelo y esfuerzo al mecanismo Codex
disponible. Un documento no cambia el modelo del hilo ya abierto: registrar
modelo observado cuando la herramienta lo exponga y no afirmar un cambio que
no se efectuó. Si no está disponible el modelo asignado, informar y resolver
el reemplazo; no ejecutar con sustitución silenciosa.

## Mantenimiento proporcional aprobado por Fito, 2026-09-10

SARA sigue siendo la entrada unica. Para mantenimiento de un proyecto, el
arranque corporativo no se repite dentro de cada encargo: se conserva gobierno
operativo, cargo y permisos; el organigrama completo se consulta solo cuando
el objetivo modifica organizacion o autoridad. Cada participante nuevo debe
leer sus fuentes aplicables; ninguna huella acredita lectura ni memoria.

Dentro del mismo contexto, una fuente ya leida y sin cambios no se vuelve a
imprimir. Tras perdida de contexto se recuperan las fuentes necesarias, no se
presupone recuerdo. El paquete mide tambien gobierno y dependencias normativas.
Biblia, negocio, contrato Core y fronteras aplicables no se omiten para ahorrar.

El ciclo de fix es caso reproducible y regla/owner -> prueba que detecta el
fallo -> correccion -> recorrido y vecinos -> evidencia final. Antes basta
objetivo, alcance, esperado y referencias. Durante intentos se conservan logs
y checkpoint breve. La explicacion extensa se escribe despues de validar;
una decision comercial nueva sigue requiriendo contrato aprobado primero.

En conversacion, la aceptacion incluye texto final real, estado y efectos del
mismo escenario y candidato. Una sonda de clasificacion/voz no equivale a E2E.
Un fallo conserva su evidencia y no se convierte en PASS mediante un resumen.
Emergencias, campañas, tareas, revision independiente, GO y rollback permanecen.
No se modifica producto, concurrencia ni infraestructura por esta optimizacion.

## Historia y límites

El archivo histórico está fuera del arranque. No borrar evidencia, secretos,
datos ni trabajo ajeno bajo la excusa de limpiar. Esto reorganiza desarrollo,
no cambia modelos del bot Barberox, APIs de clientes, infraestructura ni datos.
La integración en otras ramas/checkouts debe verificarse; este documento no
declara publicado lo que solo existe en una rama local.
