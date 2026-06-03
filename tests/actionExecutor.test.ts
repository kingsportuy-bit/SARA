import { describe, expect, it, vi } from "vitest";
import { createActionExecutor, intentConfidenceSufficient } from "../src/modules/actionExecutor.js";
import type { ActionExecutionInput, ActionExecutionResult, ModuleIntentResult } from "../src/contracts/pipeline.js";

const executor = createActionExecutor();

function execInput(overrides?: Partial<ActionExecutionInput>): ActionExecutionInput {
  return {
    schemaVersion: "action_execution_input.v1",
    traceId: "trace-1",
    module: "notes",
    action: "create",
    entities: {},
    requiresConfirmation: false,
    ...overrides,
  };
}

describe("actionExecutor", () => {
  it("returns skipped when no domain modules registered", async () => {
    const result = await executor.execute(execInput());

    expect(result.schemaVersion).toBe("action_execution_result.v1");
    expect(result.traceId).toBe("trace-1");
    expect(result.status).toBe("skipped");
    expect(result.evidence).toHaveProperty("reason");
    expect(result.stateChanges).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it("returns needs_confirmation when requiresConfirmation is true", async () => {
    const result = await executor.execute(execInput({ requiresConfirmation: true }));

    expect(result.status).toBe("needs_confirmation");
    expect(result.evidence).toEqual({ reason: "Confirmation required before execution." });
  });

  it("returns skipped when requiresConfirmation is false", async () => {
    const result = await executor.execute(execInput({ requiresConfirmation: false }));

    expect(result.status).toBe("skipped");
  });

  it("preserves traceId in result", async () => {
    const result = await executor.execute(execInput({ traceId: "custom-trace" }));

    expect(result.traceId).toBe("custom-trace");
  });
});

describe("actionExecutor with notes handler", () => {
  it("dispatches to notes.create handler and returns its result", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { noteId: "n1", eventId: "e1" },
      stateChanges: [{ entityType: "note", entityId: "n1", eventType: "note_created", payload: {} }],
    }));

    const exec = createActionExecutor({ notes: { create: handler } });
    const result = await exec.execute(execInput({
      entities: { content: "nota de prueba", noteType: "observacion" },
      intentConfidence: 0.9,
      intentMissingData: [],
    }));

    expect(result.status).toBe("executed");
    expect(result.evidence).toEqual({ noteId: "n1", eventId: "e1" });
    expect(result.stateChanges).toHaveLength(1);
    expect(result.stateChanges[0].eventType).toBe("note_created");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns skipped for unregistered action within a registered module", async () => {
    const handler = vi.fn(async () => ({
      schemaVersion: "action_execution_result.v1" as const,
      traceId: "",
      status: "executed" as const,
      evidence: {},
      stateChanges: [],
    }));

    const exec = createActionExecutor({ notes: { create: handler } });
    const result = await exec.execute(execInput({ action: "delete" }));

    expect(result.status).toBe("skipped");
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not dispatch when requiresConfirmation is true even with handler", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({ requiresConfirmation: true }));

    expect(result.status).toBe("needs_confirmation");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when content is missing", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: {},
      intentConfidence: 0.9,
      intentMissingData: [],
    }));

    expect(result.status).toBe("failed");
    expect(result.error).toContain("content is required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when content is empty string", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: { content: "" },
      intentConfidence: 0.9,
      intentMissingData: [],
    }));

    expect(result.status).toBe("failed");
    expect(result.error).toContain("content is required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when content is whitespace only", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: { content: "   " },
      intentConfidence: 0.9,
      intentMissingData: [],
    }));

    expect(result.status).toBe("failed");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when content is not a string", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: { content: 123 },
      intentConfidence: 0.9,
      intentMissingData: [],
    }));

    expect(result.status).toBe("failed");
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not block non-notes modules even with empty content", async () => {
    const handler = vi.fn(async (input) => ({
      schemaVersion: "action_execution_result.v1" as const,
      traceId: input.traceId,
      status: "executed" as const,
      evidence: {},
      stateChanges: [],
    }));
    const exec = createActionExecutor({ "daily-log": { checkin: handler } });

    const result = await exec.execute(execInput({ module: "daily-log", action: "checkin", entities: {} }));

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("blocks notes.create when intentConfidence is undefined", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: { content: "nota content" },
    }));

    expect(result.status).toBe("failed");
    expect(result.error).toContain("confidence insufficient");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when intentConfidence is below 0.75", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: { content: "nota content" },
      intentConfidence: 0.5,
      intentMissingData: [],
    }));

    expect(result.status).toBe("failed");
    expect(result.error).toContain("confidence insufficient");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when intentMissingData is not empty", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: { content: "nota content" },
      intentConfidence: 0.9,
      intentMissingData: ["content"],
    }));

    expect(result.status).toBe("failed");
    expect(result.error).toContain("missing data prevents");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when intentMissingData is undefined", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: { content: "nota content" },
      intentConfidence: 0.9,
    }));

    expect(result.status).toBe("failed");
    expect(result.error).toContain("missing data prevents");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when intentMissingData is not an array", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ notes: { create: handler } });

    const result = await exec.execute(execInput({
      entities: { content: "nota content" },
      intentConfidence: 0.9,
      intentMissingData: "invalid" as any,
    }));

    expect(result.status).toBe("failed");
    expect(result.error).toContain("missing data prevents");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks notes.create when confidence 0.75 exactly passes", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { noteId: "n1", eventId: "e1" },
      stateChanges: [],
    }));

    const exec = createActionExecutor({ notes: { create: handler } });
    const result = await exec.execute(execInput({
      entities: { content: "nota content" },
      intentConfidence: 0.75,
      intentMissingData: [],
    }));

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("dispatches to notes.list handler without create-only guards", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { notes: [], count: 0 },
      stateChanges: [],
    }));

    const exec = createActionExecutor({ notes: { list: handler } });
    const result = await exec.execute(execInput({
      action: "list",
      entities: {},
      intentConfidence: 0.85,
      intentMissingData: [],
    }));

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("dispatches to notes.search handler without create-only guards", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { notes: [], count: 0, query: "test" },
      stateChanges: [],
    }));

    const exec = createActionExecutor({ notes: { search: handler } });
    const result = await exec.execute(execInput({
      action: "search",
      entities: { query: "test" },
      intentConfidence: 0.85,
      intentMissingData: [],
    }));

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("actionExecutor with tasks handlers", () => {
  it("dispatches to tasks.create handler and returns its result", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { taskId: "t1", eventId: "e1", title: "test" },
      stateChanges: [{ entityType: "task", entityId: "t1", eventType: "task_created", payload: {} }],
    }));

    const exec = createActionExecutor({ tasks: { create: handler } });
    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-t1",
      module: "tasks",
      action: "create",
      entities: { title: "mi tarea" },
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("executed");
    expect(result.evidence).toEqual({ taskId: "t1", eventId: "e1", title: "test" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("blocks tasks.create when title is missing", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ tasks: { create: handler } });

    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-t2",
      module: "tasks",
      action: "create",
      entities: {},
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title is required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks tasks.create when confidence is low", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ tasks: { create: handler } });

    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-t3",
      module: "tasks",
      action: "create",
      entities: { title: "test" },
      requiresConfirmation: false,
      intentConfidence: 0.5,
      intentMissingData: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("confidence insufficient");
    expect(handler).not.toHaveBeenCalled();
  });

  it("dispatches to tasks.list handler", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { tasks: [], count: 0 },
      stateChanges: [],
    }));

    const exec = createActionExecutor({ tasks: { list: handler } });
    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-t4",
      module: "tasks",
      action: "list",
      entities: {},
      requiresConfirmation: false,
      intentConfidence: 0.85,
      intentMissingData: [],
    });

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("dispatches to tasks.complete handler", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { taskId: "t1", eventId: "e1", title: "test" },
      stateChanges: [{ entityType: "task", entityId: "t1", eventType: "task_completed", payload: {} }],
    }));

    const exec = createActionExecutor({ tasks: { complete: handler } });
    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-t5",
      module: "tasks",
      action: "complete",
      entities: { taskId: "t1" },
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("blocks tasks.complete without any identifier in entities", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ tasks: { complete: handler } });

    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-t6",
      module: "tasks",
      action: "complete",
      entities: {},
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("required");
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("actionExecutor with daily-log handler", () => {
  it("dispatches to daily-log.morning handler with valid energy", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { dailyLogId: "dl1", eventId: "e1", date: "2026-06-03" },
      stateChanges: [{ entityType: "daily_log", entityId: "dl1", eventType: "daily_log_morning_updated", payload: {} }],
    }));

    const exec = createActionExecutor({ "daily-log": { morning: handler } });
    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-dl1",
      module: "daily-log",
      action: "morning",
      entities: { wakeEnergy: 7, date: "2026-06-03" },
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("blocks daily-log.morning when energy is out of range", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ "daily-log": { morning: handler } });

    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-dl2",
      module: "daily-log",
      action: "morning",
      entities: { wakeEnergy: 0, date: "2026-06-03" },
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("wakeEnergy must be between 1 and 10");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks daily-log.morning when confidence is low", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ "daily-log": { morning: handler } });

    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-dl-low-confidence",
      module: "daily-log",
      action: "morning",
      entities: { wakeEnergy: 7, date: "2026-06-03" },
      requiresConfirmation: false,
      intentConfidence: 0.4,
      intentMissingData: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("confidence insufficient");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks daily-log.morning when no fields are provided", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ "daily-log": { morning: handler } });

    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-dl3",
      module: "daily-log",
      action: "morning",
      entities: { date: "2026-06-03" },
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("failed");
    expect(handler).not.toHaveBeenCalled();
  });

  it("dispatches daily-log.morning with notes only", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { dailyLogId: "dl-notes", eventId: "e-notes", date: "2026-06-03" },
      stateChanges: [],
    }));
    const exec = createActionExecutor({ "daily-log": { morning: handler } });

    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-dl-notes",
      module: "daily-log",
      action: "morning",
      entities: { notes: ["arranque tranquilo"], date: "2026-06-03" },
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("blocks daily-log.evening when no fields are provided", async () => {
    const handler = vi.fn();
    const exec = createActionExecutor({ "daily-log": { evening: handler } });

    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-dl4",
      module: "daily-log",
      action: "evening",
      entities: { date: "2026-06-03" },
      requiresConfirmation: false,
      intentConfidence: 0.9,
      intentMissingData: [],
    });

    expect(result.status).toBe("failed");
    expect(handler).not.toHaveBeenCalled();
  });

  it("dispatches to daily-log.summary handler", async () => {
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { dailyLog: { wakeEnergy: 7, sleepHours: 6.5 }, dailyLogId: "dl1", date: "2026-06-03" },
      stateChanges: [],
    }));

    const exec = createActionExecutor({ "daily-log": { summary: handler } });
    const result = await exec.execute({
      schemaVersion: "action_execution_input.v1",
      traceId: "trace-dl5",
      module: "daily-log",
      action: "summary",
      entities: { date: "2026-06-03" },
      requiresConfirmation: false,
      intentConfidence: 0.85,
      intentMissingData: [],
    });

    expect(result.status).toBe("executed");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("intentConfidenceSufficient", () => {
  function makeIntent(overrides?: Partial<ModuleIntentResult>): ModuleIntentResult {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: "t1",
      module: "notes",
      action: "create",
      confidence: 0.9,
      entities: {},
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "",
      ...overrides,
    };
  }

  it("returns true when confidence >= 0.75 and no missing data", () => {
    expect(intentConfidenceSufficient(makeIntent({ confidence: 0.75 }))).toBe(true);
    expect(intentConfidenceSufficient(makeIntent({ confidence: 0.9 }))).toBe(true);
  });

  it("returns false when confidence < 0.75", () => {
    expect(intentConfidenceSufficient(makeIntent({ confidence: 0.74 }))).toBe(false);
    expect(intentConfidenceSufficient(makeIntent({ confidence: 0.1 }))).toBe(false);
  });

  it("returns false when missingData is not empty", () => {
    expect(intentConfidenceSufficient(makeIntent({ missingData: ["field x"] }))).toBe(false);
  });

  it("returns false when both confidence low and missingData present", () => {
    expect(intentConfidenceSufficient(makeIntent({ confidence: 0.5, missingData: ["a"] }))).toBe(false);
  });
});
