import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPersonalAssistantFileStore } from "../src/infra/personalAssistantFileStore.js";
import { createPersonalAssistantModule } from "../src/modules/personalAssistant/personalAssistantModule.js";
import { parseExpenseCommand } from "../src/modules/personalAssistant/personalAssistantParser.js";

const traceId = "trace-1";

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "sara-personal-"));
  const store = createPersonalAssistantFileStore({ dir });
  const module = createPersonalAssistantModule(store);
  return { dir, store, module, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
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
      const journal = readFileSync(join(dir, "journal.jsonl"), "utf8");
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
  it("survives two concurrent writes without losing data", async () => {
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
