#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_ROOT = path.resolve(SCRIPT_DIR, '..');
const HIGH_CONTEXT_ROLES = new Set(['sol', 'luna', 'vera']);
const FORBIDDEN_SEGMENTS = new Set(['evidencias', 'historico', 'tasks', 'workflow_versions']);
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

export class ProjectContextError extends Error {
  constructor(message, code = 'PROJECT_CONTEXT_ERROR') {
    super(message);
    this.name = 'ProjectContextError';
    this.code = code;
  }
}

function fail(message, code) {
  throw new ProjectContextError(message, code);
}

function asAbsolute(value, name) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${name} es obligatorio`, 'INVALID_ARGUMENT');
  return path.resolve(value);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function posixRelative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function hasForbiddenSegment(relativePath) {
  const segments = relativePath.split(/[\\/]+/).filter(Boolean).map((item) => item.toLowerCase());
  return segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment));
}

async function realRoot(root) {
  try {
    return await fs.realpath(root);
  } catch {
    fail(`El checkout root no existe o no es accesible: ${root}`, 'ROOT_NOT_FOUND');
  }
}

async function safeFile(root, relativePath, sourceLabel = relativePath, options = {}) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') fail(`Fuente vacía: ${sourceLabel}`, 'INVALID_SOURCE');
  const rootReal = await realRoot(root);
  const candidate = path.resolve(root, relativePath);
  if (!isInside(path.resolve(root), candidate)) fail(`La fuente sale del checkout: ${sourceLabel}`, 'PATH_TRAVERSAL');
  const relative = posixRelative(path.resolve(root), candidate);
  if (hasForbiddenSegment(relative) && !options.allowForbidden) fail(`La fuente está en un área no operativa: ${sourceLabel}`, 'FORBIDDEN_SOURCE');

  let resolved;
  try {
    resolved = await fs.realpath(candidate);
  } catch {
    fail(`No existe la fuente local: ${sourceLabel}`, 'SOURCE_NOT_FOUND');
  }
  if (!isInside(rootReal, resolved)) fail(`El enlace simbólico sale del checkout: ${sourceLabel}`, 'SYMLINK_OUTSIDE');
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    fail(`No se puede leer la fuente local: ${sourceLabel}`, 'SOURCE_NOT_READABLE');
  }
  if (!stat.isFile()) fail(`La fuente no es un archivo: ${sourceLabel}`, 'INVALID_SOURCE');
  return { absolute: resolved, relative: posixRelative(rootReal, resolved) };
}

async function readJson(file, description) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    fail(`No se encontró ${description}: ${file}`, 'CONFIG_NOT_FOUND');
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${description} no es JSON válido: ${error.message}`, 'CONFIG_INVALID');
  }
}

function validateConfig(config, key, itemKey) {
  if (!config || !Array.isArray(config[key])) fail(`La configuración no contiene ${key}[]`, 'CONFIG_INVALID');
  for (const item of config[key]) {
    if (!item || typeof item.id !== 'string' || !item.id) fail(`Entrada inválida en ${key}: falta id`, 'CONFIG_INVALID');
    if (itemKey === 'role' && (typeof item.model !== 'string' || !item.model || typeof item.reasoningEffort !== 'string' || !item.reasoningEffort)) {
      fail(`El rol ${item.id} debe declarar model y reasoningEffort`, 'CONFIG_INVALID');
    }
    if (itemKey === 'project' && (!Array.isArray(item.requiredSources) || typeof item.moduleBase !== 'string' || typeof item.layerBase !== 'string')) {
      fail(`El proyecto ${item.id} debe declarar requiredSources, moduleBase y layerBase`, 'CONFIG_INVALID');
    }
  }
}

async function loadConfiguration(configRoot = DEFAULT_CONFIG_ROOT) {
  const root = asAbsolute(configRoot, 'configRoot');
  const roles = await readJson(path.join(root, 'docs', 'organization', 'CODEX_ROLES.json'), 'CODEX_ROLES.json');
  const projects = await readJson(path.join(root, 'docs', 'organization', 'PROJECTS.json'), 'PROJECTS.json');
  validateConfig(roles, 'roles', 'role');
  validateConfig(projects, 'projects', 'project');
  return { roles: roles.roles, projects: projects.projects };
}

function findById(items, id, kind) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) fail(`${kind} inexistente: ${id}`, `${kind.toUpperCase()}_NOT_FOUND`);
  return item;
}

function stripLinkTarget(raw) {
  let target = raw.trim();
  if ((target.startsWith('<') && target.endsWith('>')) || (target.startsWith('"') && target.endsWith('"'))) target = target.slice(1, -1).trim();
  try { target = decodeURIComponent(target); } catch { /* preserve malformed local target for a useful error */ }
  return target;
}

function localMarkdownLinks(content) {
  const lines = content.split('\n');
  const normative = [];
  let active = false;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) active = /^(?:leer\s+también|leer\s+tambien|fuente(?:\/decision)?|fuentes\s+permitidas)$/i.test(heading[1].trim());
    if (active) normative.push(line);
  }
  // The common module contract is a normative inheritance link in the ficha
  // preamble, before the explicit Fuente/decision section.
  const commonContract = content.match(/\]\(([^)\n]*MODULE_COMMON_CONTRACT\.md)\)/i);
  if (commonContract) normative.push(`[common](${commonContract[1]})`);
  const normativeContent = normative.join('\n');
  const links = [];
  const pattern = /!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g;
  for (const match of normativeContent.matchAll(pattern)) {
    const target = stripLinkTarget(match[1]);
    const clean = target.split('#', 1)[0].split('?', 1)[0];
    if (clean) links.push(clean);
  }
  // Barberox fichas también declaran contratos en backticks, por ejemplo
  // `../../CONTRATOS_NODOS.md` o `C5_HANDLERS.md`.
  const inlinePath = /`([^`\r\n]+\.(?:md|json))`/gi;
  const withoutMarkdownLinks = normativeContent.replace(pattern, '');
  for (const match of withoutMarkdownLinks.matchAll(inlinePath)) {
    const target = stripLinkTarget(match[1]);
    if (!isExternalLink(target)) links.push(target);
  }
  return [...new Set(links)];
}

function isExternalLink(target) {
  return target.startsWith('//') || URL_SCHEME.test(target) || target.startsWith('#');
}

async function resolveLinkedSource(root, fromAbsolute, target) {
  if (target.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(target)) fail(`Enlace local absoluto no permitido: ${target}`, 'PATH_TRAVERSAL');
  if (isExternalLink(target)) return null;
  const fromDir = path.dirname(fromAbsolute);
  const relativeCandidate = path.resolve(fromDir, target);
  if (target.startsWith('../') || target.startsWith('..\\')) {
    if (!isInside(path.resolve(root), relativeCandidate)) fail(`El enlace local sale del checkout: ${target}`, 'PATH_TRAVERSAL');
  }
  if (hasForbiddenSegment(target) || hasForbiddenSegment(posixRelative(path.resolve(root), relativeCandidate))) return null;
  const candidates = /^(?:docs|agente-barbero)\//i.test(target)
    ? [path.resolve(root, target)]
    : [relativeCandidate, path.resolve(root, target), path.resolve(root, 'docs', target), path.resolve(root, 'barberox-core-api', target)];
  const existing = [];
  for (const candidate of [...new Set(candidates)]) {
    if (!isInside(path.resolve(root), candidate)) continue;
    if (hasForbiddenSegment(posixRelative(path.resolve(root), candidate))) continue;
    // Credential material and environment files never enter a context package.
    if (/(^|[\\/])(?:credentials|secrets)(?:[\\/]|$)|\.env(?:\.|$)/i.test(posixRelative(path.resolve(root), candidate))) continue;
    try {
      const stat = await fs.stat(candidate);
      const file = stat.isDirectory() ? path.join(candidate, 'README.md') : candidate;
      if ((await fs.stat(file)).isFile()) existing.push(file);
    } catch { /* candidate does not exist */ }
  }
  if (existing.length === 0) fail(`El enlace local no existe: ${target}`, 'LINK_NOT_FOUND');
  if (existing.length > 1) fail(`El enlace local es ambiguo: ${target}`, 'LINK_AMBIGUOUS');
  return safeFile(root, path.relative(root, existing[0]), target);
}

function isOperationalFicha(relative) {
  return /^docs\/biblioteca\/(?:modulos\/[^/]+\/README\.md|capas\/[^/]+\.md)$/i.test(relative);
}

async function sourceRecord(root, absolute, relative) {
  const bytes = await fs.readFile(absolute);
  const content = bytes.toString('utf8').replace(/\r\n?/g, '\n');
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return { path: relative, content, sha256: hash, bytes: Buffer.byteLength(content, 'utf8') };
}

function canonicalSourceMap(records) {
  return new Map(records.map((record) => [record.path, record]));
}

async function collectSources(root, seeds) {
  const rootReal = await realRoot(root);
  const queue = [];
  for (const seed of seeds) {
    const descriptor = typeof seed === 'string' ? { path: seed, followLinks: false } : seed;
    const file = await safeFile(rootReal, descriptor.path, descriptor.path, descriptor);
    queue.push({ ...file, followLinks: descriptor.followLinks === true });
  }
  const records = [];
  const seen = new Set();
  while (queue.length) {
    const item = queue.shift();
    const file = item;
    if (seen.has(file.relative)) continue;
    seen.add(file.relative);
    const record = await sourceRecord(rootReal, file.absolute, file.relative);
    records.push(record);
    if (item.followLinks) for (const link of localMarkdownLinks(record.content)) {
      const linked = await resolveLinkedSource(rootReal, file.absolute, link);
      if (linked && !seen.has(linked.relative)) queue.push({ ...linked, followLinks: isOperationalFicha(linked.relative) });
    }
  }
  records.sort((a, b) => a.path.localeCompare(b.path));
  return records;
}

async function fileExists(file) {
  try { return (await fs.stat(file)).isFile(); } catch { return false; }
}

async function governanceSeeds(configRoot) {
  const root = await realRoot(configRoot);
  const candidates = [
    'AGENTS.md',
    'docs/INICIAL.md',
    'docs/organization/DESARROLLO_CODEX.md',
    'docs/organization/CODEX_ROLES.json',
    'docs/organization/PROJECTS.json',
    'docs/organization/CARGOS_Y_NOMBRAMIENTOS.md',
    'docs/organization/MESA_DIRECCION_INTEGRAL.md',
    'docs/organization/OFICINA_FITO.md',
  ];
  return { root, seeds: candidates.map((candidate) => ({ path: candidate, followLinks: false })) };
}

async function barberoxDynamicSeeds(root, projectId) {
  if (projectId !== 'barberox') return [];
  const statePath = 'docs/state/PROJECT_STATE.json';
  const sessionPath = 'docs/SESSION_STATE.md';
  const seeds = [
    { path: statePath, followLinks: false },
    { path: sessionPath, followLinks: false },
  ];
  const stateFile = await safeFile(root, statePath, statePath);
  let state;
  try { state = JSON.parse(await fs.readFile(stateFile.absolute, 'utf8')); } catch (error) { fail(`Estado Barberox inválido: ${error.message}`, 'STATE_INVALID'); }
  const activePath = state?.activeTask?.path;
  if (typeof activePath !== 'string' || !activePath) fail('Barberox no declara una tarea activa válida', 'ACTIVE_TASK_MISSING');
  const activeRoot = path.resolve(root, 'docs', 'TASKS', 'active');
  const activeAbsolute = path.resolve(root, activePath);
  if (!isInside(activeRoot, activeAbsolute) || path.extname(activeAbsolute).toLowerCase() !== '.md') fail('La tarea activa debe estar bajo docs/TASKS/active y ser Markdown', 'ACTIVE_TASK_INVALID');
  seeds.push({ path: activePath, followLinks: false, allowForbidden: true });
  return seeds;
}

function expandBase(base, selected, label) {
  if (typeof base !== 'string' || !base) fail(`${label} no está configurado`, 'CONFIG_INVALID');
  if (base.includes('{value}') || base.includes(`{${label}}`)) return base.replace('{value}', selected).replace(`{${label}}`, selected);
  const normalized = base.replace(/[\\/]$/, '');
  if (path.extname(normalized).toLowerCase() === '.md' || path.extname(normalized).toLowerCase() === '.txt') return normalized;
  return path.join(normalized, label === 'module' ? path.join(selected, 'README.md') : `${selected}.md`);
}

function packageMetadata({ root, project, role, modules, layers }) {
  return {
    root: path.resolve(root),
    project: project.id,
    role: role.id,
    model: role.model,
    reasoningEffort: role.reasoningEffort,
    modules: [...modules],
    layers: [...layers],
  };
}

function ensureSelections(roleId, modules, layers) {
  if (HIGH_CONTEXT_ROLES.has(roleId) && (modules.length === 0 || layers.length === 0)) {
    fail(`El rol ${roleId} requiere al menos un módulo y una capa`, 'SELECTION_REQUIRED');
  }
  if ((modules.length > 0) !== (layers.length > 0)) fail('Módulo y capa deben seleccionarse juntos', 'SELECTION_REQUIRED');
}

function uniqueStrings(values, label) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) values = [values];
  const result = [];
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) fail(`${label} inválido`, 'INVALID_ARGUMENT');
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

export async function buildProjectContext(options = {}) {
  const root = await realRoot(asAbsolute(options.root, 'root'));
  const projectId = options.project;
  const roleId = options.role;
  if (typeof projectId !== 'string' || !projectId) fail('project es obligatorio', 'INVALID_ARGUMENT');
  if (typeof roleId !== 'string' || !roleId) fail('role es obligatorio', 'INVALID_ARGUMENT');
  const config = options.configuration ?? await loadConfiguration(options.configRoot);
  validateConfig({ roles: config.roles }, 'roles', 'role');
  validateConfig({ projects: config.projects }, 'projects', 'project');
  const role = findById(config.roles, roleId, 'Rol');
  const project = findById(config.projects, projectId, 'Proyecto');
  const modules = uniqueStrings(options.modules ?? options.module, 'module');
  const layers = uniqueStrings(options.layers ?? options.layer, 'layer');
  ensureSelections(role.id, modules, layers);

  const seeds = project.requiredSources.map((source) => ({ path: source, followLinks: false }));
  for (const module of modules) seeds.push({ path: expandBase(project.moduleBase, module, 'module'), followLinks: true });
  for (const layer of layers) seeds.push({ path: expandBase(project.layerBase, layer, 'layer'), followLinks: true });
  for (const dynamic of await barberoxDynamicSeeds(root, project.id)) seeds.push(dynamic);
  const records = await collectSources(root, seeds);
  if (records.length === 0) fail('El paquete no contiene fuentes', 'PACKAGE_INCOMPLETE');
  const governance = await governanceSeeds(options.configRoot ?? DEFAULT_CONFIG_ROOT);
  const governanceRecords = await collectSources(governance.root, governance.seeds);
  if (governanceRecords.length === 0) fail('El paquete no contiene fuentes de gobierno SARA', 'GOVERNANCE_INCOMPLETE');
  const metadata = packageMetadata({ root, project, role, modules, layers });
  return {
    version: 1,
    kind: 'project-context-package',
    complete: true,
    ...metadata,
    sources: records,
    governanceRoot: governance.root,
    governanceSources: governanceRecords,
    limitation: 'El paquete prueba alcance, integridad y selección documental; no prueba comprensión semántica.',
  };
}

async function writeUtf8(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value, 'utf8');
}

export async function writeProjectContext(options = {}) {
  const context = options.context ?? await buildProjectContext(options);
  const output = options.output ? path.resolve(options.output) : null;
  const manifestPath = options.manifest ? path.resolve(options.manifest) : null;
  const packagePath = output ?? (manifestPath ? `${manifestPath}.package.json` : null);
  if (packagePath) await writeUtf8(packagePath, `${JSON.stringify(context, null, 2)}\n`);
  if (manifestPath) {
    if (!packagePath) fail('manifest requiere un paquete persistido', 'INVALID_ARGUMENT');
    const manifest = {
      version: 1,
      kind: 'project-context-manifest',
      packagePath,
      root: context.root,
      governanceRoot: context.governanceRoot,
      project: context.project,
      role: context.role,
      model: context.model,
      reasoningEffort: context.reasoningEffort,
      modules: context.modules,
      layers: context.layers,
      sources: context.sources.map(({ path: sourcePath, sha256, bytes }) => ({ path: sourcePath, sha256, bytes })),
      governanceSources: context.governanceSources.map(({ path: sourcePath, sha256, bytes }) => ({ path: sourcePath, sha256, bytes })),
      limitation: context.limitation,
    };
    await writeUtf8(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return { context, packagePath, manifestPath };
}

function sameList(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

export async function verifyProjectContext(manifestPath, options = {}) {
  const manifestAbsolute = path.resolve(manifestPath);
  const manifest = await readJson(manifestAbsolute, 'manifest');
  if (manifest.kind !== 'project-context-manifest' || manifest.version !== 1) fail('Manifest inválido', 'MANIFEST_INVALID');
  const root = await realRoot(asAbsolute(options.root ?? manifest.root, 'root'));
  if (path.resolve(manifest.root) !== root) fail('El root del manifest no coincide con el checkout', 'ROOT_MISMATCH');
  const packagePath = manifest.packagePath ? path.resolve(path.dirname(manifestAbsolute), manifest.packagePath) : null;
  if (!packagePath) fail('Manifest incompleto: falta packagePath', 'PACKAGE_INCOMPLETE');
  let packageData;
  try { packageData = JSON.parse(await fs.readFile(packagePath, 'utf8')); } catch { fail(`No se puede leer el paquete: ${packagePath}`, 'PACKAGE_MISSING'); }
  if (packageData.kind !== 'project-context-package' || packageData.complete !== true) fail('Paquete incompleto', 'PACKAGE_INCOMPLETE');
  const fresh = await buildProjectContext({
    root,
    project: manifest.project,
    role: manifest.role,
    modules: manifest.modules,
    layers: manifest.layers,
    configRoot: options.configRoot,
    configuration: options.configuration,
  });
  for (const key of ['project', 'role', 'model', 'reasoningEffort', 'root', 'governanceRoot']) {
    if (packageData[key] !== fresh[key] || manifest[key] !== fresh[key]) fail(`Metadato alterado: ${key}`, 'METADATA_MISMATCH');
  }
  if (!sameList(packageData.modules, fresh.modules) || !sameList(packageData.layers, fresh.layers) || !sameList(manifest.modules, fresh.modules) || !sameList(manifest.layers, fresh.layers)) fail('Alcance de módulo/capa alterado', 'SCOPE_MISMATCH');
  const expected = canonicalSourceMap(fresh.sources);
  const packageSources = canonicalSourceMap(Array.isArray(packageData.sources) ? packageData.sources : []);
  const manifestSources = canonicalSourceMap(Array.isArray(manifest.sources) ? manifest.sources : []);
  if (expected.size !== packageSources.size || expected.size !== manifestSources.size) fail('Paquete incompleto: faltan fuentes', 'PACKAGE_INCOMPLETE');
  for (const [sourcePath, source] of expected) {
    const packaged = packageSources.get(sourcePath);
    const declared = manifestSources.get(sourcePath);
    if (!packaged || !declared) fail(`Paquete incompleto: falta ${sourcePath}`, 'PACKAGE_INCOMPLETE');
    if (source.sha256 !== packaged.sha256 || source.sha256 !== declared.sha256 || packaged.content !== source.content) fail(`Fuente modificada: ${sourcePath}`, 'SOURCE_CHANGED');
  }
  const expectedGovernance = canonicalSourceMap(fresh.governanceSources);
  const packageGovernance = canonicalSourceMap(Array.isArray(packageData.governanceSources) ? packageData.governanceSources : []);
  const manifestGovernance = canonicalSourceMap(Array.isArray(manifest.governanceSources) ? manifest.governanceSources : []);
  if (expectedGovernance.size !== packageGovernance.size || expectedGovernance.size !== manifestGovernance.size) fail('Paquete incompleto: faltan fuentes de gobierno', 'PACKAGE_INCOMPLETE');
  for (const [sourcePath, source] of expectedGovernance) {
    const packaged = packageGovernance.get(sourcePath);
    const declared = manifestGovernance.get(sourcePath);
    if (!packaged || !declared || source.sha256 !== packaged.sha256 || source.sha256 !== declared.sha256 || packaged.content !== source.content) fail(`Fuente de gobierno modificada: ${sourcePath}`, 'SOURCE_CHANGED');
  }
  return { ok: true, manifest: manifestAbsolute, packagePath, root, project: fresh.project, role: fresh.role, sources: fresh.sources.length };
}

// Alias names keep the small public API convenient for callers and tests.
export const createProjectContext = buildProjectContext;
export const verifyManifest = verifyProjectContext;

function parseArgs(argv) {
  const args = { modules: [], layers: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--module') args.modules.push(argv[++index]);
    else if (token === '--layer') args.layers.push(argv[++index]);
    else if (token === '--verify') args.verify = argv[++index];
    else if (token === '--manifest') args.manifest = argv[++index];
    else if (token === '--output') args.output = argv[++index];
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      if (!['project', 'root', 'role', 'config-root'].includes(key)) fail(`Argumento desconocido: ${token}`, 'INVALID_ARGUMENT');
      args[key.replaceAll('-', '')] = argv[++index];
    } else fail(`Argumento inesperado: ${token}`, 'INVALID_ARGUMENT');
  }
  return args;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.verify) {
    const result = await verifyProjectContext(args.verify, { root: args.root, configRoot: args.configroot });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const result = await writeProjectContext({
    project: args.project,
    root: args.root,
    role: args.role,
    modules: args.modules,
    layers: args.layers,
    manifest: args.manifest,
    output: args.output,
    configRoot: args.configroot,
  });
  const response = { ok: true, package: result.packagePath, manifest: result.manifestPath, ...result.context };
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message, code: error.code ?? 'ERROR' })}\n`);
    process.exitCode = 1;
  });
}
