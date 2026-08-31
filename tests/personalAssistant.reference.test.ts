import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createPersonalAssistantFileStore } from "../src/infra/personalAssistantFileStore.js";
import { createPersonalAssistantModule } from "../src/modules/personalAssistant/personalAssistantModule.js";
import { parseExpenseCommand } from "../src/modules/personalAssistant/personalAssistantParser.js";
import { scanForForbidden } from "../src/modules/personalAssistant/personalAssistantGuard.js";

const traceId = "trace-1";

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "sara-personal-"));
  const store = createPersonalAssistantFileStore({ dir });
  const module = createPersonalAssistantModule(store);
  return { dir, store, module, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function runCli(dir: string, json: unknown): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["scripts/sara-personal.mjs", JSON.stringify(json)], {
      cwd: process.cwd(),
      env: { ...process.env, SARA_PERSONAL_DIR: dir },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

describe("SARA Personal V1", () => {
  it("parses UYU separators and never guesses USD for an unexplained $", () => {
    expect(parseExpenseCommand("gasto personal UYU 1.200,50 comida")).toMatchObject({ scope: "PERSONAL", amount: 1200.5, currency: "UYU" });
    expect(parseExpenseCommand("gasto personal UYU 1.234.567 supermercado")).toMatchObject({ amount: 1234567 });
    expect(parseExpenseCommand("gasto empresa UYU 3200 de combustible en DELTA")).toMatchObject({ scope: "BUSINESS", amount: 3200, entity: "DELTA" });
    expect(parseExpenseCommand("gasto business UYU 200 en DELTA")).toMatchObject({ scope: "BUSINESS", amount: 200, entity: "DELTA" });
    expect(parseExpenseCommand("gasto business UYU 200 por servicio de BARBEROX")).toMatchObject({ scope: "BUSINESS", amount: 200, entity: "BARBEROX" });
    expect(parseExpenseCommand("gasto personal $25 comida")).toEqual({ missingData: ["currency"] });
    expect(parseExpenseCommand("gasto business $25 comida")).toEqual({ missingData: ["entity", "currency"] });
  });

  it("stores, updates and reclassifies expenses without losing event evidence", async () => {
    const { module, cleanup } = makeRepo();
    try {
      const created = await module.createExpense({ scope: "PERSONAL", amount: 10, concept: "cafe", source: "manual", traceId });
      expect(created.status).toBe("created");
      const id = created.expense!.id;
      const changed = await module.reclassifyExpense(id, "BUSINESS", "SimpleBox", traceId);
      expect(changed.status).toBe("updated");
      expect(changed.expense).toMatchObject({ scope: "BUSINESS", entity: "SimpleBox" });
    } finally {
      cleanup();
    }
  });

  it("requires consent, rejects forbidden data, and keeps case events chronological", async () => {
    const { module, cleanup } = makeRepo();
    try {
      expect((await module.saveContext({ key: "health", value: "dato", kind: "sensitive", source: "manual", traceId })).status).toBe("failed");
      expect((await module.saveContext({ key: "token", value: "secret", kind: "forbidden", source: "manual", traceId })).status).toBe("failed");
      expect((await module.saveContext({ key: "credential", value: "my password", kind: "durable", source: "manual", traceId })).status).toBe("failed");
      expect(await module.saveContext({ key: "temporary", value: "only this turn", kind: "ephemeral", source: "manual", traceId })).toMatchObject({ status: "no_persisted" });
      const stored = await module.saveContext({ key: "priority", value: "focus", kind: "durable", source: "manual", traceId });
      expect(stored.status).toBe("stored");
      const created = await module.createCase({ name: "SimpleBox", traceId });
      await module.addCaseEvent({ caseId: created.case!.id, type: "pending", content: "pedir documento", traceId });
      await module.addCaseEvent({ caseId: created.case!.id, type: "reference", content: "expediente local", traceId });
      expect((await module.listCaseEvents(created.case!.id)).map((item) => item.type)).toEqual(["pending", "reference"]);
    } finally {
      cleanup();
    }
  });

  it("does not call the repository for ephemeral context", async () => {
    const { store, module, cleanup } = makeRepo();
    try {
      let calls = 0;
      const original = store.saveContext.bind(store);
      store.saveContext = async (input) => { calls += 1; return original(input); };
      expect(await module.saveContext({ key: "temporary", value: "one turn", kind: "ephemeral", source: "manual", traceId })).toMatchObject({ status: "no_persisted" });
      expect(calls).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("audits correction and forget without returning the forgotten value", async () => {
    const { module, cleanup } = makeRepo();
    try {
      const saved = await module.saveContext({ key: "focus", value: "old", kind: "durable", source: "manual", traceId });
      const corrected = await module.correctContext(saved.entry!.id, { key: "focus", value: "new", kind: "durable", source: "manual", traceId });
      expect(corrected).toMatchObject({ status: "stored", entry: { value: "new" }, traceId });
      const forgotten = await module.forgetContext(saved.entry!.id, traceId);
      expect(forgotten).toMatchObject({ status: "forgotten", traceId });
      expect(forgotten).not.toHaveProperty("entry.value");
    } finally {
      cleanup();
    }
  });

  it("guides without executing external actions", () => {
    const { module, cleanup } = makeRepo();
    try {
      expect(module.guide({ decision: "priorizar SimpleBox", context: [] }).externalActionExecuted).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe("personalAssistantFileStore E2E", () => {
  it("initializes an empty repository on first use", async () => {
    const { dir, store, cleanup } = makeRepo();
    try {
      const expenses = await store.listExpenses();
      expect(expenses.status).toBe("success");
      expect(expenses.expenses).toEqual([]);
      expect(existsSync(join(dir, "state.json"))).toBe(true);
      expect(existsSync(join(dir, "journal.jsonl"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("persists a personal expense and reads it back", async () => {
    const { store, cleanup } = makeRepo();
    try {
      const created = await store.createExpense({ scope: "PERSONAL", amount: 250, currency: "UYU", concept: "cafe", source: "manual", traceId });
      expect(created.status).toBe("created");
      const list = await store.listExpenses();
      expect(list.expenses).toHaveLength(1);
      expect(list.expenses[0]).toMatchObject({ scope: "PERSONAL", amount: 250, currency: "UYU", concept: "cafe" });
    } finally {
      cleanup();
    }
  });

  it("rejects a BUSINESS expense without entity", async () => {
    const { store, cleanup } = makeRepo();
    try {
      const result = await store.createExpense({ scope: "BUSINESS", amount: 100, currency: "UYU", concept: "servicio", source: "manual", traceId });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("entity");
    } finally {
      cleanup();
    }
  });

  it("persists a BUSINESS expense with entity", async () => {
    const { store, cleanup } = makeRepo();
    try {
      const result = await store.createExpense({ scope: "BUSINESS", amount: 500, currency: "UYU", concept: "combustible", entity: "DELTA", source: "manual", traceId });
      expect(result.status).toBe("created");
      expect(result.expense).toMatchObject({ scope: "BUSINESS", entity: "DELTA" });
    } finally {
      cleanup();
    }
  });

  it("rejects forbidden context values and never writes them", async () => {
    const { dir, store, cleanup } = makeRepo();
    try {
      const result = await store.saveContext({ key: "token", value: "secret", kind: "durable", source: "manual", traceId });
      expect(result.status).toBe("failed");
      const journal = existsSync(join(dir, "journal.jsonl")) ? readFileSync(join(dir, "journal.jsonl"), "utf8") : "";
      expect(journal).toBe("");
    } finally {
      cleanup();
    }
  });

  it("stores durable context and redacts it on forget", async () => {
    const { dir, store, cleanup } = makeRepo();
    try {
      const saved = await store.saveContext({ key: "prioridad", value: "focus", kind: "durable", source: "manual", traceId });
      expect(saved.status).toBe("stored");
      const before = await store.listContext();
      expect(before).toHaveLength(1);

      await store.forgetContext(saved.entry!.id, traceId);
      const after = await store.listContext();
      expect(after).toHaveLength(0);

      const journal = readFileSync(join(dir, "journal.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(journal).toHaveLength(2);
      expect(journal[0].eventType).toBe("context_saved");
      expect(journal[1].eventType).toBe("context_forgotten");
      expect(journal[1].payload.redacted).toBe(true);
      expect(journal[1].payload).not.toHaveProperty("value");
    } finally {
      cleanup();
    }
  });

  it("creates a case and keeps events in chronological order", async () => {
    const { store, cleanup } = makeRepo();
    try {
      const created = await store.createCase({ name: "SimpleBox", traceId });
      expect(created.status).toBe("created");
      const caseId = created.case!.id;
      await store.addCaseEvent({ caseId, type: "pending", content: "pedir documento", traceId });
      await store.addCaseEvent({ caseId, type: "reference", content: "expediente local", traceId });
      await store.addCaseEvent({ caseId, type: "note", content: "llamada", traceId });
      const events = await store.listCaseEvents(caseId);
      expect(events.map((e) => e.type)).toEqual(["pending", "reference", "note"]);
    } finally {
      cleanup();
    }
  });

  it("returns failed for unknown expense on reclassify", async () => {
    const { store, cleanup } = makeRepo();
    try {
      const result = await store.reclassifyExpense("no-existe", "BUSINESS", "DELTA", traceId);
      expect(result.status).toBe("failed");
      expect(result.error).toContain("not found");
    } finally {
      cleanup();
    }
  });

  it("lists cases sorted by creation time", async () => {
    const { store, cleanup } = makeRepo();
    try {
      await store.createCase({ name: "A", traceId });
      await store.createCase({ name: "B", traceId });
      const cases = await store.listCases();
      expect(cases.map((c) => c.name)).toEqual(["B", "A"]);
    } finally {
      cleanup();
    }
  });
});

describe("personalAssistantFileStore concurrency", () => {
  it("survives concurrent writes inside one process without losing data", async () => {
    const { store, cleanup } = makeRepo();
    try {
      const workers = [
        store.createExpense({ scope: "PERSONAL", amount: 1, currency: "UYU", concept: "a", source: "manual", traceId }),
        store.createExpense({ scope: "PERSONAL", amount: 2, currency: "UYU", concept: "b", source: "manual", traceId }),
        store.saveContext({ key: "k1", value: "v1", kind: "durable", source: "manual", traceId }),
        store.saveContext({ key: "k2", value: "v2", kind: "durable", source: "manual", traceId }),
        store.createCase({ name: "C1", traceId }),
        store.createCase({ name: "C2", traceId }),
      ];
      const results = await Promise.all(workers);
      for (const r of results) {
        expect(r.status === "created" || r.status === "stored").toBe(true);
      }

      const expenses = await store.listExpenses();
      expect(expenses.expenses).toHaveLength(2);
      expect(expenses.expenses.reduce((sum, e) => sum + e.amount, 0)).toBe(3);

      const context = await store.listContext();
      expect(context).toHaveLength(2);

      const cases = await store.listCases();
      expect(cases).toHaveLength(2);
    } finally {
      cleanup();
    }
  });
});

describe("personalAssistantFileStore R1 fixes", () => {
  it("recovers from a stale lock left by a dead process", async () => {
    const { dir, store, cleanup } = makeRepo();
    try {
      const lockPath = join(dir, "lock");
      writeFileSync(lockPath, JSON.stringify({ pid: 999999, startedAt: new Date(Date.now() - 60000).toISOString(), hostname: "test" }));

      const result = await store.createExpense({ scope: "PERSONAL", amount: 100, currency: "UYU", concept: "after crash", source: "manual", traceId });
      expect(result.status).toBe("created");
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("does not delete an active lock from the same process", async () => {
    const { dir, cleanup } = makeRepo();
    try {
      const lockPath = join(dir, "lock");
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), hostname: "test" }));

      // A second operation should wait for the active lock rather than steal it.
      // We use a very short timeout to keep the test fast.
      const store2 = createPersonalAssistantFileStore({ dir, lockTimeoutMs: 100 });
      const result = await store2.createExpense({ scope: "PERSONAL", amount: 100, currency: "UYU", concept: "contended", source: "manual", traceId });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("lock timeout");
      expect(existsSync(lockPath)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("never removes an active lock based on age alone", async () => {
    const { dir, cleanup } = makeRepo();
    try {
      const lockPath = join(dir, "lock");
      // Active lock from this process, older than any staleMs.
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date(Date.now() - 60000).toISOString(), hostname: "test" }));

      const store2 = createPersonalAssistantFileStore({ dir, lockTimeoutMs: 100 });
      const result = await store2.createExpense({ scope: "PERSONAL", amount: 100, currency: "UYU", concept: "contended", source: "manual", traceId });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("lock timeout");
      expect(existsSync(lockPath)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("rejects forbidden material in expenses, cases and case events before persistence", async () => {
    const { dir, store, cleanup } = makeRepo();
    try {
      const expense = await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "my secret password", source: "manual", traceId });
      expect(expense.status).toBe("failed");

      const created = await store.createCase({ name: "SimpleBox", traceId });
      const event = await store.addCaseEvent({ caseId: created.case!.id, type: "note", content: "token: abc123", traceId });
      expect(event.status).toBe("failed");

      const journal = readFileSync(join(dir, "journal.jsonl"), "utf8");
      const lines = journal.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(JSON.stringify(parsed).toLowerCase()).not.toContain("password");
        expect(JSON.stringify(parsed).toLowerCase()).not.toContain("token");
      }
    } finally {
      cleanup();
    }
  });

  it("rejects credential terms while accepting ordinary words that contain similar substrings", async () => {
    const { store, cleanup } = makeRepo();
    try {
      // Positives: must be rejected.
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "PIN 1234", source: "manual", traceId })).status).toBe("failed");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "my password", source: "manual", traceId })).status).toBe("failed");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "token abc123", source: "manual", traceId })).status).toBe("failed");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "MFA required", source: "manual", traceId })).status).toBe("failed");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "OTP 123456", source: "manual", traceId })).status).toBe("failed");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "secretos del proyecto", source: "manual", traceId })).status).toBe("failed");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "recovery key", source: "manual", traceId })).status).toBe("failed");

      // Negatives: ordinary words must be accepted.
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "pintura", source: "manual", traceId })).status).toBe("created");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "opinión", source: "manual", traceId })).status).toBe("created");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "shopping", source: "manual", traceId })).status).toBe("created");
      expect((await store.createExpense({ scope: "PERSONAL", amount: 10, currency: "UYU", concept: "espinaca", source: "manual", traceId })).status).toBe("created");
    } finally {
      cleanup();
    }
  });

  it("lists and corrects context through the CLI", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-cli-"));
    try {
      const saved = await runCli(dir, { action: "context.save", payload: { key: "focus", value: "old", kind: "durable", source: "manual", traceId } });
      expect(saved.code).toBe(0);
      const savedJson = JSON.parse(saved.stdout);
      expect(savedJson.ok).toBe(true);
      const id = savedJson.id;

      const corrected = await runCli(dir, { action: "context.correct", payload: { id, key: "focus", value: "new", kind: "durable", source: "manual", traceId } });
      expect(corrected.code).toBe(0);
      const correctedJson = JSON.parse(corrected.stdout);
      expect(correctedJson.ok).toBe(true);
      expect(correctedJson.entry.value).toBe("new");

      const listed = await runCli(dir, { action: "context.list", payload: {} });
      expect(listed.code).toBe(0);
      const listedJson = JSON.parse(listed.stdout);
      expect(listedJson.entries).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists and updates expenses through the CLI", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-cli-"));
    try {
      const created = await runCli(dir, { action: "expense.create", payload: { scope: "PERSONAL", amount: 10, currency: "UYU", concept: "cafe", source: "manual", traceId } });
      expect(created.code).toBe(0);
      const id = JSON.parse(created.stdout).id;

      const listed = await runCli(dir, { action: "expense.list", payload: {} });
      expect(JSON.parse(listed.stdout).expenses).toHaveLength(1);

      const updated = await runCli(dir, { action: "expense.update", payload: { id, amount: 25, concept: "cafe y medialuna", traceId } });
      expect(updated.code).toBe(0);
      const updatedJson = JSON.parse(updated.stdout);
      expect(updatedJson.expense.amount).toBe(25);

      const reclassified = await runCli(dir, { action: "expense.reclassify", payload: { id, scope: "BUSINESS", entity: "DELTA", traceId } });
      expect(reclassified.code).toBe(0);
      const reclassifiedJson = JSON.parse(reclassified.stdout);
      expect(reclassifiedJson.expense.scope).toBe("BUSINESS");
      expect(reclassifiedJson.expense.entity).toBe("DELTA");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists cases and events through the CLI", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-cli-"));
    try {
      const created = await runCli(dir, { action: "case.create", payload: { name: "SimpleBox", traceId } });
      expect(created.code).toBe(0);
      const caseId = JSON.parse(created.stdout).id;

      const event = await runCli(dir, { action: "case.event", payload: { caseId, type: "pending", content: "pedir documento", traceId } });
      expect(event.code).toBe(0);

      const cases = await runCli(dir, { action: "case.list", payload: {} });
      expect(JSON.parse(cases.stdout).cases).toHaveLength(1);

      const events = await runCli(dir, { action: "case.events", payload: { caseId } });
      expect(JSON.parse(events.stdout).events).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs real multi-process CLI concurrency without losing data for 20 rounds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-concurrent-"));
    try {
      const commands = [
        { action: "expense.create", payload: { scope: "PERSONAL", amount: 100, currency: "UYU", concept: "a", source: "manual", traceId } },
        { action: "expense.create", payload: { scope: "PERSONAL", amount: 200, currency: "UYU", concept: "b", source: "manual", traceId } },
        { action: "context.save", payload: { key: "k1", value: "v1", kind: "durable", source: "manual", traceId } },
        { action: "context.save", payload: { key: "k2", value: "v2", kind: "durable", source: "manual", traceId } },
        { action: "case.create", payload: { name: "C1", traceId } },
        { action: "case.create", payload: { name: "C2", traceId } },
      ];

      for (let round = 1; round <= 20; round += 1) {
        const processes = commands.map((cmd) => runCli(dir, cmd));
        const results = await Promise.all(processes);
        const ids: string[] = [];
        for (let i = 0; i < results.length; i += 1) {
          const r = results[i];
          const action = commands[i].action;
          let ok = false;
          let error = "";
          let id = "";
          try {
            const parsed = JSON.parse(r.stdout);
            ok = parsed.ok === true;
            error = parsed.error ?? "";
            id = parsed.id ?? "";
          } catch {
            error = "invalid JSON stdout";
          }
          if (r.code !== 0 || !ok) {
            throw new Error(`Round ${round} command ${action} failed: code=${r.code}, ok=${ok}, error=${error}`);
          }
          ids.push(id);
        }

        const summary = await runCli(dir, { action: "summary", payload: {} });
        const s = JSON.parse(summary.stdout).summary;
        const expected = round * 2;
        if (s.expenses !== expected || s.contextEntries !== expected || s.cases !== expected) {
          throw new Error(
            `Round ${round} count mismatch: expected ${expected} each, got expenses=${s.expenses} context=${s.contextEntries} cases=${s.cases}; ids=${ids.join(",")}`,
          );
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  it("preflight rejects forbidden case.create payload without creating the store or touching disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-forbidden-"));
    try {
      const result = await runCli(dir, { action: "case.create", payload: { name: "Caso", description: "pin 1234", traceId } });
      expect(result.code).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.ok).toBe(false);
      expect(json.error).toBe("forbidden personal data");
      expect(json.persisted).toBe(false);
      expect(existsSync(join(dir, "state.json"))).toBe(false);
      expect(existsSync(join(dir, "journal.jsonl"))).toBe(false);
      expect(result.stdout.toLowerCase()).not.toContain("pin");
      expect(result.stderr.toLowerCase()).not.toContain("pin");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preflight rejects forbidden expense.create payload without creating the store or touching disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-forbidden-expense-"));
    try {
      const result = await runCli(dir, { action: "expense.create", payload: { scope: "PERSONAL", amount: 10, currency: "UYU", concept: "my password", source: "manual", traceId } });
      expect(result.code).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.ok).toBe(false);
      expect(json.error).toBe("forbidden personal data");
      expect(json.persisted).toBe(false);
      expect(existsSync(join(dir, "state.json"))).toBe(false);
      expect(existsSync(join(dir, "journal.jsonl"))).toBe(false);
      expect(result.stdout.toLowerCase()).not.toContain("password");
      expect(result.stderr.toLowerCase()).not.toContain("password");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preflight rejects forbidden case.event and never writes the value", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-forbidden-event-"));
    try {
      const created = await runCli(dir, { action: "case.create", payload: { name: "SimpleBox", traceId } });
      expect(created.code).toBe(0);
      const caseId = JSON.parse(created.stdout).id;

      const result = await runCli(dir, { action: "case.event", payload: { caseId, type: "note", content: "token abc123", traceId } });
      expect(result.code).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.ok).toBe(false);
      expect(json.error).toBe("forbidden personal data");
      expect(json.persisted).toBe(false);

      const events = await runCli(dir, { action: "case.events", payload: { caseId } });
      expect(JSON.parse(events.stdout).events).toHaveLength(0);

      const journal = readFileSync(join(dir, "journal.jsonl"), "utf8");
      expect(journal.toLowerCase()).not.toContain("token");
      expect(result.stdout.toLowerCase()).not.toContain("token");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("personalAssistantFileStore R3 lock robustness", () => {
  it("many concurrent contenders recover a dead lock without losing data", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-deadlock-many-"));
    try {
      const lockPath = join(dir, "lock");
      // Plant a lock owned by a dead process.
      writeFileSync(lockPath, JSON.stringify({ pid: 999999, startedAt: new Date(Date.now() - 60000).toISOString(), hostname: "dead" }));

      const commands = Array.from({ length: 12 }, (_, i) => ({
        action: "expense.create",
        payload: { scope: "PERSONAL", amount: i + 1, currency: "UYU", concept: `item-${i}`, source: "manual", traceId },
      }));

      const processes = commands.map((cmd) => runCli(dir, cmd));
      const results = await Promise.all(processes);
      for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        let ok = false;
        let error = "";
        try {
          const parsed = JSON.parse(r.stdout);
          ok = parsed.ok === true;
          error = parsed.error ?? "";
        } catch {
          error = "invalid JSON stdout";
        }
        if (r.code !== 0 || !ok) {
          throw new Error(`Contender ${i} failed: code=${r.code}, ok=${ok}, error=${error}`);
        }
      }

      const listed = await runCli(dir, { action: "expense.list", payload: {} });
      const expenses = JSON.parse(listed.stdout).expenses;
      expect(expenses).toHaveLength(commands.length);
      expect(expenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)).toBe(
        commands.reduce((sum, _, i) => sum + i + 1, 0),
      );
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it("repeated multi-process rounds remain stable after concurrent dead-lock recovery", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sara-deadlock-rounds-"));
    try {
      const commands = [
        { action: "expense.create", payload: { scope: "PERSONAL", amount: 100, currency: "UYU", concept: "a", source: "manual", traceId } },
        { action: "expense.create", payload: { scope: "PERSONAL", amount: 200, currency: "UYU", concept: "b", source: "manual", traceId } },
        { action: "context.save", payload: { key: "k1", value: "v1", kind: "durable", source: "manual", traceId } },
        { action: "context.save", payload: { key: "k2", value: "v2", kind: "durable", source: "manual", traceId } },
        { action: "case.create", payload: { name: "C1", traceId } },
        { action: "case.create", payload: { name: "C2", traceId } },
      ];

      for (let round = 1; round <= 20; round += 1) {
        const lockPath = join(dir, "lock");
        writeFileSync(lockPath, JSON.stringify({ pid: 999999, startedAt: new Date(Date.now() - 60000).toISOString(), hostname: "dead" }));

        const processes = commands.map((cmd) => runCli(dir, cmd));
        const results = await Promise.all(processes);
        for (let i = 0; i < results.length; i += 1) {
          const r = results[i];
          const action = commands[i].action;
          let ok = false;
          let error = "";
          try {
            const parsed = JSON.parse(r.stdout);
            ok = parsed.ok === true;
            error = parsed.error ?? "";
          } catch {
            error = "invalid JSON stdout";
          }
          if (r.code !== 0 || !ok) {
            throw new Error(`Round ${round} command ${action} failed: code=${r.code}, ok=${ok}, error=${error}`);
          }
        }

        const summary = await runCli(dir, { action: "summary", payload: {} });
        const s = JSON.parse(summary.stdout).summary;
        const expected = round * 2;
        if (s.expenses !== expected || s.contextEntries !== expected || s.cases !== expected) {
          throw new Error(
            `Round ${round} count mismatch: expected ${expected} each, got expenses=${s.expenses} context=${s.contextEntries} cases=${s.cases}`,
          );
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});
