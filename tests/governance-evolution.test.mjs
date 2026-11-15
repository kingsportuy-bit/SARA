import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const api = await import('../scripts/governance-evolution.mjs').catch(() => ({}));
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sara-evolution-'));
  const snapshot = '{"entrypoint":"old","tenant":"isolated"}\n';
  await writeFile(path.join(root, 'snapshot.json'), snapshot);
  const tests = [{ id: 'allow-own', kind: 'positive' }, { id: 'deny-cross', kind: 'negative' }];
  const successor = { id: 'successor', contract: 'core', contractVersion: '2', risks: ['data-isolation'], scope: ['core'], covers: ['tenant-boundary'], tests, phases: ['TASK_CLOSE', 'RELEASE'], state: 'ACTIVE' };
  const receipt = JSON.stringify({ guardId: successor.id, contract: 'core', contractVersion: '2', candidate: 'fixture-v2', results: tests.map(t => ({ ...t, status: 'PASS' })) });
  await writeFile(path.join(root, 'replacement.json'), receipt);
  const old = { ...successor, id: 'historical', contractVersion: '1', state: 'HISTORICAL_ONLY', snapshot: { path: 'snapshot.json', sha256: hash(snapshot), provenance: 'fixture commit v1' }, replacement: { guardId: 'successor', evidence: { path: 'replacement.json', sha256: hash(receipt) }, reviewedBy: 'independent-fixture-reviewer' } };
  return { root, registry: { schemaVersion: 1, policyVersion: '1.0.0', contracts: [{ id: 'core', version: '2', risks: ['data-isolation'], obligations: ['tenant-boundary'] }], guards: [old, successor] } };
}

test('sucesor cubre contrato vigente y guard histórico sólo recibe snapshot auténtico', async () => {
  const { root, registry } = await fixture();
  const result = await api.validateRegistry(registry, { root });
  assert.equal(result.ok, true);
  const plan = api.selectGuards(registry, { phase: 'TASK_CLOSE', scope: ['core'] });
  assert.deepEqual(plan.map(g => g.id), ['successor']);
  const input = await api.historicalInput(registry.guards[0], { root });
  assert.equal(JSON.parse(input).entrypoint, 'old');
  await writeFile(path.join(root, 'current.json'), '{"entrypoint":"new"}');
  assert.equal(await api.historicalInput(registry.guards[0], { root }), input);
  await writeFile(path.join(root, 'snapshot.json'), 'tampered');
  await assert.rejects(api.validateRegistry(registry, { root }), /hash/i);
});

test('retiro sin cobertura sustituta, con pruebas negativas ausentes o evidencia alterada se rechaza', async () => {
  for (const mutate of [
    r => { delete r.guards[0].replacement; },
    r => { r.guards[1].covers = []; },
    r => { r.guards[1].tests = r.guards[1].tests.slice(0, 1); },
    r => { r.guards[0].replacement.evidence.sha256 = '0'.repeat(64); },
    r => { r.guards = [r.guards[0]]; },
  ]) {
    const { root, registry } = await fixture();
    mutate(registry);
    await assert.rejects(api.validateRegistry(registry, { root }));
  }
});

test('borrar un guard previo o degradar su cobertura no permite retiro silencioso', async () => {
  const { root, registry } = await fixture();
  const previous = structuredClone(registry);
  registry.guards = registry.guards.slice(1);
  await assert.rejects(api.validateRegistry(registry, { root, previous }), /borr|missing|elimin/i);
});

test('no permite debilitar alcance, fases o pruebas de un ACTIVE previo', async () => {
  for (const mutate of [g => { g.scope = ['unrelated']; }, g => { g.phases = ['RELEASE']; }, g => { g.tests[1].id = 'weaker-test'; }]) {
    const { root, registry } = await fixture();
    const previous = structuredClone(registry);
    mutate(registry.guards[1]);
    await assert.rejects(api.validateRegistry(registry, { root, previous }));
  }
});

test('recibo contradictorio o con pruebas duplicadas no acredita sustitución', async () => {
  const { root, registry } = await fixture();
  const file = path.join(root, 'replacement.json');
  const receipt = JSON.parse(await readFile(file, 'utf8'));
  receipt.results.push({ id: 'deny-cross', kind: 'negative', status: 'FAIL' });
  const text = JSON.stringify(receipt);
  await writeFile(file, text);
  registry.guards[0].replacement.evidence.sha256 = hash(text);
  await assert.rejects(api.validateRegistry(registry, { root }), /prueba|recibo|cobertura/i);
});

test('fallos de permisos bloquean dependientes; tooling no bloquea independiente ni inventa PASS', () => {
  const selected = [{ id: 'permissions' }];
  for (const failureClass of ['SECURITY_OR_DATA_RISK', 'CURRENT_CONTRACT_REGRESSION', 'PRODUCT_DEFECT']) {
    const result = api.summarizeResults(selected, [{ id: 'permissions', status: 'FAIL', failureClass }]);
    assert.equal(result.dependentWorkBlocked, true);
    assert.equal(result.phaseStatus, 'FAIL');
  }
  const tooling = api.summarizeResults(selected, [{ id: 'permissions', status: 'FAIL', failureClass: 'CERTIFICATION_TOOLING_FAILURE' }]);
  assert.equal(tooling.independentDevelopmentAllowed, true);
  assert.equal(tooling.phaseStatus, 'FAIL');
  assert.equal(api.summarizeResults(selected, []).phaseStatus, 'PENDING');
  assert.equal(api.summarizeResults(selected, [{ id: 'permissions', status: 'SKIP' }]).phaseStatus, 'PENDING');
  assert.throws(() => api.summarizeResults(selected, [{ id: 'permissions', status: 'FAIL', failureClass: 'unknown' }]));
});

test('perfiles distintos no heredan release ni historia en desarrollo de UI', async () => {
  const { registry } = await fixture();
  registry.guards.push({ ...registry.guards[1], id: 'ui', scope: ['ui'], phases: ['DEVELOPMENT'] });
  assert.deepEqual(api.selectGuards(registry, { phase: 'DEVELOPMENT', scope: ['ui'] }).map(g => g.id), ['ui']);
  assert.throws(() => api.selectGuards(registry, { phase: 'TYPO', scope: ['ui'] }));
  const analysis = api.analyzeEvolution(registry, [{ contract: 'core', from: '2', to: '3' }]);
  assert.deepEqual(analysis.affectedGuards.sort(), ['successor', 'ui']);
  assert.ok(analysis.uncoveredRisks.includes('data-isolation'));
});

test('regresiones B2/F5 conservan procedencia histórica y detectan recibo sin pruebas reales', async () => {
  const source = new URL('./fixtures/governance/B2-F5.json', import.meta.url);
  const cases = JSON.parse(await readFile(source, 'utf8'));
  assert.equal(cases.length, 2);
  for (const entry of cases) {
    assert.ok(entry.source.sha256.match(/^[a-f0-9]{64}$/));
    const snapshot = await readFile(new URL(`./fixtures/governance/${entry.id}.md`, import.meta.url));
    assert.equal(hash(snapshot), entry.source.sha256);
    const { root, registry } = await fixture();
    // Un artefacto histórico preservado es válido para su etapa, mientras el
    // contrato nuevo exige su propia evidencia positiva y negativa.
    await writeFile(path.join(root, 'snapshot.json'), snapshot);
    registry.guards[0].snapshot = { path: 'snapshot.json', sha256: entry.source.sha256, provenance: entry.source.path };
    assert.equal(await api.historicalInput(registry.guards[0], { root }), snapshot.toString('utf8'));
    assert.equal((await api.validateRegistry(registry, { root })).ok, true);
    const fakeReceipt = JSON.stringify({ guardId: 'successor', contract: 'core', contractVersion: '2', candidate: 'fixture-v2', results: [] });
    await writeFile(path.join(root, 'replacement.json'), fakeReceipt);
    registry.guards[0].replacement.evidence.sha256 = hash(fakeReceipt);
    await assert.rejects(api.validateRegistry(registry, { root }), /prueba|coverage|cobertura/i);
  }
});
