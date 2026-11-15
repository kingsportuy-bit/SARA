import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const POLICY_PATH = 'docs/organization/GOVERNANCE_POLICY.json';
export const POLICY_DOC = 'docs/organization/EVOLUCION_GOBERNANZA.md';
export const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const strings = value => Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string' && v.trim());

// Reused by the OS updater and evidence reader: lexical and real containment.
export async function localPath(root, relative) {
  requireValue(typeof relative === 'string' && relative && !path.isAbsolute(relative), 'Ruta local relativa requerida');
  const base = await fs.realpath(root);
  const target = path.resolve(base, relative);
  const inside = candidate => { const rel = path.relative(base, candidate); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
  requireValue(inside(target), 'Ruta fuera del checkout');
  // Check nearest existing ancestor, including junctions, even for new files.
  let ancestor = target;
  for (;;) {
    try { requireValue(inside(await fs.realpath(ancestor)), 'Symlink fuera del checkout'); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); }
  }
  return target;
}

export async function loadPolicy(root = CONFIG_ROOT) {
  const policy = JSON.parse(await fs.readFile(await localPath(root, POLICY_PATH), 'utf8'));
  requireValue(policy.schemaVersion === 1 && /^1\.\d+\.\d+$/.test(policy.policyVersion), 'Versión de política no soportada');
  return policy;
}

async function evidenceBytes(record, root) {
  requireValue(record && /^[a-f0-9]{64}$/i.test(record.sha256), 'Evidencia requiere hash SHA-256');
  const bytes = await fs.readFile(await localPath(root, record.path));
  requireValue(sha256(bytes) === record.sha256.toLowerCase(), `Hash de evidencia no coincide: ${record.path}`);
  return bytes.toString('utf8');
}

export async function historicalInput(guard, { root }) {
  requireValue(guard.state === 'HISTORICAL_ONLY' && guard.snapshot?.provenance?.trim(), 'Snapshot histórico requiere procedencia');
  return evidenceBytes(guard.snapshot, root);
}

export async function validateRegistry(registry, { root, previous, configRoot } = {}) {
  const start = performance.now();
  const policy = await loadPolicy(configRoot);
  requireValue(registry?.schemaVersion === 1 && registry.policyVersion === policy.policyVersion, 'Versión de registro inválida');
  requireValue(Array.isArray(registry.contracts) && Array.isArray(registry.guards), 'Contratos y guards requeridos');
  const guards = new Map();
  const contracts = new Map();
  for (const contract of registry.contracts) {
    requireValue(contract.id && contract.version && strings(contract.risks) && strings(contract.obligations) && !contracts.has(contract.id), 'Contrato inválido/duplicado');
    contracts.set(contract.id, contract);
  }
  for (const guard of registry.guards) {
    requireValue(policy.requiredGuardFields.every(field => Object.hasOwn(guard, field)), 'Guard incompleto');
    requireValue(typeof guard.id === 'string' && guard.id && !guards.has(guard.id), 'Guard duplicado/inválido');
    requireValue(policy.states.includes(guard.state) && strings(guard.risks) && strings(guard.scope) && strings(guard.covers), 'Estado, riesgo o cobertura inválidos');
    requireValue(strings(guard.phases) && guard.phases.every(p => policy.phases.includes(p)), 'Fase inválida');
    requireValue(Array.isArray(guard.tests) && guard.tests.length && new Set(guard.tests.map(t => t.id)).size === guard.tests.length && guard.tests.every(t => t.id && ['positive', 'negative'].includes(t.kind)), 'Pruebas responsables inválidas');
    requireValue(contracts.has(guard.contract) && typeof guard.contractVersion === 'string', 'Contrato de guard desconocido');
    const current = contracts.get(guard.contract);
    if (guard.state === 'ACTIVE') {
      requireValue(guard.contractVersion === current.version, 'Guard ACTIVE sobre versión no vigente');
      if (guard.risks.some(r => policy.strongRisks.includes(r))) {
        requireValue(guard.tests.some(t => t.kind === 'negative') && guard.tests.some(t => t.kind === 'positive'), 'Riesgo fuerte requiere pruebas positivas y negativas');
        requireValue(guard.phases.includes('TASK_CLOSE') && guard.phases.includes('RELEASE'), 'Riesgo fuerte requiere cierre y release');
      }
    }
    guards.set(guard.id, guard);
  }
  if (previous) for (const old of previous.guards) {
    const next = guards.get(old.id);
    requireValue(next, `No borrar guard previo: ${old.id}`);
    requireValue(old.risks.every(r => next.risks.includes(r)) && old.covers.every(c => next.covers.includes(c)), 'No degradar cobertura previa; registrar sucesión');
    requireValue(old.contract === next.contract && old.contractVersion === next.contractVersion, 'Versionar guard sucesor sin reescribir identidad histórica');
    requireValue(old.scope.every(s => next.scope.includes(s)) && old.phases.every(p => next.phases.includes(p)) && old.tests.every(t => next.tests.some(n => n.id === t.id && n.kind === t.kind)), 'No degradar alcance, fases o pruebas previas; registrar sucesión');
  }
  for (const guard of registry.guards) {
    if (guard.state === 'HISTORICAL_ONLY') await historicalInput(guard, { root });
    const current = contracts.get(guard.contract);
    if (guard.state === 'ACTIVE') continue;
    const protectsLiveRisk = guard.risks.some(r => current.risks.includes(r));
    if (!protectsLiveRisk && guard.state !== 'SUPERSEDED') continue;
    const replacement = guard.replacement;
    const next = guards.get(replacement?.guardId);
    requireValue(next?.state === 'ACTIVE' && next.contract === guard.contract && next.id !== guard.id, 'Retiro requiere sucesor ACTIVE');
    requireValue(guard.covers.every(c => next.covers.includes(c)) && guard.risks.every(r => next.risks.includes(r)), 'Sucesor sin cobertura completa');
    requireValue(guard.scope.every(s => next.scope.includes(s)) && guard.phases.every(p => next.phases.includes(p)), 'Sucesor sin cobertura de alcance/fases');
    requireValue(typeof replacement.reviewedBy === 'string' && replacement.reviewedBy.trim(), 'Revisión independiente requerida');
    const receipt = JSON.parse(await evidenceBytes(replacement.evidence, root));
    requireValue(receipt.guardId === next.id && receipt.contract === next.contract && receipt.contractVersion === next.contractVersion && typeof receipt.candidate === 'string' && receipt.candidate.trim(), 'Recibo no corresponde al sucesor/candidato');
    requireValue(Array.isArray(receipt.results) && receipt.results.length === next.tests.length && new Set(receipt.results.map(r => r.id)).size === receipt.results.length && receipt.results.every(r => r.status === 'PASS') && next.tests.every(t => receipt.results.some(r => r.id === t.id && r.kind === t.kind && r.status === 'PASS')), 'Recibo sin cobertura exacta de pruebas PASS del sucesor');
  }
  for (const contract of registry.contracts) {
    const active = registry.guards.filter(g => g.state === 'ACTIVE' && g.contract === contract.id);
    requireValue(contract.obligations.every(o => active.some(g => g.covers.includes(o))) && contract.risks.every(r => active.some(g => g.risks.includes(r))), 'Contrato vigente con riesgos/cobertura sin proteger');
  }
  return { ok: true, guards: guards.size, elapsedMs: performance.now() - start };
}

export function selectGuards(registry, { phase, scope }) {
  requireValue(['DEVELOPMENT', 'TASK_CLOSE', 'RELEASE'].includes(phase) && strings(scope), 'Fase/alcance inválido');
  return registry.guards.filter(g => g.state === 'ACTIVE' && g.phases.includes(phase) && g.scope.some(s => scope.includes(s)));
}

// Planning only: no runner, CI, task or project files are changed here.
export function planValidation(registry, { state, legacyGuards, phase, scope }) {
  requireValue(['ACTIVE', 'PENDING_ADOPTION'].includes(state), 'Estado de adopción inválido');
  if (state === 'PENDING_ADOPTION') {
    requireValue(Array.isArray(legacyGuards), 'Conservar gates anteriores requiere selección anterior');
    return { guards: legacyGuards, enforced: false };
  }
  return { guards: selectGuards(registry, { phase, scope }), enforced: true };
}

export function compareBaseline(baseline, current) {
  for (const run of [baseline, current]) {
    requireValue(typeof run?.candidate === 'string' && run.candidate.trim() && Array.isArray(run.results), 'Baseline/candidato identificable requerido');
    requireValue(new Set(run.results.map(r => r.id)).size === run.results.length && run.results.every(r => typeof r.id === 'string' && r.id && ['PASS', 'FAIL', 'SKIP'].includes(r.status) && (r.status !== 'FAIL' || typeof r.fingerprint === 'string' && r.fingerprint.trim())), 'Resultados requieren identidad y fingerprint de fallo');
  }
  const previous = new Map(baseline.results.map(r => [r.id, r]));
  const observed = new Map(current.results.map(r => [r.id, r]));
  const preexisting = [], regressions = [], resolved = [];
  for (const result of current.results) {
    const before = previous.get(result.id);
    if (result.status === 'FAIL') {
      (before?.status === 'FAIL' && before.fingerprint === result.fingerprint ? preexisting : regressions).push(result.id);
    } else if (result.status === 'PASS' && before?.status === 'FAIL') resolved.push(result.id);
  }
  const missing = [...new Set([...previous.keys(), ...observed.keys()])].filter(id => !observed.has(id) || observed.get(id).status === 'SKIP');
  return { baseline: baseline.candidate, candidate: current.candidate, preexisting, regressions, resolved, missing,
    phaseStatus: preexisting.length || regressions.length ? 'FAIL' : missing.length || !current.results.length ? 'PENDING' : 'PASS' };
}

export function diagnoseFailures(failures) {
  requireValue(Array.isArray(failures), 'Fallos requeridos');
  const groups = new Map(), ids = new Set();
  for (const failure of failures) {
    requireValue(typeof failure.id === 'string' && failure.id && !ids.has(failure.id) && typeof failure.cause === 'string' && failure.cause.trim() && typeof failure.owner === 'string' && failure.owner.trim() && strings(failure.scope), 'Diagnóstico requiere fallo, causa verificada, owner y alcance');
    ids.add(failure.id);
    const key = JSON.stringify([failure.cause, failure.owner]);
    const group = groups.get(key) ?? { cause: failure.cause, owner: failure.owner, failures: [], scope: [] };
    group.failures.push(failure.id);
    group.scope = [...new Set([...group.scope, ...failure.scope])];
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function evaluateClosure({ objectives, blockers, improvements = [] }) {
  requireValue(Array.isArray(objectives) && Array.isArray(blockers) && Array.isArray(improvements), 'Objetivos/bloqueantes/mejoras requeridos');
  requireValue(objectives.every(o => o.id && ['PASS', 'FAIL', 'PENDING', 'SKIP'].includes(o.status)) && blockers.every(b => b.id && typeof b.applicable === 'boolean' && ['OPEN', 'RESOLVED'].includes(b.status)) && improvements.every(i => typeof i === 'string' && i.trim()), 'Evidencia de cierre inválida');
  const close = objectives.length > 0 && objectives.every(o => o.status === 'PASS') && !blockers.some(b => b.applicable && b.status !== 'RESOLVED');
  return { mode: close ? 'CLOSE' : 'CONTINUE', deferred: close ? improvements.map(improvement => ({ improvement, status: 'DEFERRED_OPTIMIZATION' })) : [] };
}

export async function validateAdoptionAuthorization(authorization, { root, project }) {
  const evidence = JSON.parse(await evidenceBytes(authorization, root));
  requireValue(evidence.project === project && await fs.realpath(evidence.root) === await fs.realpath(root) && evidence.authorizedBy === 'Fito' && evidence.decision === 'ACTIVATE_GOVERNANCE_EVOLUTION' && evidence.audit === 'PASS' && evidence.compatibility === 'PASS', 'Autorización de activación requiere proyecto/raíz, auditoría y compatibilidad PASS');
  return evidence;
}

export function analyzeEvolution(registry, changes) {
  const affected = registry.guards.filter(g => g.state === 'ACTIVE' && changes.some(c => c.contract === g.contract && c.from === g.contractVersion && c.to !== c.from));
  return { affectedGuards: affected.map(g => g.id), newTestsRequired: affected.flatMap(g => g.tests.map(t => t.id)), updateGuards: affected.map(g => g.id), historicalCandidates: affected.map(g => g.id), uncoveredRisks: [...new Set(affected.flatMap(g => g.risks))], decision: 'Owner debe justificar sucesión y cobertura; no hay retiro automático.' };
}

export function summarizeResults(selected, results) {
  const classes = ['PRODUCT_DEFECT', 'SECURITY_OR_DATA_RISK', 'CURRENT_CONTRACT_REGRESSION', 'HISTORICAL_TEST_INCOMPATIBILITY', 'CERTIFICATION_TOOLING_FAILURE', 'ENVIRONMENT_FAILURE'];
  requireValue(new Set(results.map(r => r.id)).size === results.length && results.every(r => selected.some(g => g.id === r.id) && ['PASS', 'FAIL', 'SKIP'].includes(r.status) && (r.status !== 'FAIL' || classes.includes(r.failureClass))), 'Resultado/clasificación inválido');
  const failures = results.filter(r => r.status === 'FAIL');
  return { phaseStatus: failures.length ? 'FAIL' : selected.length && selected.every(g => results.some(r => r.id === g.id && r.status === 'PASS')) ? 'PASS' : 'PENDING', dependentWorkBlocked: failures.some(r => classes.slice(0, 3).includes(r.failureClass)), independentDevelopmentAllowed: true, failures, missing: selected.filter(g => !results.some(r => r.id === g.id && r.status !== 'SKIP')).map(g => g.id) };
}
