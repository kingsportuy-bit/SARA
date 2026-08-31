#!/usr/bin/env node
// scripts/sara-personal.mjs — JSON CLI para SARA Personal (local, sin red).
// Uso:
//   node scripts/sara-personal.mjs '{"action":"expense.create","payload":{"text":"gasto personal UYU 200 cafe","traceId":"t1"}}'
//   echo '{"action":"summary"}' | node scripts/sara-personal.mjs
// Env: SARA_PERSONAL_DIR (default: ./data/personal)

import { createPersonalAssistantFileStore } from "../dist/infra/personalAssistantFileStore.js";
import { createPersonalAssistantModule } from "../dist/modules/personalAssistant/personalAssistantModule.js";
import { parseExpenseCommand } from "../dist/modules/personalAssistant/personalAssistantParser.js";

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
    return { ok: false, error: `invalid JSON: ${err.message}` };
  }
}

function success(action, id, persisted, data = {}) {
  return { ok: true, action, id, persisted, ...data };
}

function failure(action, error, persisted = false) {
  return { ok: false, action, persisted, error };
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

  const mod = createModule();

  switch (action) {
    case "expense.create": {
      const traceId = payload.traceId || `cli-${Date.now()}`;
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

    case "context.save": {
      const traceId = payload.traceId || `cli-${Date.now()}`;
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

    case "context.forget": {
      const traceId = payload.traceId || `cli-${Date.now()}`;
      const result = await mod.forgetContext(payload.id, traceId);
      if (result.status === "forgotten") {
        print(success(action, payload.id, true, { traceId: result.traceId }));
      } else {
        print(failure(action, result.error || result.status));
      }
      return;
    }

    case "case.create": {
      const traceId = payload.traceId || `cli-${Date.now()}`;
      const result = await mod.createCase({ name: payload.name, description: payload.description, traceId });
      if (result.status === "created") {
        print(success(action, result.case.id, true, { case: result.case, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || result.status));
      }
      return;
    }

    case "case.event": {
      const traceId = payload.traceId || `cli-${Date.now()}`;
      const result = await mod.addCaseEvent({
        caseId: payload.caseId,
        type: payload.type,
        content: payload.content,
        traceId,
      });
      if (result.status === "created") {
        print(success(action, result.event.id, true, { event: result.event, traceId: result.traceId }));
      } else {
        print(failure(action, result.error || result.status));
      }
      return;
    }

    case "summary": {
      const store = createPersonalAssistantFileStore({ dir: repoDir() });
      const [expenses, context, cases, events] = await Promise.all([
        mod.listExpenses(),
        mod.listContext(),
        store.listCases(),
        store.listCaseEvents ? [] : [],
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
