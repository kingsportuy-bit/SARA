import { realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { verifyDirectionIdentity } from './direction-identity.mjs';

const run = promisify(execFile);
const blocked = (reason) => Object.assign(new Error(`DIRECTION_GATE BLOCKED: ${reason}`), { code: 'DIRECTION_GATE_BLOCKED' });
const requiredText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw blocked(`falta ${label}`);
  return value.trim();
};
const requiredList = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) throw blocked(`falta ${label}`);
  return value.map((item) => requiredText(item, label));
};

// Un paquete de revisión permite leer evidencia; no autoriza ejecutar el candidato.
export async function reviewDirection({ root, config, direction, operatorPath }) {
  if (!direction || direction.purpose !== 'review') throw blocked('solo se admite preparación para revisión independiente');
  const identity = await verifyDirectionIdentity({
    authorityRoot: root,
    authorityRemote: config.authorityRemote,
    authorityRef: config.authorityRef,
    candidateRoot: requiredText(direction.candidateRoot, 'worktree candidato'),
    candidateSha: requiredText(direction.candidateSha, 'SHA candidato'),
    blockedCheckpoint: config.checkpoints.B,
  });
  const objective = requiredText(direction.objective, 'objetivo');
  const applicable = requiredList(direction.applicable, 'decisiones aplicables');
  const registerPath = requiredText(config.decisionRegister, 'registro de decisiones');
  if (path.isAbsolute(registerPath) || registerPath.split(/[\\/]/).includes('..')) throw blocked('registro de decisiones inválido');
  const registerFile = await realpath(path.join(identity.authorityRoot, registerPath)).catch(() => { throw blocked('registro de decisiones ausente'); });
  const registerRelative = path.relative(identity.authorityRoot, registerFile);
  if (registerRelative.startsWith('..') || path.isAbsolute(registerRelative)) throw blocked('registro fuera de autoridad');
  const register = await readFile(registerFile, 'utf8');
  const requiredIds = [...new Set(register.match(/\bDIR-\d{2}\b/g) ?? [])].sort();
  const selectedIds = [...new Set(applicable)].sort();
  if (requiredIds.length === 0 || selectedIds.length !== applicable.length || JSON.stringify(selectedIds) !== JSON.stringify(requiredIds)) throw blocked('IDs de decisiones incompletos o no reconocidos');
  const superseded = requiredList(direction.superseded, 'decisiones sustituidas');
  const constraints = requiredList(direction.constraints, 'restricciones');
  const continuity = requiredText(direction.continuity, 'evidencia de continuidad');
  const entrypoint = requiredText(direction.entrypoint, 'ruta efectiva');
  if (path.isAbsolute(entrypoint) || entrypoint.split(/[\\/]/).some((part) => part === '..' || part === '.local' || part === 'node_modules')) throw blocked('ruta efectiva no válida');
  const candidatePath = await realpath(path.join(identity.candidateRoot, entrypoint)).catch(() => { throw blocked('ruta efectiva ausente'); });
  const relative = path.relative(identity.candidateRoot, candidatePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw blocked('ruta efectiva fuera del candidato');
  try { await run('git', ['ls-files', '--error-unmatch', '--', entrypoint], { cwd: identity.candidateRoot, timeout: 15000 }); }
  catch { throw blocked('ruta efectiva no rastreada'); }
  const operator = await realpath(requiredText(operatorPath, 'OPERADOR protegido')).catch(() => { throw blocked('OPERADOR protegido ausente'); });
  const operatorBytes = await readFile(operator).catch(() => { throw blocked('OPERADOR protegido ilegible'); });
  try {
    const operatorRoot = (await run('git', ['rev-parse', '--show-toplevel'], { cwd: path.dirname(operator), timeout: 15000 })).stdout.trim();
    if (await realpath(path.join(operatorRoot, 'docs', 'OPERADOR.md')) !== operator) throw new Error('ruta');
    const remote = (await run('git', ['remote', 'get-url', 'origin'], { cwd: operatorRoot, timeout: 15000 })).stdout.trim();
    if (remote !== requiredText(config.protectedOperator?.remote, 'origen protegido')) throw new Error('origen');
    const operatorCommit = requiredText(config.protectedOperator?.commit, 'commit protegido');
    if (!/^[a-f0-9]{40}$/.test(operatorCommit)) throw new Error('commit');
    const expected = (await run('git', ['rev-parse', `${operatorCommit}:docs/OPERADOR.md`], { cwd: operatorRoot, timeout: 15000 })).stdout.trim();
    const actual = (await run('git', ['hash-object', '--', operator], { cwd: operatorRoot, timeout: 15000 })).stdout.trim();
    if (expected !== actual) throw new Error('contenido');
  } catch { throw blocked('OPERADOR no coincide con la fuente protegida recuperada'); }
  return {
    ...identity, objective, applicable, superseded, continuity, entrypoint, constraints,
    operator: { path: operator, sha256: crypto.createHash('sha256').update(operatorBytes).digest('hex'), access: 'lectura directa, no reproducir' },
    outcome: 'REVIEW_ONLY',
    limitation: 'Identidad y fuentes no acreditan conformidad semántica ni autorizan ejecución; revisión independiente pendiente.',
  };
}
