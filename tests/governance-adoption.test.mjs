import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as evolution from '../scripts/governance-evolution.mjs';
import { planProjectOS, applyProjectOS, BINDING_PATH } from '../scripts/project-os.mjs';
import { buildProjectContext } from '../scripts/project-context.mjs';

const configRoot = path.resolve('.');
async function fixture(existing = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sara-adoption-'));
  await mkdir(path.join(root, 'docs'));
  if (existing) await writeFile(path.join(root, 'AGENTS.md'), '# Local\nLos gates actuales mandan.\n');
  await writeFile(path.join(root, 'docs/INICIAL.md'), '# Entrada\n');
  return { root, project: 'sample', configRoot };
}
const contextOptions = (f, state = 'PENDING_ADOPTION') => ({ ...f, role: 'clara', configuration: { roles: [{ id: 'clara', model: 'selected', reasoningEffort: 'medium' }], projects: [{ id: f.project, requiredSources: ['AGENTS.md', 'docs/INICIAL.md'], moduleBase: 'docs/biblioteca/modulos', layerBase: 'docs/biblioteca/capas', governanceEvolution: { state } }] } });

test('R1 distingue mismo fallo, regresión, reparación y evidencia ausente sin perdonar riesgos previos', () => {
  const result = evolution.compareBaseline(
    { candidate: 'base', results: [{ id: 'old', status: 'FAIL', fingerprint: 'cause-a' }, { id: 'new', status: 'PASS' }, { id: 'fixed', status: 'FAIL', fingerprint: 'cause-b' }, { id: 'missing', status: 'PASS' }] },
    { candidate: 'head', results: [{ id: 'old', status: 'FAIL', fingerprint: 'cause-a' }, { id: 'new', status: 'FAIL', fingerprint: 'cause-c' }, { id: 'fixed', status: 'PASS' }] });
  assert.deepEqual(result.preexisting, ['old']);
  assert.deepEqual(result.regressions, ['new']);
  assert.deepEqual(result.resolved, ['fixed']);
  assert.deepEqual(result.missing, ['missing']);
  assert.equal(result.phaseStatus, 'FAIL');
  assert.throws(() => evolution.compareBaseline({ candidate: '', results: [] }, { candidate: 'x', results: [] }));
});

test('R1 fallo cambiado y control nuevo fallido son regresiones; SKIP no es resolución', () => {
  const result = evolution.compareBaseline({ candidate: 'base', results: [{ id: 'x', status: 'FAIL', fingerprint: 'a' }, { id: 'skip', status: 'FAIL', fingerprint: 'b' }] },
    { candidate: 'head', results: [{ id: 'x', status: 'FAIL', fingerprint: 'different' }, { id: 'fresh', status: 'FAIL', fingerprint: 'c' }, { id: 'skip', status: 'SKIP' }] });
  assert.deepEqual(result.regressions, ['x', 'fresh']);
  assert.deepEqual(result.resolved, []);
  assert.deepEqual(result.missing, ['skip']);
});

test('R4 agrupa causas verificadas y conserva owner, alcance y todos los fallos', () => {
  const result = evolution.diagnoseFailures([
    { id: 'a', cause: 'stale-fixture', owner: 'qa', scope: ['panel'] },
    { id: 'b', cause: 'stale-fixture', owner: 'qa', scope: ['api'] },
    { id: 'c', cause: 'tenant-leak', owner: 'auth', scope: ['api'] },
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { cause: 'stale-fixture', owner: 'qa', failures: ['a', 'b'], scope: ['panel', 'api'] });
  assert.throws(() => evolution.diagnoseFailures([{ id: 'a', owner: 'qa', scope: ['api'] }]));
});

test('R5 cierra sólo con objetivos demostrados y sin bloqueantes aplicables', () => {
  const input = { objectives: [{ id: 'compatibility', status: 'PASS' }], blockers: [{ id: 'unrelated', applicable: false, status: 'OPEN' }], improvements: ['cache adicional'] };
  assert.deepEqual(evolution.evaluateClosure(input), { mode: 'CLOSE', deferred: [{ improvement: 'cache adicional', status: 'DEFERRED_OPTIMIZATION' }] });
  assert.equal(evolution.evaluateClosure({ ...input, blockers: [{ id: 'security', applicable: true, status: 'OPEN' }] }).mode, 'CONTINUE');
  assert.equal(evolution.evaluateClosure({ ...input, objectives: [{ id: 'compatibility', status: 'SKIP' }] }).mode, 'CONTINUE');
  assert.equal(evolution.evaluateClosure({ ...input, objectives: [] }).mode, 'CONTINUE');
});

test('R2 pendiente devuelve gates anteriores incluso si el registro nuevo es incompatible', () => {
  const legacyGuards = [{ id: 'tenant-check' }, { id: 'historical-certification' }];
  const result = evolution.planValidation(null, { state: 'PENDING_ADOPTION', legacyGuards, phase: 'RELEASE', scope: ['api'] });
  assert.deepEqual(result.guards, legacyGuards);
  assert.equal(result.enforced, false);
  assert.equal(evolution.planValidation({ guards: [{ id: 'api', state: 'ACTIVE', phases: ['DEVELOPMENT'], scope: ['api'], risks: [] }, { id: 'release', state: 'ACTIVE', phases: ['RELEASE'], scope: ['api'], risks: [] }] }, { state: 'ACTIVE', legacyGuards, phase: 'DEVELOPMENT', scope: ['api'] }).guards[0].id, 'api');
  assert.throws(() => evolution.planValidation(null, { state: 'TYPO', legacyGuards }));
});

test('preparar existente conserva gates/CI y no activa metodología ni exige adopción para contexto', async () => {
  const f = await fixture();
  await mkdir(path.join(f.root, '.github/workflows'), { recursive: true });
  await writeFile(path.join(f.root, '.github/workflows/ci.yml'), 'legacy-ci-exact-bytes\r\n');
  await writeFile(path.join(f.root, 'guard.mjs'), 'throw new Error("deny");\n');
  const before = await buildProjectContext(contextOptions(f));
  await applyProjectOS(await planProjectOS(f), { configRoot });
  const binding = JSON.parse(await readFile(path.join(f.root, BINDING_PATH)));
  assert.equal(binding.state, 'PENDING_ADOPTION');
  const after = await buildProjectContext(contextOptions(f));
  assert.equal(after.governanceEvolution.state, 'PENDING_ADOPTION');
  assert.equal(after.governanceEvolution.enforced, false);
  for (const s of before.sources.filter(s => s.path !== 'AGENTS.md')) assert.equal(after.sources.find(n => n.path === s.path).sha256, s.sha256);
  assert.equal(await readFile(path.join(f.root, '.github/workflows/ci.yml'), 'utf8'), 'legacy-ci-exact-bytes\r\n');
  assert.equal(await readFile(path.join(f.root, 'guard.mjs'), 'utf8'), 'throw new Error("deny");\n');
  binding.policyVersion = '0.0.0';
  await writeFile(path.join(f.root, BINDING_PATH), JSON.stringify(binding));
  assert.equal((await buildProjectContext(contextOptions(f))).governanceEvolution.enforced, false);
});

test('proyecto nuevo nace activo y actualización conserva estado idempotentemente', async () => {
  const f = await fixture(false);
  await applyProjectOS(await planProjectOS({ ...f, newProject: true }), { configRoot });
  assert.equal(JSON.parse(await readFile(path.join(f.root, BINDING_PATH))).state, 'ACTIVE');
  assert.equal((await planProjectOS(f)).changes.length, 0);
});

test('un repositorio sin AGENTS no se considera nuevo automáticamente', async () => {
  const f = await fixture(false);
  await applyProjectOS(await planProjectOS(f), { configRoot });
  assert.equal(JSON.parse(await readFile(path.join(f.root, BINDING_PATH))).state, 'PENDING_ADOPTION');
  const existing = await fixture();
  await assert.rejects(planProjectOS({ ...existing, newProject: true }), /nuevo|existente/i);
});

test('activar existente exige auditoría/compatibilidad PASS y autorización ligada a proyecto y raíz', async () => {
  const f = await fixture();
  await applyProjectOS(await planProjectOS(f), { configRoot });
  await assert.rejects(planProjectOS({ ...f, activate: true }), /autoriz|evidencia/i);
  const evidence = { project: f.project, root: f.root, authorizedBy: 'Fito', decision: 'ACTIVATE_GOVERNANCE_EVOLUTION', audit: 'PASS', compatibility: 'PASS' };
  const bytes = JSON.stringify(evidence);
  await writeFile(path.join(f.root, 'adoption.json'), bytes);
  const authorization = { path: 'adoption.json', sha256: evolution.sha256(bytes) };
  const plan = await planProjectOS({ ...f, activate: true, authorization });
  await applyProjectOS(plan, { configRoot });
  // The central profile is updated only after the authorized installation.
  assert.equal((await buildProjectContext(contextOptions(f, 'ACTIVE'))).governanceEvolution.enforced, true);
  assert.equal((await planProjectOS(f)).changes.length, 0);
  await writeFile(path.join(f.root, 'adoption.json'), JSON.stringify({ ...evidence, project: 'other' }));
  await assert.rejects(buildProjectContext(contextOptions(f, 'ACTIVE')), /hash|autoriz/i);
});

test('perfil ACTIVE no se degrada por referencia corrupta, ausente o estado cambiado', async () => {
  const f = await fixture(false);
  await applyProjectOS(await planProjectOS({ ...f, newProject: true }), { configRoot });
  const binding = JSON.parse(await readFile(path.join(f.root, BINDING_PATH)));
  for (const content of ['broken-json', JSON.stringify({ ...binding, state: 'PENDING_ADOPTION' }), JSON.stringify({ ...binding, state: 'TYPO' })]) {
    await writeFile(path.join(f.root, BINDING_PATH), content);
    await assert.rejects(buildProjectContext(contextOptions(f, 'ACTIVE')));
  }
  const missing = await fixture();
  await assert.rejects(buildProjectContext(contextOptions(missing, 'ACTIVE')));
});

test('perfil pendiente nunca activa por sidecar local aunque declare ACTIVE', async () => {
  const f = await fixture(false);
  await applyProjectOS(await planProjectOS({ ...f, newProject: true }), { configRoot });
  assert.equal((await buildProjectContext(contextOptions(f))).governanceEvolution.enforced, false);
});

test('actualizar versión de metodología conserva adopción pendiente y es idempotente', async () => {
  const f = await fixture();
  const central = await mkdtemp(path.join(os.tmpdir(), 'sara-policy-update-'));
  for (const file of ['docs/organization/GOVERNANCE_POLICY.json', 'docs/organization/EVOLUCION_GOBERNANZA.md', 'templates/project-os/GOVERNANCE_REFERENCE.md']) {
    await mkdir(path.dirname(path.join(central, file)), { recursive: true });
    await writeFile(path.join(central, file), await readFile(path.join(configRoot, file)));
  }
  const options = { ...f, configRoot: central };
  await applyProjectOS(await planProjectOS(options), { configRoot: central });
  const policyPath = path.join(central, 'docs/organization/GOVERNANCE_POLICY.json');
  const policy = JSON.parse(await readFile(policyPath));
  policy.policyVersion = '1.0.1';
  await writeFile(policyPath, JSON.stringify(policy));
  await applyProjectOS(await planProjectOS(options), { configRoot: central });
  const binding = JSON.parse(await readFile(path.join(f.root, BINDING_PATH)));
  assert.equal(binding.state, 'PENDING_ADOPTION');
  assert.equal(binding.policyVersion, '1.0.1');
  assert.equal((await planProjectOS(options)).changes.length, 0);
});

test('activar rechaza autorización de otro proyecto y compatibilidad no demostrada', async () => {
  const f = await fixture();
  await applyProjectOS(await planProjectOS(f), { configRoot });
  for (const patch of [{ project: 'other' }, { compatibility: 'SKIP' }, { audit: 'FAIL' }, { authorizedBy: 'agent' }]) {
    const bytes = JSON.stringify({ project: f.project, root: f.root, authorizedBy: 'Fito', decision: 'ACTIVATE_GOVERNANCE_EVOLUTION', audit: 'PASS', compatibility: 'PASS', ...patch });
    await writeFile(path.join(f.root, 'denied.json'), bytes);
    await assert.rejects(planProjectOS({ ...f, activate: true, authorization: { path: 'denied.json', sha256: evolution.sha256(bytes) } }));
  }
});

test('perfil pendiente tolera junction interna y referencia opcional corrupta sin gates nuevos', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sara-pending-junction-'));
  await mkdir(path.join(root, 'actual-docs'));
  await symlink(path.join(root, 'actual-docs'), path.join(root, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(path.join(root, 'AGENTS.md'), '# Local\n');
  await writeFile(path.join(root, 'docs/INICIAL.md'), '# Entrada\n');
  const f = { root, project: 'sample', configRoot };
  assert.equal((await buildProjectContext(contextOptions(f))).governanceEvolution.enforced, false);
  await writeFile(path.join(root, BINDING_PATH), 'invalid-json');
  assert.equal((await buildProjectContext(contextOptions(f))).governanceEvolution.enforced, false);
});
