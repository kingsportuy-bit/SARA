#!/usr/bin/env node
// scripts/sara-personal.mjs — JSON CLI para SARA Personal (local, sin red).
// Uso:
//   node scripts/sara-personal.mjs '{"action":"expense.create","payload":{"text":"gasto personal UYU 200 cafe","traceId":"t1"}}'
//   echo '{"action":"summary"}' | node scripts/sara-personal.mjs
// Env: SARA_PERSONAL_DIR (default: ./data/personal)

import { createPersonalAssistantFileStore } from "../dist/infra/personalAssistantFileStore.js";
import { createPersonalAssistantModule } from "../dist/modules/personalAssistant/personalAssistantModule.js";
import { parseExpenseCommand } from "../dist/modules/personalAssistant/personalAssistantParser.js";
import { scanForForbidden } from "../dist/modules/personalAssistant/personalAssistantGuard.js";

const DEFAULT_DIR = "./data/personal";

function repoDir() {
  return process.env.SARA_PERSONAL_DIR?.trim() || DEFAULT_DIR;
}

function createModule() {
  const store = createPersonalAssistantFileStore({ dir: repoDir() });
  return createPersonalAssistantModule(store);
}

async function readInput() {
  const arg = process.argv[2];
  if (arg) {
    return arg;
  }
  if (process.stdin.isTTY) {
    return "";
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseInput(raw) {
  const text = raw.trim();
  if (!text) return { ok: false, error: "missing JSON input" };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: "invalid JSON" };
  }
}

function success(action, id, persisted, data = {}) {
  return { ok: true, action, id, persisted, ...data };
}

function failure(action, error, persisted = false) {
  return { ok: false, action, persisted, error };
}

const MUTATING_ACTIONS = new Set([
  "expense.create",
  "expense.update",
  "expense.reclassify",
  "context.save",
  "context.correct",
  "context.forget",
  "case.create",
  "case.event",
]);

function preflight(action, payload) {
  if (!MUTATING_ACTIONS.has(action)) return { ok: true };
  const scan = scanForForbidden(payload);
  if (scan.forbidden) {
    // Fail-closed: never reflect the offending value in error, stdout or journal.
    return { ok: false, error: "forbidden personal data" };
  }
  return { ok: true };
}

async function run() {
  const raw = await readInput();
  const parsed = parseInput(raw);
  if (!parsed.ok) {
    print(failure("parse", parsed.error));
    return;
  }

  const { action, payload = {} } = parsed.data;
  if (!action || typeof action !== "string") {
    print(failure("parse", "action is required and must be a string"));
    return;
  }

  // R1-03: preflight forbidden for every mutation before creating the store or touching disk.
  const checked = preflight(action, payload);
  if (!checked.ok) {
    print(failure(action, checked.error));
    return;
  }

  const mod = createModule();
  const traceId = payload.traceId || `cli-${Date.now()}`;

  switch (action) {
    case "expense.create": {
      let parsedExpense;
      if (payload.text) {
        parsedExpense = parseExpenseCommand(payload.text);
        if ("missingData" in parsedExpense) {
          print(failure(action, `missing data: ${parsedExpense.missingData.join(", ")}`));
          return;
        }
      } else {
        parsedExpense = payload;
      }
      const result = await mod.createExpense({ ...parsedExpense, traceId });
      if (result.status === "created") {
        print(success(action, result.expense.id, true, { expense: result.expense, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || "unknown error"));
      }
      return;
    }

    case "expense.list": {
      const result = await mod.listExpenses(payload.limit);
      if (result.status === "success") {
        print({ ok: true, action, persisted: false, expenses: result.expenses });
      } else {
        print(failure(action, result.error || "unknown error"));
      }
      return;
    }

    case "expense.update": {
      const result = await mod.updateExpense(payload.id, payload, traceId);
      if (result.status === "updated") {
        print(success(action, result.expense.id, true, { expense: result.expense, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || "unknown error"));
      }
      return;
    }

    case "expense.reclassify": {
      const result = await mod.reclassifyExpense(payload.id, payload.scope, payload.entity, traceId);
      if (result.status === "updated") {
        print(success(action, result.expense.id, true, { expense: result.expense, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || "unknown error"));
      }
      return;
    }

    case "context.save": {
      const result = await mod.saveContext({
        key: payload.key,
        value: payload.value,
        kind: payload.kind || "durable",
        source: payload.source || "manual",
        consent: payload.consent,
        traceId,
      });
      if (result.status === "stored") {
        print(success(action, result.entry.id, true, { entry: result.entry, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || result.status));
      }
      return;
    }

    case "context.list": {
      const entries = await mod.listContext();
      print({ ok: true, action, persisted: false, entries });
      return;
    }

    case "context.correct": {
      const result = await mod.correctContext(payload.id, {
        key: payload.key,
        value: payload.value,
        kind: payload.kind || "durable",
        source: payload.source || "manual",
        consent: payload.consent,
        traceId,
      });
      if (result.status === "stored") {
        print(success(action, result.entry.id, true, { entry: result.entry, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || result.status));
      }
      return;
    }

    case "context.forget": {
      const result = await mod.forgetContext(payload.id, traceId);
      if (result.status === "forgotten") {
        print(success(action, payload.id, true, { traceId: result.traceId }));
      } else {
        print(failure(action, result.error || result.status));
      }
      return;
    }

    case "case.create": {
      const result = await mod.createCase({ name: payload.name, description: payload.description, traceId });
      if (result.status === "created") {
        print(success(action, result.case.id, true, { case: result.case, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || result.status));
      }
      return;
    }

    case "case.list": {
      const store = createPersonalAssistantFileStore({ dir: repoDir() });
      const cases = await store.listCases();
      print({ ok: true, action, persisted: false, cases });
      return;
    }

    case "case.events": {
      const store = createPersonalAssistantFileStore({ dir: repoDir() });
      const events = await store.listCaseEvents(payload.caseId);
      print({ ok: true, action, persisted: false, events });
      return;
    }

    case "case.event": {
      const result = await mod.addCaseEvent({
        caseId: payload.caseId,
        type: payload.type,
        content: payload.content,
        traceId,
      });
      if (result.status === "created") {
        print(success(action, result.event.id, true, { event: result.event, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || "unknown error"));
      }
      return;
    }

    case "summary": {
      const store = createPersonalAssistantFileStore({ dir: repoDir() });
      const [expenses, context, cases, events] = await Promise.all([
        mod.listExpenses(),
        mod.listContext(),
        store.listCases(),
        Promise.resolve([]),
      ]);
      const allCaseEvents = [];
      for (const c of cases) {
        const list = await store.listCaseEvents(c.id);
        allCaseEvents.push(...list);
      }
      print({
        ok: true,
        action,
        persisted: false,
        summary: {
          expenses: expenses.status === "success" ? expenses.expenses.length : 0,
          contextEntries: context.length,
          cases: cases.length,
          events: allCaseEvents.length,
        },
      });
      return;
    }

    default:
      print(failure(action, `unknown action: ${action}`));
  }
}

function print(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

run().catch((err) => {
  print(failure("cli", err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
});
