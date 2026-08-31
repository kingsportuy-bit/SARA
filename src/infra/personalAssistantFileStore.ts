import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  writeSync,
  fsyncSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import type {
  ExpenseInput,
  ExpenseRecord,
  ExpenseResult,
  ExpenseListResult,
  ContextInput,
  ContextEntry,
  ContextResult,
  PersonalCase,
  CaseEvent,
  PersonalCaseInput,
  CaseEventInput,
  PersonalAssistantRepository,
  PersonalScope,
} from "../contracts/personalAssistant.js";
import { containsForbiddenMaterial, scanForForbidden } from "../modules/personalAssistant/personalAssistantGuard.js";

const STATE_SCHEMA = "personal_state.v1";
const EVENT_SCHEMA = "personal_event.v1";

interface State {
  schemaVersion: string;
  expenses: ExpenseRecord[];
  context: ContextEntry[];
  cases: PersonalCase[];
  caseEvents: CaseEvent[];
}

interface JournalEvent {
  schemaVersion: string;
  eventType: string;
  eventId: string;
  traceId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultState(): State {
  return { schemaVersion: STATE_SCHEMA, expenses: [], context: [], cases: [], caseEvents: [] };
}

function loadState(statePath: string): State {
  try {
    const raw = readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...defaultState(), ...parsed, expenses: parsed.expenses ?? [], context: parsed.context ?? [], cases: parsed.cases ?? [], caseEvents: parsed.caseEvents ?? [] };
  } catch (err: any) {
    if (err.code === "ENOENT") return defaultState();
    throw err;
  }
}

function atomicWriteJson(path: string, value: unknown): void {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}.json`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, JSON.stringify(value, null, 2));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(tmp, path);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {}
    throw err;
  }
}

function appendJournal(journalPath: string, event: JournalEvent): void {
  const line = JSON.stringify(event) + "\n";
  const fd = openSync(journalPath, "a");
  try {
    writeSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function isForbiddenValue(key: string, value: string): boolean {
  return containsForbiddenMaterial(`${key} ${value}`);
}

function forbiddenExpenseText(input: ExpenseInput | Partial<ExpenseInput>): boolean {
  return containsForbiddenMaterial(`${input.concept ?? ""} ${input.category ?? ""} ${input.entity ?? ""}`);
}

function forbiddenCaseInput(input: PersonalCaseInput | CaseEventInput): boolean {
  return scanForForbidden(input).forbidden;
}

function newEvent(eventType: string, traceId: string, payload: Record<string, unknown>): JournalEvent {
  return {
    schemaVersion: EVENT_SCHEMA,
    eventType,
    eventId: randomUUID(),
    traceId,
    occurredAt: nowIso(),
    payload,
  };
}

interface LockMeta {
  pid: number;
  token: string;
  startedAt: string;
  hostname: string;
}

function newLockMeta(): LockMeta {
  return {
    pid: process.pid,
    token: randomUUID(),
    startedAt: nowIso(),
    hostname: process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown",
  };
}

function readLockMeta(lockPath: string): LockMeta | undefined {
  try {
    const raw = readFileSync(lockPath, "utf8");
    return JSON.parse(raw) as LockMeta;
  } catch {
    return undefined;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * A lock is stale only when we can prove the owner is dead.
 * An active process never loses its lock because of age: PID life prevails.
 * If there is no metadata yet, the file may be mid-creation; only consider it
 * stale after staleMs have passed since the file was created.
 */
function isStaleLock(lockPath: string, staleMs: number): boolean {
  const meta = readLockMeta(lockPath);
  if (meta) {
    return !isProcessAlive(meta.pid);
  }
  try {
    const { birthtimeMs } = statSync(lockPath);
    return Date.now() - birthtimeMs > staleMs;
  } catch {
    return true;
  }
}

interface LockHandle {
  fd: number;
  meta: LockMeta;
}

/**
 * Acquire an exclusive file lock using O_EXCL creation, which is atomic on
 * both POSIX and Windows. The lock file content carries metadata (including a
 * unique token) so a later process can recover from a crash of the owner and
 * the owner can prove ownership before releasing the lock.
 */
function isRetryableLockError(code: string | undefined): boolean {
  // Windows may transiently deny access to the lock path while another handle
  // is being closed or the file is pending deletion. Treat these as contention.
  return code === "EACCES" || code === "EPERM" || code === "EBUSY" || code === "ENOENT";
}

function isStaleLockWithRetry(lockPath: string, staleMs: number): boolean {
  try {
    return isStaleLock(lockPath, staleMs);
  } catch (err: any) {
    if (isRetryableLockError(err.code)) return true; // be conservative and retry
    throw err;
  }
}

function removeLockFile(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch (err: any) {
    if (!isRetryableLockError(err.code)) throw err;
    // If Windows transiently blocks deletion, the file will become stale later
    // and be recovered by the next waiter. Do not leak a fatal error.
  }
}

/**
 * Stale recovery must be mutually exclusive. A contender first acquires a
 * separate recovery guard, then re-reads and revalidates the exact lock owner
 * before moving/removing it. This guarantees we never move a lock that was
 * freshly acquired based on stale information.
 */
function tryRecoverStaleLock(lockPath: string, staleMs: number, token: string): boolean {
  const recoveryPath = `${lockPath}.recovery`;
  let recoveryFd: number | undefined;
  try {
    recoveryFd = openSync(recoveryPath, "wx");
  } catch (err: any) {
    if (err.code === "EEXIST" || isRetryableLockError(err.code)) return false;
    throw err;
  }

  try {
    // Revalidate under the recovery guard: the lock may have already been
    // recovered or freshly acquired by another process.
    if (!existsSync(lockPath)) return false;

    const meta = readLockMeta(lockPath);
    let stillStale: boolean;
    if (meta) {
      stillStale = !isProcessAlive(meta.pid);
    } else {
      try {
        const { birthtimeMs } = statSync(lockPath);
        stillStale = Date.now() - birthtimeMs > staleMs;
      } catch (err: any) {
        if (isRetryableLockError(err.code)) return false;
        throw err;
      }
    }

    if (!stillStale) return false;

    const stalePath = `${lockPath}.stale-${token}`;
    try {
      renameSync(lockPath, stalePath);
    } catch (err: any) {
      if (err.code === "ENOENT") return false; // already gone
      if (isRetryableLockError(err.code)) return false;
      throw err;
    }

    removeLockFile(stalePath);
    return true;
  } finally {
    if (recoveryFd !== undefined) {
      try {
        closeSync(recoveryFd);
      } catch {}
    }
    removeLockFile(recoveryPath);
  }
}

async function acquireLock(lockPath: string, timeoutMs = 5000, pollMs = 20, staleMs = 30000): Promise<LockHandle> {
  const myMeta = newLockMeta();
  const start = Date.now();

  function shouldTimeout(): boolean {
    return Date.now() - start > timeoutMs;
  }

  function lockTimeoutError(): Error {
    return new Error(`personalAssistantFileStore lock timeout after ${timeoutMs}ms: ${lockPath}`);
  }

  async function backoff(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  while (true) {
    let fd: number | undefined;
    try {
      fd = openSync(lockPath, "wx");
    } catch (err: any) {
      if (err.code === "EEXIST") {
        if (isStaleLockWithRetry(lockPath, staleMs) && tryRecoverStaleLock(lockPath, staleMs, myMeta.token)) {
          continue;
        }
      } else if (!isRetryableLockError(err.code)) {
        throw err;
      }

      if (shouldTimeout()) throw lockTimeoutError();
      await backoff();
      continue;
    }

    try {
      writeSync(fd, JSON.stringify(myMeta));
      fsyncSync(fd);
    } catch (err: any) {
      try {
        closeSync(fd);
      } catch {}
      removeLockFile(lockPath);
      if (isRetryableLockError(err.code)) {
        if (shouldTimeout()) throw lockTimeoutError();
        await backoff();
        continue;
      }
      throw err;
    }

    return { fd, meta: myMeta };
  }
}

function releaseLock(handle: LockHandle | undefined, lockPath: string): void {
  if (handle !== undefined) {
    try {
      closeSync(handle.fd);
    } catch {}
  }
  try {
    // Only remove the lock if it still belongs to us. Another process may have
    // acquired the lock after we closed our fd; removing it would steal it.
    const current = readLockMeta(lockPath);
    if (current && current.token === handle?.meta.token && current.pid === handle?.meta.pid) {
      removeLockFile(lockPath);
    }
  } catch {}
}

export interface PersonalAssistantFileStoreOptions {
  dir: string;
  lockTimeoutMs?: number;
  lockStaleMs?: number;
}

function catchFailed<T extends { status: string; traceId?: string }>(promise: Promise<T>, traceId: string): Promise<T> {
  return promise.catch((err: unknown) => ({
    status: "failed" as const,
    error: err instanceof Error ? err.message : String(err),
    traceId,
  })) as Promise<T>;
}

export function createPersonalAssistantFileStore(options: PersonalAssistantFileStoreOptions): PersonalAssistantRepository {
  const dir = options.dir;
  const statePath = join(dir, "state.json");
  const journalPath = join(dir, "journal.jsonl");
  const lockPath = join(dir, "lock");

  // Directory creation is idempotent and safe outside the lock; the actual
  // repository files are initialized lazily under the exclusive lock to prevent
  // initialization races between concurrent processes.
  mkdirSync(dir, { recursive: true });

  let initialized = false;

  async function withLock<T>(fn: () => T): Promise<T> {
    const handle = await acquireLock(lockPath, options.lockTimeoutMs ?? 5000, 20, options.lockStaleMs ?? 30000);
    try {
      if (!initialized) {
        if (!existsSync(statePath)) {
          atomicWriteJson(statePath, defaultState());
        }
        if (!existsSync(journalPath)) {
          const fd = openSync(journalPath, "a");
          try {
            fsyncSync(fd);
          } finally {
            closeSync(fd);
          }
        }
        initialized = true;
      }
      return fn();
    } finally {
      releaseLock(handle, lockPath);
    }
  }

  return {
    async createExpense(input: ExpenseInput): Promise<ExpenseResult> {
      if (forbiddenExpenseText(input)) return { status: "failed", error: "forbidden personal data", traceId: input.traceId };
      if (!input.scope) return { status: "failed", error: "scope is required", traceId: input.traceId };
      if (!Number.isFinite(input.amount) || input.amount <= 0) return { status: "failed", error: "amount must be positive", traceId: input.traceId };
      if (!input.concept || !input.concept.trim()) return { status: "failed", error: "concept is required", traceId: input.traceId };
      if (input.scope === "BUSINESS" && !input.entity) return { status: "failed", error: "entity is required for BUSINESS expenses", traceId: input.traceId };

      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const id = randomUUID();
          const eventId = randomUUID();
          const record: ExpenseRecord = {
            id,
            scope: input.scope,
            amount: input.amount,
            currency: (input.currency ?? "UYU").toUpperCase(),
            occurredOn: input.occurredOn ?? nowIso().slice(0, 10),
            concept: input.concept.trim(),
            category: input.category,
            entity: input.entity,
            source: input.source ?? "manual",
            confidence: input.confidence ?? 0.9,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            traceId: input.traceId,
          };
          state.expenses.push(record);
          appendJournal(
            journalPath,
            newEvent("expense_created", input.traceId, {
              id,
              eventId,
              scope: record.scope,
              amount: record.amount,
              currency: record.currency,
              concept: record.concept,
              entity: record.entity,
              source: record.source,
            }),
          );
          atomicWriteJson(statePath, state);
          return {
            status: "created",
            expense: record,
            eventId,
            traceId: input.traceId,
            schemaVersion: "expense_created.v1",
          };
        }),
        input.traceId,
      );
    },

    async listExpenses(limit?: number): Promise<ExpenseListResult> {
      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const sorted = [...state.expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const expenses = limit !== undefined && limit >= 0 ? sorted.slice(0, limit) : sorted;
          return { status: "success", expenses };
        }),
        "",
      );
    },

    async updateExpense(id: string, patch: Partial<ExpenseInput>, traceId: string): Promise<ExpenseResult> {
      if (forbiddenExpenseText(patch)) return { status: "failed", error: "forbidden personal data", traceId };
      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const idx = state.expenses.findIndex((e) => e.id === id);
          if (idx === -1) return { status: "failed", error: "expense not found", traceId };
          const current = state.expenses[idx];
          const updated: ExpenseRecord = {
            ...current,
            amount: patch.amount ?? current.amount,
            currency: patch.currency ? patch.currency.toUpperCase() : current.currency,
            occurredOn: patch.occurredOn ?? current.occurredOn,
            concept: patch.concept ? patch.concept.trim() : current.concept,
            category: patch.category ?? current.category,
            entity: patch.entity ?? current.entity,
            scope: patch.scope ?? current.scope,
            source: patch.source ?? current.source,
            confidence: patch.confidence ?? current.confidence,
            updatedAt: nowIso(),
            traceId,
          };
          state.expenses[idx] = updated;
          appendJournal(journalPath, newEvent("expense_updated", traceId, { id, eventId: randomUUID(), patch: { ...patch, traceId: undefined } }));
          atomicWriteJson(statePath, state);
          return { status: "updated", expense: updated, traceId, schemaVersion: "expense_updated.v1" };
        }),
        traceId,
      );
    },

    async reclassifyExpense(id: string, scope: PersonalScope, entity: string | undefined, traceId: string): Promise<ExpenseResult> {
      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const idx = state.expenses.findIndex((e) => e.id === id);
          if (idx === -1) return { status: "failed", error: "expense not found", traceId };
          const current = state.expenses[idx];
          if (scope === "BUSINESS" && !entity) return { status: "failed", error: "entity is required for BUSINESS expenses", traceId };
          const updated: ExpenseRecord = { ...current, scope, entity, updatedAt: nowIso(), traceId };
          state.expenses[idx] = updated;
          appendJournal(journalPath, newEvent("expense_reclassified", traceId, { id, eventId: randomUUID(), scope, entity }));
          atomicWriteJson(statePath, state);
          return { status: "updated", expense: updated, traceId, schemaVersion: "expense_reclassified.v1" };
        }),
        traceId,
      );
    },

    async saveContext(input: ContextInput): Promise<ContextResult> {
      if (input.kind === "forbidden" || isForbiddenValue(input.key, input.value)) {
        return { status: "failed", error: "forbidden personal data", traceId: input.traceId };
      }
      if (input.kind === "ephemeral") return { status: "no_persisted", error: "ephemeral context was not persisted", traceId: input.traceId };
      if (input.kind === "sensitive" && input.consent !== true) {
        return { status: "failed", error: "explicit consent required", traceId: input.traceId };
      }
      if (!input.key || !input.key.trim()) return { status: "failed", error: "key is required", traceId: input.traceId };

      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const id = randomUUID();
          const eventId = randomUUID();
          const entry: ContextEntry = {
            id,
            key: input.key.trim(),
            value: input.value,
            kind: input.kind === "sensitive" ? "sensitive" : "durable",
            source: input.source,
            declaredAt: nowIso(),
            reviewAt: input.reviewAt,
            consented: input.kind === "durable" || input.consent === true,
          };
          state.context.push(entry);
          appendJournal(
            journalPath,
            newEvent("context_saved", input.traceId, {
              id,
              eventId,
              key: entry.key,
              kind: entry.kind,
              source: entry.source,
              consented: entry.consented,
            }),
          );
          atomicWriteJson(statePath, state);
          return { status: "stored", entry, eventId, traceId: input.traceId, schemaVersion: "context_saved.v1" };
        }),
        input.traceId,
      );
    },

    async correctContext(id: string, input: ContextInput): Promise<ContextResult> {
      if (input.kind === "forbidden" || isForbiddenValue(input.key, input.value)) {
        return { status: "failed", error: "forbidden personal data", traceId: input.traceId };
      }
      if (input.kind === "ephemeral") return { status: "no_persisted", error: "ephemeral context was not persisted", traceId: input.traceId };
      if (input.kind === "sensitive" && input.consent !== true) {
        return { status: "failed", error: "explicit consent required", traceId: input.traceId };
      }

      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const idx = state.context.findIndex((c) => c.id === id);
          if (idx === -1) return { status: "failed", error: "context entry not found", traceId: input.traceId };
          const entry: ContextEntry = {
            ...state.context[idx],
            key: input.key.trim(),
            value: input.value,
            kind: input.kind === "sensitive" ? "sensitive" : "durable",
            source: input.source,
            declaredAt: nowIso(),
            reviewAt: input.reviewAt,
            consented: input.kind === "durable" || input.consent === true,
          };
          state.context[idx] = entry;
          appendJournal(
            journalPath,
            newEvent("context_corrected", input.traceId, {
              id,
              eventId: randomUUID(),
              key: entry.key,
              kind: entry.kind,
              source: entry.source,
              consented: entry.consented,
            }),
          );
          atomicWriteJson(statePath, state);
          return { status: "stored", entry, eventId: randomUUID(), traceId: input.traceId, schemaVersion: "context_corrected.v1" };
        }),
        input.traceId,
      );
    },

    async listContext(): Promise<ContextEntry[]> {
      try {
        return await withLock(() => {
          const state = loadState(statePath);
          return [...state.context];
        });
      } catch {
        return [];
      }
    },

    async forgetContext(id: string, traceId: string): Promise<ContextResult> {
      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const idx = state.context.findIndex((c) => c.id === id);
          if (idx === -1) return { status: "failed", error: "context entry not found", traceId };
          const entry = state.context[idx];
          state.context.splice(idx, 1);
          appendJournal(
            journalPath,
            newEvent("context_forgotten", traceId, {
              id,
              eventId: randomUUID(),
              key: entry.key,
              kind: entry.kind,
              redacted: true,
            }),
          );
          atomicWriteJson(statePath, state);
          return { status: "forgotten", traceId, schemaVersion: "context_forgotten.v1" };
        }),
        traceId,
      );
    },

    async createCase(input: PersonalCaseInput): Promise<{ status: "created" | "failed"; case?: PersonalCase; eventId?: string; traceId?: string; schemaVersion?: string; error?: string }> {
      if (forbiddenCaseInput(input)) return { status: "failed", error: "forbidden personal data", traceId: input.traceId };
      if (!input.name || !input.name.trim()) return { status: "failed", error: "name is required", traceId: input.traceId };
      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const id = randomUUID();
          const eventId = randomUUID();
          const now = nowIso();
          const record: PersonalCase = {
            id,
            name: input.name.trim(),
            description: input.description,
            status: "open",
            createdAt: now,
            updatedAt: now,
          };
          state.cases.push(record);
          appendJournal(journalPath, newEvent("case_created", input.traceId, { id, eventId, name: record.name }));
          atomicWriteJson(statePath, state);
          return { status: "created", case: record, eventId, traceId: input.traceId, schemaVersion: "case_created.v1" };
        }),
        input.traceId,
      );
    },

    async addCaseEvent(input: CaseEventInput): Promise<{ status: "created" | "failed"; event?: CaseEvent; eventId?: string; traceId?: string; schemaVersion?: string; error?: string }> {
      if (forbiddenCaseInput(input)) return { status: "failed", error: "forbidden personal data", traceId: input.traceId };
      if (!input.caseId) return { status: "failed", error: "caseId is required", traceId: input.traceId };
      if (!input.type || !input.content) return { status: "failed", error: "type and content are required", traceId: input.traceId };
      return catchFailed(
        withLock(() => {
          const state = loadState(statePath);
          const caseRecord = state.cases.find((c) => c.id === input.caseId);
          if (!caseRecord) return { status: "failed", error: "case not found", traceId: input.traceId };
          const id = randomUUID();
          const eventId = randomUUID();
          const event: CaseEvent = {
            id,
            caseId: input.caseId,
            type: input.type,
            content: input.content,
            createdAt: nowIso(),
          };
          state.caseEvents.push(event);
          caseRecord.updatedAt = nowIso();
          appendJournal(journalPath, newEvent("case_event_added", input.traceId, { id, eventId, caseId: input.caseId, type: input.type }));
          atomicWriteJson(statePath, state);
          return { status: "created", event, eventId, traceId: input.traceId, schemaVersion: "case_event_added.v1" };
        }),
        input.traceId,
      );
    },

    async listCaseEvents(caseId: string): Promise<CaseEvent[]> {
      try {
        return await withLock(() => {
          const state = loadState(statePath);
          return state.caseEvents
            .filter((e) => e.caseId === caseId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
      } catch {
        return [];
      }
    },

    async listCases(): Promise<PersonalCase[]> {
      try {
        return await withLock(() => {
          const state = loadState(statePath);
          return [...state.cases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      } catch {
        return [];
      }
    },
  };
}
