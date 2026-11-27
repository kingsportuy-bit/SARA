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
export async function reviewDirection({ root, config, direction, operatorPath, authorization, selectedScope = { modules: [], layers: [] } }) {
  if (!direction || !['review', 'work'].includes(direction.purpose)) throw blocked('propósito de dirección inválido');
  if (direction.purpose === 'work' && !authorization) throw blocked('falta registro manual separado de autorización');
  if (direction.purpose === 'review' && authorization) throw blocked('preparación REVIEW_ONLY no acepta autorización de trabajo');
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
  let authorizationRecord;
  if (direction.purpose === 'work') {
    const manual = authorization;
    if (manual.version !== 1 || manual.kind !== 'direction-manual-authorization' || manual.decision !== 'AUTHORIZED') throw blocked('validación manual ausente o inválida');
    const authorizedObjective = requiredText(manual.objective, 'objetivo autorizado');
    const authorizedScope = manual.scope;
    if (!authorizedScope || !Array.isArray(authorizedScope.applicable) || !sameOrdered(authorizedScope.applicable, applicable) || !sameOrdered(authorizedScope.superseded, superseded) || requiredText(authorizedScope.entrypoint, 'ruta autorizada') !== entrypoint || requiredText(authorizedScope.continuity, 'continuidad autorizada') !== continuity || !sameOrdered(authorizedScope.modules, selectedScope.modules) || !sameOrdered(authorizedScope.layers, selectedScope.layers)) throw blocked('alcance no coincide con la autorización manual');
    if (authorizedObjective !== objective) throw blocked('objetivo no coincide con la autorización manual');
    if (requiredText(manual.authoritySha, 'SHA de autoridad autorizado') !== identity.authoritySha) throw blocked('autoridad desactualizada frente a la autorización manual');
    if (await realpath(requiredText(manual.candidateRoot, 'candidato autorizado')) !== identity.candidateRoot) throw blocked('candidato no coincide con la autorización manual');
    const startingSha = requiredText(manual.startingSha, 'SHA inicial autorizado');
    if (!/^[a-f0-9]{40}$/.test(startingSha)) throw blocked('SHA inicial autorizado inválido');
    try { await run('git', ['merge-base', '--is-ancestor', startingSha, identity.candidateSha], { cwd: identity.candidateRoot, timeout: 15000 }); }
    catch { throw blocked('candidato sin continuidad desde el SHA autorizado'); }
    if (!sameOrdered(requiredList(manual.constraints, 'restricciones autorizadas'), constraints)) throw blocked('restricciones no coinciden con la autorización manual');
    const evidence = manual.evidence;
    if (!evidence || typeof evidence.reference !== 'string' || !evidence.reference.trim() || typeof evidence.summary !== 'string' || !evidence.summary.trim()) throw blocked('falta evidencia trazable de autorización manual');
    const evidencePath = requiredText(evidence.path, 'ruta de evidencia manual');
    if (path.isAbsolute(evidencePath) || evidencePath.split(/[\\/]/).some((part) => part === '..' || part === '.local' || part === 'node_modules')) throw blocked('ruta de evidencia manual inválida');
    const evidenceFile = await realpath(path.join(identity.authorityRoot, evidencePath)).catch(() => { throw blocked('evidencia manual ausente'); });
    const evidenceRelative = path.relative(identity.authorityRoot, evidenceFile);
    if (evidenceRelative.startsWith('..') || path.isAbsolute(evidenceRelative)) throw blocked('evidencia manual fuera de autoridad');
    const evidenceBytes = await readFile(evidenceFile).catch(() => { throw blocked('evidencia manual ilegible'); });
    const evidenceSha256 = crypto.createHash('sha256').update(evidenceBytes).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(evidence.sha256 ?? '') || evidenceSha256 !== evidence.sha256) throw blocked('huella de evidencia manual no coincide');
    try { await run('git', ['ls-files', '--error-unmatch', '--', evidenceRelative], { cwd: identity.authorityRoot, timeout: 15000 }); }
    catch { throw blocked('evidencia manual no está versionada'); }
    const approvedBy = requiredText(manual.approvedBy, 'responsable de aprobación manual');
    const approvedAt = requiredText(manual.approvedAt, 'fecha de aprobación manual');
    if (Number.isNaN(Date.parse(approvedAt))) throw blocked('fecha de aprobación manual inválida');
    authorizationRecord = {
      decision: 'AUTHORIZED', objective: authorizedObjective, scope: { applicable, superseded, entrypoint, continuity, modules: selectedScope.modules, layers: selectedScope.layers },
      authoritySha: identity.authoritySha, candidateRoot: identity.candidateRoot, startingSha,
      constraints, evidence: { path: evidenceRelative.split(path.sep).join('/'), sha256: evidenceSha256, reference: evidence.reference.trim(), summary: evidence.summary.trim() },
      approvedBy, approvedAt, authentication: 'NOT_PERFORMED',
    };
  }
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
    outcome: direction.purpose === 'review' ? 'REVIEW_ONLY' : 'WORK_SCOPE_MATCHED',
    ...(authorizationRecord ? { manualValidationMatch: authorizationRecord, executionAuthorized: false } : {}),
    limitation: direction.purpose === 'review'
      ? 'Identidad y fuentes no acreditan conformidad semántica ni autorizan ejecución; revisión independiente pendiente.'
      : 'El gate encontró coincidencia técnica con el registro de validación manual; no concede autorización ni autentica personas. El orquestador debe contrastar la cadena humana antes de continuar el objetivo. La revisión/certificación solo aplica a la huella exacta examinada.',
  };
}

function sameOrdered(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}
