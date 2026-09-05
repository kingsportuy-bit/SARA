import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ProjectContextError,
  buildProjectContext,
  verifyProjectContext,
  writeProjectContext,
} from '../scripts/project-context.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'project-context-root-'));
  const configRoot = await mkdtemp(path.join(os.tmpdir(), 'project-context-config-'));
  await mkdir(path.join(root, 'docs', 'biblioteca', 'modulos', 'agenda_visual'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'biblioteca', 'capas'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'historico'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'state'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'TASKS', 'active'), { recursive: true });
  await mkdir(path.join(configRoot, 'docs', 'organization'), { recursive: true });
  await writeFile(path.join(configRoot, 'docs', 'organization', 'CODEX_ROLES.json'), JSON.stringify({
    roles: [
      { id: 'luna', model: 'gpt-luna', reasoningEffort: 'high' },
      { id: 'clara', model: 'gpt-clara', reasoningEffort: 'low' },
    ],
  }));
  await writeFile(path.join(configRoot, 'docs', 'organization', 'PROJECTS.json'), JSON.stringify({
    projects: [{
      id: 'barberox',
      requiredSources: ['docs/INICIAL.md'],
      moduleBase: 'docs/biblioteca/modulos',
      layerBase: 'docs/biblioteca/capas',
    }],
  }));
  await writeFile(path.join(configRoot, 'AGENTS.md'), 'Governance agents\n');
  await writeFile(path.join(configRoot, 'docs', 'INICIAL.md'), 'Governance inicial\n');
  await writeFile(path.join(configRoot, 'docs', 'organization', 'DESARROLLO_CODEX.md'), 'Desarrollo\n');
  await writeFile(path.join(configRoot, 'docs', 'organization', 'CARGOS_Y_NOMBRAMIENTOS.md'), 'Cargos\n');
  await writeFile(path.join(configRoot, 'docs', 'organization', 'MESA_DIRECCION_INTEGRAL.md'), 'Mesa\n');
  await writeFile(path.join(configRoot, 'docs', 'organization', 'OFICINA_FITO.md'), 'Oficina\n');
  await writeFile(path.join(root, 'docs', 'INICIAL.md'), 'Inicial\r\n');
  await writeFile(path.join(root, 'docs', 'biblioteca', 'modulos', 'agenda_visual', 'README.md'), '[Contrato](../../MODULE_COMMON_CONTRACT.md)\r\n[Historia](../../../historico/old.md)\r\n');
  await writeFile(path.join(root, 'docs', 'biblioteca', 'MODULE_COMMON_CONTRACT.md'), 'Contrato común\r\n');
  await writeFile(path.join(root, 'docs', 'historico', 'old.md'), 'No operativo\n');
  await writeFile(path.join(root, 'docs', 'biblioteca', 'capas', 'C4_ROUTER.md'), 'Router\r\n\r\n## Leer también\r\n- `C5_HANDLERS.md`\r\n- `../../CONTRATOS_NODOS.md`\r\n');
  await writeFile(path.join(root, 'docs', 'biblioteca', 'capas', 'C5_HANDLERS.md'), 'Handlers\r\n');
  await writeFile(path.join(root, 'docs', 'CONTRATOS_NODOS.md'), 'Nodos\r\n');
  await writeFile(path.join(root, 'docs', 'state', 'PROJECT_STATE.json'), JSON.stringify({ activeTask: { path: 'docs/TASKS/active/TASK-1.md' } }));
  await writeFile(path.join(root, 'docs', 'SESSION_STATE.md'), 'Session\r\n');
  await writeFile(path.join(root, 'docs', 'TASKS', 'active', 'TASK-1.md'), 'Task\r\n');
  return { root, configRoot };
}

async function cleanup(fixtureValue) {
  await Promise.all([rm(fixtureValue.root, { recursive: true, force: true }), rm(fixtureValue.configRoot, { recursive: true, force: true })]);
}

function rejectsCode(promise, code) {
  return assert.rejects(promise, (error) => error instanceof ProjectContextError && error.code === code);
}

test('construye paquete completo, normaliza LF y resuelve contratos locales', async () => {
  const f = await fixture();
  try {
    const context = await buildProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'luna', modules: ['agenda_visual'], layers: ['C4_ROUTER'] });
    assert.equal(context.complete, true);
    assert.equal(context.model, 'gpt-luna');
    assert.deepEqual(context.modules, ['agenda_visual']);
    assert.deepEqual(context.layers, ['C4_ROUTER']);
    assert.deepEqual([...context.sources.map((source) => source.path)].sort(), [
      'docs/INICIAL.md',
      'docs/biblioteca/MODULE_COMMON_CONTRACT.md',
      'docs/biblioteca/capas/C4_ROUTER.md',
      'docs/biblioteca/capas/C5_HANDLERS.md',
      'docs/CONTRATOS_NODOS.md',
      'docs/SESSION_STATE.md',
      'docs/state/PROJECT_STATE.json',
      'docs/TASKS/active/TASK-1.md',
      'docs/biblioteca/modulos/agenda_visual/README.md',
    ].sort());
    assert.ok(context.sources.every((source) => !source.content.includes('\r')));
    assert.match(context.limitation, /comprensión semántica/);
  } finally {
    await cleanup(f);
  }
});

test('rechaza fuente requerida faltante', async () => {
  const f = await fixture();
  try {
    const configPath = path.join(f.configRoot, 'docs', 'organization', 'PROJECTS.json');
    await writeFile(configPath, JSON.stringify({ projects: [{ id: 'barberox', requiredSources: ['docs/MISSING.md'], moduleBase: 'docs/biblioteca/modulos', layerBase: 'docs/biblioteca/capas' }] }));
    await rejectsCode(buildProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'luna', modules: ['agenda_visual'], layers: ['C4_ROUTER'] }), 'SOURCE_NOT_FOUND');
  } finally {
    await cleanup(f);
  }
});

test('rechaza gobierno SARA incompleto aunque el proyecto tenga fuentes', async () => {
  const f = await fixture();
  try {
    await rm(path.join(f.configRoot, 'docs', 'organization', 'MESA_DIRECCION_INTEGRAL.md'), { force: true });
    await rejectsCode(buildProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'luna', modules: ['agenda_visual'], layers: ['C4_ROUTER'] }), 'SOURCE_NOT_FOUND');
  } finally {
    await cleanup(f);
  }
});

test('rechaza rol inexistente y selección incompleta para Sol Luna Vera', async () => {
  const f = await fixture();
  try {
    await rejectsCode(buildProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'fantasma', modules: ['agenda_visual'], layers: ['C4_ROUTER'] }), 'ROL_NOT_FOUND');
    await rejectsCode(buildProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'luna' }), 'SELECTION_REQUIRED');
    const basic = await buildProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'clara' });
    assert.deepEqual(basic.modules, []);
  } finally {
    await cleanup(f);
  }
});

test('rechaza traversal local y enlace simbólico exterior', async (t) => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.root, 'docs', 'biblioteca', 'modulos', 'agenda_visual', 'README.md'), '## Fuente/decision\n[Fuera](../../../../../outside.md)\n');
    await rejectsCode(buildProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'luna', modules: ['agenda_visual'], layers: ['C4_ROUTER'] }), 'PATH_TRAVERSAL');

    await writeFile(path.join(f.root, 'docs', 'biblioteca', 'modulos', 'agenda_visual', 'README.md'), '## Fuente/decision\n[Secreto](./external/secret.md)\n');
    const outside = await mkdtemp(path.join(os.tmpdir(), 'project-context-outside-'));
    try {
      await writeFile(path.join(outside, 'secret.md'), 'afuera\n');
      const junction = path.join(f.root, 'docs', 'biblioteca', 'modulos', 'agenda_visual', 'external');
      try {
        await symlink(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
      } catch (error) {
        if (error.code === 'EPERM' || error.code === 'EACCES') return t.skip('El sistema no permite crear symlinks');
        throw error;
      }
      await rejectsCode(buildProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'luna', modules: ['agenda_visual'], layers: ['C4_ROUTER'] }), 'SYMLINK_OUTSIDE');
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  } finally {
    await cleanup(f);
  }
});

test('manifest verifica hashes y detecta cambio, fuente faltante y modelo alterado', async () => {
  const f = await fixture();
  try {
    const manifest = path.join(f.root, 'context.manifest.json');
    const written = await writeProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'luna', modules: ['agenda_visual'], layers: ['C4_ROUTER'], manifest });
    assert.equal((await verifyProjectContext(manifest, { configRoot: f.configRoot })).ok, true);
    const packageData = JSON.parse(await readFile(written.packagePath, 'utf8'));
    packageData.sources.pop();
    await writeFile(written.packagePath, JSON.stringify(packageData));
    await rejectsCode(verifyProjectContext(manifest, { configRoot: f.configRoot }), 'PACKAGE_INCOMPLETE');

    await writeProjectContext({ root: f.root, configRoot: f.configRoot, project: 'barberox', role: 'luna', modules: ['agenda_visual'], layers: ['C4_ROUTER'], manifest });
    await writeFile(path.join(f.root, 'docs', 'INICIAL.md'), 'Cambió\n');
    await rejectsCode(verifyProjectContext(manifest, { configRoot: f.configRoot }), 'SOURCE_CHANGED');

    await writeFile(path.join(f.root, 'docs', 'INICIAL.md'), 'Inicial\r\n');
    await writeFile(path.join(f.configRoot, 'docs', 'organization', 'CODEX_ROLES.json'), JSON.stringify({ roles: [{ id: 'luna', model: 'gpt-altered', reasoningEffort: 'high' }, { id: 'clara', model: 'gpt-clara', reasoningEffort: 'low' }] }));
    await rejectsCode(verifyProjectContext(manifest, { configRoot: f.configRoot }), 'METADATA_MISMATCH');
  } finally {
    await cleanup(f);
  }
});
