#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_ROOT, POLICY_PATH, POLICY_DOC, loadPolicy, localPath, sha256, validateAdoptionAuthorization } from './governance-evolution.mjs';

export const BINDING_PATH = 'docs/SARA_GOVERNANCE.json';
const TEMPLATE = 'templates/project-os/GOVERNANCE_REFERENCE.md';
const BEGIN = '<!-- SARA:GOVERNANCE:BEGIN -->';
const END = '<!-- SARA:GOVERNANCE:END -->';
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
async function readOptional(root, relative) {
  const file = await localPath(root, relative);
  let parent = path.dirname(file);
  const base = await fs.realpath(root);
  while (parent !== base) {
    try { requireValue(!(await fs.lstat(parent)).isSymbolicLink(), 'Directorio de destino enlazado; resolver alias local'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    parent = path.dirname(parent);
  }
  try {
    const stat = await fs.lstat(file);
    requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'Destino debe ser archivo regular sin enlaces ni alias');
    const bytes = await fs.readFile(file);
    const text = bytes.toString('utf8');
    requireValue(Buffer.from(text).equals(bytes), 'Archivo local no es UTF-8; no sobrescribir');
    return text;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function desiredBinding({ root, project, configRoot }) {
  const policy = await loadPolicy(configRoot);
  const template = await fs.readFile(await localPath(configRoot, TEMPLATE), 'utf8');
  return { template, binding: { schemaVersion: 1, project, root, governanceRoot: configRoot, policyVersion: policy.policyVersion,
    policy: { path: POLICY_PATH, sha256: sha256(await fs.readFile(await localPath(configRoot, POLICY_PATH))) },
    document: { path: POLICY_DOC, sha256: sha256(await fs.readFile(await localPath(configRoot, POLICY_DOC))) },
    managedBlockSha256: sha256(template) } };
}
function blockRange(agents) {
  const start = agents.indexOf(BEGIN), finish = agents.indexOf(END);
  if (start === -1 && finish === -1) return null;
  requireValue(start >= 0 && finish > start && agents.indexOf(BEGIN, start + 1) === -1 && agents.indexOf(END, finish + 1) === -1, 'Bloque local ambiguo/incompleto');
  let end = finish + END.length;
  if (agents.slice(end).startsWith('\r\n')) end += 2;
  else if (agents[end] === '\n') end += 1;
  return { start, end, text: agents.slice(start, end) };
}
export async function planProjectOS({ root, project, configRoot = CONFIG_ROOT, activate = false, authorization, newProject = false }) {
  root = await fs.realpath(root);
  configRoot = await fs.realpath(configRoot);
  requireValue(typeof project === 'string' && /^[a-z][a-z0-9-]*$/.test(project), 'Identidad de proyecto inválida');
  const { template, binding } = await desiredBinding({ root, project, configRoot });
  const agents = await readOptional(root, 'AGENTS.md');
  const prior = await readOptional(root, BINDING_PATH);
  const range = blockRange(agents ?? '');
  let installed = null;
  if (prior !== null) {
    installed = JSON.parse(prior);
    requireValue(installed.schemaVersion === 1 && installed.project === project && installed.root === root && installed.governanceRoot === configRoot && /^1\.\d+\.\d+$/.test(installed.policyVersion), 'Referencia de política/versión local desconocida o incompatible');
    requireValue(range && sha256(range.text) === installed.managedBlockSha256, 'Bloque local editado; resolver sin sobrescribir');
  } else requireValue(!range, 'Bloque local sin procedencia; no sobrescribir');
  const previousState = installed?.state ?? 'PENDING_ADOPTION';
  requireValue(['ACTIVE', 'PENDING_ADOPTION'].includes(previousState), 'Estado de adopción desconocido');
  if (newProject) requireValue(agents === null && prior === null || installed?.activationSource === 'NEW_PROJECT', 'Proyecto nuevo no puede sustituir OS existente');
  const activation = authorization ?? installed?.authorization;
  if (activate || previousState === 'ACTIVE' && installed?.activationSource !== 'NEW_PROJECT') {
    requireValue(activation, 'Activación requiere autorización y evidencia');
    await validateAdoptionAuthorization(activation, { root, project });
  }
  binding.state = newProject || activate || previousState === 'ACTIVE' ? 'ACTIVE' : 'PENDING_ADOPTION';
  binding.activationSource = newProject ? 'NEW_PROJECT' : activate ? 'AUTHORIZED_ADOPTION' : installed?.activationSource ?? 'PREPARED_ONLY';
  if (activation) binding.authorization = activation;
  const afterAgents = range ? agents.slice(0, range.start) + template + agents.slice(range.end) : (agents === null ? '' : agents + '\n') + template;
  const afterBinding = JSON.stringify(binding, null, 2) + '\n';
  const changes = [['AGENTS.md', agents, afterAgents], [BINDING_PATH, prior, afterBinding]]
    .filter(([, before, after]) => before !== after)
    .map(([file, before, after]) => ({ path: file, before, beforeSha256: before === null ? null : sha256(before), after, afterSha256: sha256(after) }));
  return { schemaVersion: 1, kind: 'project-os-update-plan', root, project, configRoot, policyVersion: binding.policyVersion, activate, newProject, ...(authorization ? { authorization } : {}), changes };
}

export async function applyProjectOS(plan, { configRoot = CONFIG_ROOT } = {}) {
  requireValue(plan?.kind === 'project-os-update-plan' && plan.schemaVersion === 1 && Array.isArray(plan.changes), 'Plan inválido');
  requireValue(await fs.realpath(configRoot) === plan.configRoot && await fs.realpath(plan.root) === plan.root, 'Raíz del plan cambió');
  // Recompute the only permitted mutation from trusted central sources.
  const fresh = await planProjectOS({ root: plan.root, project: plan.project, configRoot, activate: plan.activate, authorization: plan.authorization, newProject: plan.newProject });
  if (fresh.changes.length === 0) {
    // An already applied plan is a no-op only if its desired bytes still agree.
    for (const change of plan.changes) requireValue(['AGENTS.md', BINDING_PATH].includes(change.path) && await readOptional(plan.root, change.path) === change.after, 'Plan obsoleto o manipulado');
    return { ok: true, changed: [] };
  }
  requireValue(JSON.stringify(fresh) === JSON.stringify(plan), 'Comparación/plan obsoleto o cambiado');
  // Verify all files before the first write. No arbitrary paths from plan input.
  for (const change of fresh.changes) requireValue(await readOptional(plan.root, change.path) === change.before, 'Archivo cambió desde comparación');
  const written = [];
  try {
    for (const change of fresh.changes) {
      const target = await localPath(plan.root, change.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      requireValue(await readOptional(plan.root, change.path) === change.before, 'Archivo cambió durante aplicación');
      await fs.writeFile(target, change.after, { encoding: 'utf8', flag: change.before === null ? 'wx' : 'w' });
      written.push(change);
    }
  } catch (error) {
    for (const change of written.reverse()) {
      if (await readOptional(plan.root, change.path) !== change.after) continue;
      const target = await localPath(plan.root, change.path);
      if (change.before === null) await fs.unlink(target);
      else await fs.writeFile(target, change.before, 'utf8');
    }
    throw error;
  }
  await verifyProjectOS({ root: plan.root, project: plan.project, configRoot });
  return { ok: true, changed: fresh.changes.map(c => c.path) };
}

export async function verifyProjectOS(options) {
  const prior = await readOptional(options.root, BINDING_PATH);
  if (prior === null) return null; // Existing OS inherits central policy via context.
  const plan = await planProjectOS(options);
  requireValue(plan.changes.length === 0, 'Referencia de política/versión desactualizada; comparar actualización OS');
  return JSON.parse(prior);
}

// Pending adoption is an informational reference, never a new project gate.
export async function projectAdoption(options, configured = {}) {
  const state = configured.state ?? 'PENDING_ADOPTION';
  requireValue(['ACTIVE', 'PENDING_ADOPTION'].includes(state), 'Estado central de adopción inválido');
  // The registered profile, not mutable optional project metadata, owns adoption.
  // Inactive projects do not read or validate the optional local binding at all.
  if (state === 'PENDING_ADOPTION') return { state, enforced: false, bindingInstalled: false };
  const binding = await verifyProjectOS(options);
  requireValue(binding?.state === 'ACTIVE', 'Perfil ACTIVE requiere referencia activa autorizada');
  return { state, enforced: true, bindingInstalled: true };
}

async function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--activate') { args.activate = true; continue; }
    if (argv[i] === '--new') { args.newProject = true; continue; }
    requireValue(['--project', '--root', '--plan', '--apply', '--config-root', '--authorization'].includes(argv[i]) && argv[i + 1], 'Argumento inválido');
    args[argv[i].slice(2)] = argv[++i];
  }
  const configRoot = args['config-root'] ?? CONFIG_ROOT;
  if (args.apply) {
    requireValue(!args.root && !args.project && !args.plan, 'Aplicar sólo el plan concreto');
    return applyProjectOS(JSON.parse(await fs.readFile(args.apply, 'utf8')), { configRoot });
  }
  const authorization = args.authorization ? JSON.parse(await fs.readFile(args.authorization, 'utf8')) : undefined;
  const plan = await planProjectOS({ root: args.root, project: args.project, configRoot, activate: args.activate, authorization, newProject: args.newProject });
  if (args.plan) await fs.writeFile(args.plan, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  return plan;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n')).catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}
