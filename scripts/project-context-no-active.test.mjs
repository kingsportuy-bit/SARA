import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { barberoxDynamicSeeds } from './project-context.mjs';

test('Barberox context is available between tasks without inventing an active task', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'barberox-context-no-active-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'docs', 'state'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'SESSION_STATE.md'), '# No active task\n');
  const statePath = path.join(root, 'docs', 'state', 'PROJECT_STATE.json');
  await writeFile(statePath, JSON.stringify({ currentIntent: 'guidance', activeTask: null }));
  assert.deepEqual(await barberoxDynamicSeeds(root, 'barberox'), [
    { path: 'docs/state/PROJECT_STATE.json', followLinks: false },
    { path: 'docs/SESSION_STATE.md', followLinks: false },
  ]);
  await mkdir(path.join(root, 'docs', 'generated'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'generated', 'CURRENT_STATE.md'), '# Derived state\n');
  assert.deepEqual((await barberoxDynamicSeeds(root, 'barberox'))[0],
    { path: 'docs/generated/CURRENT_STATE.md', followLinks: false });
  await writeFile(statePath, JSON.stringify({ currentIntent: 'incident', activeTask: {} }));
  await assert.rejects(() => barberoxDynamicSeeds(root, 'barberox'), /tarea activa válida/u);
});
