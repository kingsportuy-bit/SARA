# Evolución de contratos y controles — política 1.0.0

Autoridad: encargo explícito de Fito «SARA — Gobernanza evolutiva para todos
los proyectos», 2026-11-09. Owner: SARA. Implementación: tooling documental;
no cambia negocio, permisos, producto, release ni autoridad de OPERADOR.
Contrato declarativo: `GOVERNANCE_POLICY.json`. Este documento y ese contrato
se cargan siempre mediante `scripts/project-context.mjs` y se verifican por SHA-256.

## Adopción: preparar globalmente, corregir individualmente, activar por proyecto

Mandato corregido de Fito, 2026-11-09: MASTER WP de gobernanza evolutiva y
optimización de certificaciones. SARA aplica esta metodología; los proyectos
existentes registrados en PROJECTS quedan `PENDING_ADOPTION`. La presencia de
este documento en un paquete NO activa reglas, no añade gates bloqueantes,
no sustituye pruebas ni invalida controles/certificaciones de un proyecto.
Su gobierno vigente prevalece hasta una adopción expresamente autorizada.
Una referencia pendiente desactualizada no bloquea la carga del contexto.

Cada adopción exige auditar arquitectura/pruebas/guards/certificaciones,
clasificar controles, verificar seguridad/datos/funcionalidad, corregir sólo
deuda justificada, validar compatibilidad y obtener autorización de Fito.
Sólo entonces `ACTIVE`; no se migra ningún proyecto durante este WP.
Los proyectos nuevos reciben la metodología desde su creación, sin heredar
matrices, IDs, suites ni certificaciones pesadas de Barberox.

## R1 — Baseline

Identificar base y candidato, ejecutar los controles aplicables con inputs
comparables y conservar resultados/fingerprint de causa. `compareBaseline`
distingue fallo preexistente, nuevo/cambiado, resuelto y evidencia ausente.
Un resultado SKIP/ausente nunca acredita resolución. Un fallo previo sigue
siendo fallo; su clasificación no autoriza release ni omite riesgos críticos.

## R4 — Diagnóstico antes de reparación

Antes de corregir, asignar causa verificada, owner y alcance a cada fallo.
`diagnoseFailures` agrupa por causa y owner conservando todos los fallos y
superficies. No infiere una causa por similitud de texto. Reparar cada grupo y
revalidar sus consumidores dentro del mismo candidato cuando sea válido;
evitar una certificación integral por síntoma. No oculta fallos independientes.

## R5 — Modo cierre

`evaluateClosure` exige objetivos PASS y cero bloqueantes abiertos aplicables.
Objetivo ausente, PENDING o SKIP impide cierre. Alcance completo significa
detener optimizaciones: mejoras adicionales son `DEFERRED_OPTIMIZATION`.
El dictamen es local a esa fase y no concede GO ni certificación de producto.

## Responsabilidad y evolución

Cada control declara id, contrato y versión, riesgos, alcance, obligaciones que
cubre, pruebas responsables, fases, estado y evidencia de reemplazo si existe.
Estados: ACTIVE protege versión vigente; SUPERSEDED fue reemplazado con cobertura
demostrada; HISTORICAL_ONLY evalúa únicamente snapshot auténtico de su etapa;
RETIRED no participa en validación activa. Nunca borrar controles o evidencia.
Un guard de seguridad/datos con riesgo vigente no puede abandonar ACTIVE sin un
sucesor ACTIVE que cubra todas sus obligaciones y riesgos, pruebas positivas y
negativas, evidencia con hash y revisión independiente. No hay retiro automático.

Al cambiar un contrato relevante, registrar brevemente en la tarea: contrato
antes/después, controles afectados, pruebas nuevas, controles a actualizar,
controles históricos y riesgos sin cubrir. En cambios triviales basta N/A con
motivo. Reutilizar la tarea actual; no abrir otra cadena de candidatos.
`analyzeEvolution` comprueba las versiones declaradas y devuelve controles y
riesgos; no deduce impacto semántico ni sustituye el juicio del owner.

## Tres niveles de validación

- DEVELOPMENT: compilación, focales y pruebas afectadas.
- TASK_CLOSE: integración real, contratos actuales y seguridad pertinente.
- RELEASE: certificación integral, instalación, migraciones, rollback y evidencia
  adicional que exija el proyecto.

Los perfiles seleccionan controles explícitos por fase y alcance. Un cambio de
UI no activa automáticamente controles históricos o de release. Autorización,
aislamiento, persistencia, transacciones y contratos críticos conservan controles
fuertes: cualquier exclusión necesita análisis de impacto y revisión, nunca una
etiqueta de interfaz para eludirlos. Las reglas específicas de cada proyecto
pueden añadir exigencias; la política común no las rebaja silenciosamente.
`planValidation` devuelve la selección anterior intacta si la adopción está
pendiente; sólo ACTIVE usa `selectGuards`. No es un ejecutor ni modifica CI.

## Autoridad histórica y fallos

Un control histórico sólo recibe su snapshot, contrato versionado, procedencia y
SHA-256. Nunca exige que el árbol actual reproduzca una arquitectura reemplazada.
El sucesor valida su versión actual y preserva pruebas negativas. Los incidentes
B2/F5 se representan como fixtures de artefactos históricos y sucesores; no se
agregan excepciones por nombre de proyecto, tarea o guard al código común.

Clasificaciones obligatorias: PRODUCT_DEFECT, SECURITY_OR_DATA_RISK,
CURRENT_CONTRACT_REGRESSION, HISTORICAL_TEST_INCOMPATIBILITY,
CERTIFICATION_TOOLING_FAILURE y ENVIRONMENT_FAILURE. Las tres primeras bloquean
trabajo dependiente según severidad/alcance. Las otras requieren registro, owner
y reparación; no bloquean automáticamente trabajo independiente. Un fallo de un
control obligatorio, un resultado ausente o un SKIP impiden PASS de esa fase.
Continuar desarrollo independiente nunca equivale a autorizar publicación.
`summarizeResults` informa elegibilidad de la fase, no certifica producto ni GO.

## Instalación y actualización

La fuente oficial existente es PROJECTS.json + project-context.mjs. No había
instalador OS genérico: `project-os.mjs` añade una referencia mínima a la política,
no otro OS. Plantilla: `templates/project-os/GOVERNANCE_REFERENCE.md`.
Una creación explícita `--new` usa esa plantilla como AGENTS mínimo; ausencia
de AGENTS no demuestra proyecto nuevo. Un OS existente recibe sólo
un bloque delimitado al final de AGENTS, conservando sus bytes previos y reglas.
OPERADOR jamás se modifica. Sidecar `docs/SARA_GOVERNANCE.json` registra versión,
fuente central, hashes y bloque administrado; no duplica la política.

Primero `node scripts/project-os.mjs --project <id> --root <checkout>` genera una
comparación JSON sin escrituras. `--plan <archivo>` la conserva. Después
`--apply <archivo>` revalida raíz real, fuente central, plantilla y todos los
bytes previos antes de escribir sólo esas dos rutas. El plan concreto y los
permisos del encargo deben autorizar el destino. Conflictos locales, versión
desconocida o enlaces que salen del checkout requieren resolución, no overwrite.
Repetir la operación es idempotente. No sincroniza checkouts ni migra guards.
El paquete informa `governanceEvolution.state/enforced`. Los perfiles de OS
registrados quedan preparados centralmente sin escribir sus checkouts. Si se
instala una referencia local en un OS existente, nace PENDING_ADOPTION y no
cambia ningún gate. La actualización conserva ese estado. Sólo una adopción
activa verifica versión/huella como exigencia operativa adicional.
El perfil en PROJECTS (o la configuration explícita y gobernada del llamador)
es la autoridad del estado. Mientras esté pendiente, el cargador ni lee ni
valida el sidecar opcional: no añade restricciones de escritura a una lectura.
Para activar se instala primero la referencia autorizada y después, dentro de
la intervención individual aprobada, se cambia su perfil central a ACTIVE.
Ambas partes son necesarias. Un perfil ACTIVE con referencia corrupta, ausente
o no activa falla explícitamente, nunca se degrada a pendiente. Al registrar
un proyecto nuevo, su perfil nace ACTIVE y su referencia se instala con --new.
Activación local: `--activate --authorization <descriptor.json>` al preparar
el plan; el descriptor contiene path relativo y SHA-256 de evidencia que
identifica proyecto/raíz, authorizedBy=Fito,
decision=ACTIVATE_GOVERNANCE_EVOLUTION, audit=PASS y compatibility=PASS.
El mecanismo verifica coherencia e integridad; no prueba la autenticidad humana
del contenido. El agente debe tener la autorización real en el encargo y nunca
fabricarla. Esta operación no se ejecuta en proyectos existentes en este WP.

Inventariar perfiles registrados y OS detectados por separado; una carpeta no
es permiso ni versión instalada. Ausencia de versión significa UNVERSIONED,
no versión inferida. Checkouts múltiples se reportan sin elegir por nombre.

Pruebas SARA: `npm test` ejecuta sólo `tests/**/*.test.ts` y después
`test:governance` con Node. No descubre suites de worktrees copiados, no mezcla
node:test con Vitest y no ejecuta certificaciones de proyectos externos.

## Costo y aceptación

Registrar tiempo de validación, controles seleccionados, bytes del paquete,
pruebas ejecutadas y consumo sólo si el entorno lo expone. No prometer ahorro.
Congelar alcance al satisfacer aceptación; mejoras opcionales quedan pendientes.
Revisión independiente antes de aceptar cambios materiales de este tooling.
La prueba local del mecanismo no certifica ni reabre B2/F5 ni otros productos.
