import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyDirectionIdentity } from '../scripts/direction-identity.mjs';
import { reviewDirection } from '../scripts/direction-gate.mjs';
import { buildProjectContext, verifyProjectContext, writeProjectContext } from '../scripts/project-context.mjs';
import { fileURLToPath } from 'node:url';

const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('Regresiones A–F de identidad y distribución de revisión DIR-10', async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'sara-direction-'));
  const authority = path.join(base, 'repo');
  const remote = path.join(base, 'remote.git');
  const candidateA = path.join(base, 'candidate-a');
  const candidateB = path.join(base, 'candidate-b');
  git(base, 'init', '--bare', remote);
  git(base, 'clone', remote, authority);
  git(authority, 'config', 'user.name', 'R01 test');
  git(authority, 'config', 'user.email', 'r01@example.invalid');
  await writeFile(path.join(authority, 'tracked.txt'), 'A\n');
  await writeFile(path.join(authority, '.gitignore'), '.local/\nsrc/ignored.ts\n');
  git(authority, 'add', 'tracked.txt', '.gitignore');
  git(authority, 'commit', '-m', 'A');
  const a = git(authority, 'rev-parse', 'HEAD');
  await writeFile(path.join(authority, 'tracked.txt'), 'B\n');
  git(authority, 'commit', '-am', 'B');
  const b = git(authority, 'rev-parse', 'HEAD');
  git(authority, 'checkout', '-b', 'authority', a);
  await writeFile(path.join(authority, 'direction.txt'), 'DIR-03\n');
  const manualEvidence = 'Aprobación manual de fixture para el objetivo y su alcance.\n';
  await writeFile(path.join(authority, 'approval-evidence.txt'), manualEvidence);
  await mkdir(path.join(authority, 'docs', 'decisions'), { recursive: true });
  await writeFile(path.join(authority, 'docs', 'decisions', 'initial.md'), 'Decisión inicial\n');
  git(authority, 'add', 'direction.txt', 'approval-evidence.txt', 'docs/decisions/initial.md');
  git(authority, 'commit', '-m', 'authority');
  git(authority, 'push', 'origin', 'HEAD:refs/heads/governance');
  git(authority, 'worktree', 'add', '--detach', candidateA, a);
  git(authority, 'worktree', 'add', '--detach', candidateB, b);
  const input = { authorityRoot: authority, authorityRemote: remote, authorityRef: 'refs/heads/governance', candidateRoot: candidateA, candidateSha: a, blockedCheckpoint: b };
  await t.test('A: identidad SDK-first comprobable sin certificar P06', async () => {
    const accepted = await verifyDirectionIdentity(input);
    assert.equal(accepted.candidateSha, a);
    assert.equal(accepted.authoritySha, git(authority, 'rev-parse', 'HEAD'));
  });
  const operatorRoot = path.join(base, 'operator');
  git(base, 'init', operatorRoot);
  git(operatorRoot, 'config', 'user.name', 'R01 test');
  git(operatorRoot, 'config', 'user.email', 'r01@example.invalid');
  git(operatorRoot, 'remote', 'add', 'origin', remote);
  await mkdir(path.join(operatorRoot, 'docs'));
  await writeFile(path.join(operatorRoot, 'docs', 'OPERADOR.md'), 'protegido\n');
  git(operatorRoot, 'add', 'docs/OPERADOR.md');
  git(operatorRoot, 'commit', '-m', 'protected');
  const config = { authorityRemote: remote, authorityRef: 'refs/heads/governance', decisionRegister: 'direction.txt', checkpoints: { B: b }, protectedOperator: { remote, commit: git(operatorRoot, 'rev-parse', 'HEAD') } };
  const direction = { purpose: 'review', candidateRoot: candidateA, candidateSha: a, objective: 'revisión', applicable: ['DIR-03'], superseded: ['conductor histórico'], continuity: 'sin certificar continuidad', entrypoint: 'tracked.txt', constraints: ['sin ejecución'] };
  const gate = { root: authority, config, direction, operatorPath: path.join(operatorRoot, 'docs', 'OPERADOR.md') };
  assert.equal((await reviewDirection(gate)).outcome, 'REVIEW_ONLY');
  const directionPath = path.join(base, 'review.json');
  await writeFile(directionPath, JSON.stringify(direction));
  const configuration = { roles: ['sara', 'luna', 'sol', 'vera'].map((id) => ({ id, model: 'test-model', reasoningEffort: 'medium' })), projects: [{ id: 'fixture', requiredSources: ['direction.txt'], moduleBase: 'docs', layerBase: 'docs', directionGate: config }] };
  const configRoot = fileURLToPath(new URL('..', import.meta.url));
  const args = { root: authority, project: 'fixture', role: 'sara', configuration, configRoot, directionPath, operatorPath: gate.operatorPath };
  const manifest = path.join(base, 'context.json');
  const result = await writeProjectContext({ ...args, manifest });
  assert.equal(result.context.directionGate.outcome, 'REVIEW_ONLY');
  assert.equal(result.context.executionAuthorized, false);
  assert.ok(result.context.sources.some((source) => source.path === 'docs/decisions/initial.md'));
  const verified = await verifyProjectContext(manifest, { configuration, configRoot });
  assert.equal(verified.directionOutcome, 'REVIEW_ONLY');
  assert.equal(verified.executionAuthorized, false);
  assert.match(verified.limitation, /revisión independiente pendiente/);
  await t.test('F: paquetes de revisión para los cuatro roles conservan objetivo y restricciones', async () => {
    for (const role of ['sara', 'luna', 'sol', 'vera']) {
      const context = await buildProjectContext({ ...args, role, modules: ['m'], layers: ['l'], configuration: { ...configuration, projects: [{ ...configuration.projects[0], moduleBase: 'direction.txt', layerBase: 'direction.txt' }] } });
      assert.equal(context.role, role);
      assert.equal(context.executionAuthorized, false);
      assert.equal(context.directionGate.objective, direction.objective);
      assert.deepEqual(context.directionGate.constraints, direction.constraints);
      assert.ok(context.sources.some((source) => source.path === 'docs/decisions/initial.md'));
    }
  });
  await assert.rejects(reviewDirection({ ...gate, direction: { ...direction, purpose: 'execute' } }), { code: 'DIRECTION_GATE_BLOCKED' });
  await assert.rejects(reviewDirection({ ...gate, direction: { ...direction, applicable: ['DIR-03', 'DIR-99'] } }), { code: 'DIRECTION_GATE_BLOCKED' });
  await assert.rejects(reviewDirection({ ...gate, direction: { ...direction, entrypoint: '.local/hidden.ts' } }), { code: 'DIRECTION_GATE_BLOCKED' });
  await writeFile(path.join(operatorRoot, 'docs', 'OPERADOR.md'), 'modificado\n');
  await assert.rejects(reviewDirection(gate), { code: 'DIRECTION_GATE_BLOCKED' });
  git(operatorRoot, 'restore', 'docs/OPERADOR.md');
  await mkdir(path.join(candidateA, '.local'), { recursive: true });
  await writeFile(path.join(candidateA, '.local', 'report.log'), 'artefacto local');
  await verifyDirectionIdentity(input);
  await mkdir(path.join(candidateA, 'src'), { recursive: true });
  await writeFile(path.join(candidateA, 'src', 'new.ts'), 'export const changed = true;');
  await assert.rejects(verifyDirectionIdentity(input), { code: 'DIRECTION_GATE_BLOCKED' });
  await rm(path.join(candidateA, 'src', 'new.ts'));
  await writeFile(path.join(candidateA, 'src', 'ignored.ts'), 'export const hidden = true;');
  await assert.rejects(verifyDirectionIdentity(input), { code: 'DIRECTION_GATE_BLOCKED' });
  await rm(path.join(candidateA, 'src', 'ignored.ts'));
  await t.test('B: candidato histórico bloqueado', async () => {
    await assert.rejects(verifyDirectionIdentity({ ...input, candidateRoot: candidateB, candidateSha: b }), { code: 'DIRECTION_GATE_BLOCKED' });
  });
  await assert.rejects(verifyDirectionIdentity({ ...input, candidateSha: b }), { code: 'DIRECTION_GATE_BLOCKED' });
  await t.test('E: referencia remota ausente o no verificable bloqueada', async () => {
    await assert.rejects(verifyDirectionIdentity({ ...input, authorityRef: 'refs/heads/missing' }), { code: 'DIRECTION_GATE_BLOCKED' });
    await assert.rejects(reviewDirection({ ...gate, config: { ...config, decisionRegister: 'missing.md' } }), { code: 'DIRECTION_GATE_BLOCKED' });
  });
  await writeFile(path.join(candidateA, 'tracked.txt'), 'changed\n');
  await assert.rejects(verifyDirectionIdentity(input), { code: 'DIRECTION_GATE_BLOCKED' });
  git(candidateA, 'restore', 'tracked.txt');
  const updater = path.join(base, 'updater');
  git(base, 'clone', '-b', 'governance', remote, updater);
  git(updater, 'config', 'user.name', 'R01 test');
  git(updater, 'config', 'user.email', 'r01@example.invalid');
  await writeFile(path.join(updater, 'direction.txt'), 'DIR-03 and new decision\n');
  await writeFile(path.join(updater, 'docs', 'decisions', 'new.md'), 'Nueva decisión publicada\n');
  git(updater, 'add', 'direction.txt', 'docs/decisions/new.md');
  git(updater, 'commit', '-m', 'new decision');
  git(updater, 'push', 'origin', 'HEAD:refs/heads/governance');
  await t.test('C: checkout desactualizado frente a remoto se bloquea', async () => {
    await assert.rejects(verifyDirectionIdentity(input), { code: 'DIRECTION_GATE_BLOCKED' });
  });
  git(authority, 'fetch', 'origin', 'refs/heads/governance');
  git(authority, 'merge', '--ff-only', 'FETCH_HEAD');
  const updated = await verifyDirectionIdentity(input);
  assert.equal(updated.authoritySha, git(updater, 'rev-parse', 'HEAD'));
  await assert.rejects(verifyProjectContext(manifest, { configuration, configRoot }));
  await t.test('D: decisión remota nueva se incluye en el siguiente paquete', async () => {
    const next = await buildProjectContext(args);
    assert.ok(next.sources.some((source) => source.path === 'docs/decisions/new.md' && source.content.includes('Nueva decisión')));
  });

  await t.test('DIR-10: trabajo autorizado compara registro manual separado y permite continuidad normal', async () => {
    await writeFile(path.join(candidateA, 'tracked.txt'), 'evolución autorizada\n');
    git(candidateA, 'add', 'tracked.txt');
    git(candidateA, 'commit', '-m', 'authorized objective progress');
    const evolvedSha = git(candidateA, 'rev-parse', 'HEAD');
    const workDirection = { ...direction, purpose: 'work', candidateSha: evolvedSha };
    const selectedScope = { modules: ['m'], layers: ['l'] };
    const manual = {
      version: 1, kind: 'direction-manual-authorization', decision: 'AUTHORIZED',
      objective: direction.objective,
      scope: { applicable: direction.applicable, superseded: direction.superseded, entrypoint: direction.entrypoint, continuity: direction.continuity, ...selectedScope },
      authoritySha: git(authority, 'rev-parse', 'HEAD'), candidateRoot: candidateA, startingSha: a,
      constraints: direction.constraints,
      evidence: { path: 'approval-evidence.txt', sha256: crypto.createHash('sha256').update(manualEvidence).digest('hex'), reference: 'decision-log:fixture-1', summary: 'Aprobación del objetivo y alcance contrastados por el canal de dirección.' },
      approvedBy: 'Fito (atribución manual, no autenticada)', approvedAt: '2026-11-27T12:00:00Z',
    };
    const authorized = await reviewDirection({ ...gate, direction: workDirection, authorization: manual, selectedScope });
    assert.equal(authorized.outcome, 'WORK_SCOPE_MATCHED');
    assert.equal(authorized.executionAuthorized, false);
    assert.equal(authorized.manualValidationMatch.startingSha, a);
    assert.equal(authorized.candidateSha, evolvedSha);
    assert.equal(authorized.manualValidationMatch.authentication, 'NOT_PERFORMED');

    for (const invalid of [
      null,
      { ...manual, objective: 'otro objetivo' },
      { ...manual, scope: { ...manual.scope, applicable: ['DIR-09'] } },
      { ...manual, scope: { ...manual.scope, superseded: [] } },
      { ...manual, scope: { ...manual.scope, continuity: 'otra evidencia' } },
      { ...manual, scope: { ...manual.scope, modules: ['otra-superficie'] } },
      { ...manual, authoritySha: a },
      { ...manual, candidateRoot: candidateB },
      { ...manual, constraints: ['restricción alterada'] },
      { ...manual, evidence: undefined },
      { ...manual, evidence: { ...manual.evidence, sha256: '0'.repeat(64) } },
      { ...manual, evidence: { ...manual.evidence, path: 'missing-evidence.txt' } },
    ]) {
      await assert.rejects(reviewDirection({ ...gate, direction: workDirection, authorization: invalid, selectedScope }), { code: 'DIRECTION_GATE_BLOCKED' });
    }
    await assert.rejects(reviewDirection({ ...gate, direction: workDirection, selectedScope }), { code: 'DIRECTION_GATE_BLOCKED' });
    await assert.rejects(reviewDirection({ ...gate, direction: { ...workDirection, candidateSha: b }, authorization: manual, selectedScope }), { code: 'DIRECTION_GATE_BLOCKED' });

    const workDirectionPath = path.join(base, 'work-direction.json');
    const authorizationPath = path.join(base, 'manual-authorization.json');
    await writeFile(workDirectionPath, JSON.stringify(workDirection));
    await writeFile(authorizationPath, JSON.stringify(manual));
    const workManifest = path.join(base, 'work-context.json');
    const workConfiguration = { ...configuration, projects: [{ ...configuration.projects[0], moduleBase: 'direction.txt', layerBase: 'direction.txt' }] };
    const workArgs = { ...args, configuration: workConfiguration, directionPath: workDirectionPath, authorizationPath, modules: ['m'], layers: ['l'] };
    await assert.rejects(buildProjectContext({ ...workArgs, authorizationPath: workDirectionPath }), { code: 'DIRECTION_GATE_BLOCKED' });
    const written = await writeProjectContext({ ...workArgs, manifest: workManifest });
    assert.equal(written.context.directionGate.outcome, 'WORK_SCOPE_MATCHED');
    assert.equal(written.context.executionAuthorized, false);
    assert.equal((await verifyProjectContext(workManifest, { configuration: workConfiguration, configRoot })).executionAuthorized, false);
    await assert.rejects(buildProjectContext({ ...workArgs, modules: ['otro'], layers: ['l'] }), { code: 'DIRECTION_GATE_BLOCKED' });
    await writeFile(authorizationPath, JSON.stringify({ ...manual, constraints: ['cambio'] }));
    await assert.rejects(verifyProjectContext(workManifest, { configuration: workConfiguration, configRoot }));
  });
});
