import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, symlink, link } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildProjectContext, writeProjectContext, verifyProjectContext } from '../scripts/project-context.mjs';
const api = await import('../scripts/project-os.mjs').catch(() => ({}));
const configRoot = path.resolve('.');
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sara-project-os-'));
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs/INICIAL.md'), '# Local\n');
  return { root, project: 'test-project', configRoot };
}
const contextOptions = f => ({ ...f, project: 'test-project', role: 'clara', configuration: { roles: [{ id: 'clara', model: 'selected', reasoningEffort: 'medium' }], projects: [{ id: 'test-project', requiredSources: ['AGENTS.md', 'docs/INICIAL.md'], moduleBase: 'docs/biblioteca/modulos', layerBase: 'docs/biblioteca/capas', governanceEvolution: { state: 'ACTIVE' } }] } });

test('instala OS nuevo desde plantilla y cargador incorpora la política central correcta', async () => {
  const f = await fixture();
  const plan = await api.planProjectOS({ ...f, newProject: true });
  assert.equal(plan.changes.length, 2);
  await assert.rejects(readFile(path.join(f.root, 'AGENTS.md')), /ENOENT/);
  await api.applyProjectOS(plan, { configRoot });
  const context = await buildProjectContext(contextOptions(f));
  assert.ok(context.governanceSources.some(s => s.path === 'docs/organization/GOVERNANCE_POLICY.json'));
  assert.ok(context.sources.some(s => s.path === 'docs/SARA_GOVERNANCE.json'));
  assert.match(await readFile(path.join(f.root, 'AGENTS.md'), 'utf8'), /SARA:GOVERNANCE/);
  assert.equal((await api.planProjectOS(f)).changes.length, 0);
});

test('actualiza OS existente idempotentemente y conserva bytes particulares y OPERADOR', async () => {
  const f = await fixture();
  const original = '\ufeff# Proyecto\r\nRegla local: no desplegar.\r\n';
  await writeFile(path.join(f.root, 'AGENTS.md'), original);
  await writeFile(path.join(f.root, 'docs/OPERADOR.md'), 'PROTEGIDO');
  const plan = await api.planProjectOS(f);
  await api.applyProjectOS(plan, { configRoot });
  const agents = await readFile(path.join(f.root, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith(original));
  assert.equal(await readFile(path.join(f.root, 'docs/OPERADOR.md'), 'utf8'), 'PROTEGIDO');
  assert.equal((await api.planProjectOS(f)).changes.length, 0);
  await api.applyProjectOS(plan, { configRoot });
  assert.equal(await readFile(path.join(f.root, 'AGENTS.md'), 'utf8'), agents);
});

test('rechaza comparación obsoleta, plan manipulado y bloque local editado', async () => {
  const f = await fixture();
  const plan = await api.planProjectOS(f);
  await writeFile(path.join(f.root, 'AGENTS.md'), 'Cambió mientras revisaba\n');
  await assert.rejects(api.applyProjectOS(plan, { configRoot }), /cambi|obsolet/i);
  const fresh = await api.planProjectOS(f);
  const tampered = structuredClone(fresh);
  tampered.changes[0].after += 'unrelated edit';
  await assert.rejects(api.applyProjectOS(tampered, { configRoot }), /plan|comparaci/i);
  await api.applyProjectOS(fresh, { configRoot });
  const agents = await readFile(path.join(f.root, 'AGENTS.md'), 'utf8');
  await writeFile(path.join(f.root, 'AGENTS.md'), agents.replace('DEVELOPMENT', 'custom-local'));
  await assert.rejects(api.planProjectOS(f), /local|bloque/i);
});

test('sidecar alterado no se acepta como paquete íntegro', async () => {
  const f = await fixture();
  await api.applyProjectOS(await api.planProjectOS({ ...f, newProject: true }), { configRoot });
  const options = contextOptions(f);
  const manifest = path.join(f.root, 'manifest.json');
  await writeProjectContext({ ...options, manifest });
  assert.equal((await verifyProjectContext(manifest, options)).ok, true);
  const bindingPath = path.join(f.root, 'docs/SARA_GOVERNANCE.json');
  const binding = JSON.parse(await readFile(bindingPath));
  binding.policyVersion = '0.0.0';
  await writeFile(bindingPath, JSON.stringify(binding));
  await assert.rejects(verifyProjectContext(manifest, options), /política|version|versión/i);
});

test('junction externa no permite escribir el sidecar fuera del checkout', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sara-os-root-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'sara-os-outside-'));
  await symlink(outside, path.join(root, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(api.planProjectOS({ root, project: 'test-project', configRoot }), /fuera|symlink/i);
  await assert.rejects(readFile(path.join(outside, 'SARA_GOVERNANCE.json')), /ENOENT/);
});

test('alias interno no puede convertir actualización de AGENTS en escritura de OPERADOR', async () => {
  for (const mode of ['hardlink']) {
    const f = await fixture();
    const protectedFile = path.join(f.root, 'docs/OPERADOR.md');
    await writeFile(protectedFile, 'PROTEGIDO');
    if (mode === 'hardlink') await link(protectedFile, path.join(f.root, 'AGENTS.md'));
    else await symlink(protectedFile, path.join(f.root, 'AGENTS.md'));
    await assert.rejects(api.planProjectOS(f), /enlac|alias|regular/i);
    assert.equal(await readFile(protectedFile, 'utf8'), 'PROTEGIDO');
  }
});

test('junction interna también se rechaza sin escribir por otro nombre', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sara-os-internal-'));
  await mkdir(path.join(root, 'actual-docs'));
  await symlink(path.join(root, 'actual-docs'), path.join(root, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(api.planProjectOS({ root, project: 'test-project', configRoot }), /enlac|alias/i);
});
