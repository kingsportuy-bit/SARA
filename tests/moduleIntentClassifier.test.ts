import { describe, expect, it } from "vitest";
import { createModuleIntentClassifier } from "../src/modules/moduleIntentClassifier.js";

const classifier = createModuleIntentClassifier();

describe("moduleIntentClassifier", () => {
  it("returns none action with missingData for unknown module", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-1",
      module: "unknown",
      messages: [{ id: 1, content: "hola", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.schemaVersion).toBe("module_intent_result.v1");
    expect(result.traceId).toBe("trace-1");
    expect(result.module).toBe("unknown");
    expect(result.action).toBe("none");
    expect(result.confidence).toBe(0.1);
    expect(result.entities).toEqual({});
    expect(result.missingData).toContain("intent classification not implemented");
    expect(result.requiresConfirmation).toBe(false);
    expect(result.reasoningSummary).toBeDefined();
  });

  it("preserves module from input in result", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-2",
      module: "notes",
      messages: [{ id: 2, content: "nota de prueba", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.module).toBe("notes");
  });
});
