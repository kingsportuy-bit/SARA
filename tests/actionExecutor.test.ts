import { describe, expect, it } from "vitest";
import { createActionExecutor, intentConfidenceSufficient } from "../src/modules/actionExecutor.js";
import type { ActionExecutionInput, ModuleIntentResult } from "../src/contracts/pipeline.js";

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
