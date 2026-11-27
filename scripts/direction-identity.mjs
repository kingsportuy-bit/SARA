// Comprobaciones Git de DIR-10. La conformidad semántica requiere revisión.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

const run = promisify(execFile);

async function git(root, args) {
  const result = await run('git', args, { cwd: root, timeout: 15000, maxBuffer: 1024 * 1024 });
  return result.stdout.trim();
}

// Solo artefactos locales conocidos en la raíz; no excluir src/, db/ ni
// scripts/. Un archivo ignorado por Git puede ser ejecutable igualmente.
const LOCAL_ARTIFACT = /^(?:\.local\/|node_modules\/|\.next\/|coverage\/|dist\/|dist-p01\/|build\/|docs\/SARA_GOVERNANCE\.json$|\.env(?:\.[^/]*)?$)/;
async function hasUnexpectedFiles(root) {
  const status = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=matching']);
  const records = status.split('\0').filter(Boolean);
  return records.some((record) => {
    const kind = record.slice(0, 2);
    const name = record.slice(3).replaceAll('\\', '/');
    return !((kind === '!!' || kind === '??') && LOCAL_ARTIFACT.test(name));
  });
}

export async function verifyDirectionIdentity({ authorityRoot, authorityRemote, authorityRef, candidateRoot, candidateSha, blockedCheckpoint }) {
  try {
    const authority = await realpath(authorityRoot);
    const candidate = await realpath(candidateRoot);
    const [authorityTop, candidateTop, remote, authorityHead, candidateHead, authorityCommon, candidateCommon, dirty, authorityDirty] = await Promise.all([
      git(authority, ['rev-parse', '--show-toplevel']),
      git(candidate, ['rev-parse', '--show-toplevel']),
      git(authority, ['ls-remote', '--exit-code', authorityRemote, authorityRef]),
      git(authority, ['rev-parse', 'HEAD']),
      git(candidate, ['rev-parse', 'HEAD']),
      git(authority, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
      git(candidate, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
      hasUnexpectedFiles(candidate),
      hasUnexpectedFiles(authority),
    ]);
    const remoteLines = remote.split(/\r?\n/);
    const match = remoteLines.length === 1 && remoteLines[0].match(/^([a-f0-9]{40})\s+(\S+)$/);
    if (!match || match[2] !== authorityRef || match[1] !== authorityHead) throw new Error('Autoridad remota y checkout no coinciden');
    if (await realpath(authorityTop) !== authority || await realpath(candidateTop) !== candidate) throw new Error('El root no identifica un worktree');
    if (path.resolve(authorityCommon) !== path.resolve(candidateCommon)) throw new Error('Candidato pertenece a otro repositorio');
    if (!/^[a-f0-9]{40}$/.test(candidateSha) || candidateSha !== candidateHead) throw new Error('SHA candidato no coincide');
    if (dirty || authorityDirty) throw new Error('Checkout contiene cambios o archivos sin identificar');
    if (!/^[a-f0-9]{40}$/.test(blockedCheckpoint)) throw new Error('Checkpoint bloqueado inválido');
    let descendant = false;
    try { await git(candidate, ['merge-base', '--is-ancestor', blockedCheckpoint, candidateHead]); descendant = true; }
    catch (error) { if (error.code !== 1) throw error; }
    if (descendant) throw new Error('Candidato desciende del motor histórico bloqueado; requiere revisión de reconciliación');
    return { authorityRoot: authority, authoritySha: authorityHead, candidateRoot: candidate, candidateSha: candidateHead };
  } catch (error) {
    const blocked = new Error(`DIRECTION_GATE BLOCKED: ${error.message}`);
    blocked.code = 'DIRECTION_GATE_BLOCKED';
    throw blocked;
  }
}
