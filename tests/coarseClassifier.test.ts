import { describe, expect, it } from "vitest";
import { createCoarseClassifier } from "../src/modules/coarseClassifier.js";

const classifier = createCoarseClassifier();

describe("coarseClassifier", () => {
  it("returns unknown module with schema version v1", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-1",
      messages: [{ id: 1, content: "hola", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.schemaVersion).toBe("coarse_classification_result.v1");
    expect(result.traceId).toBe("trace-1");
    expect(result.module).toBe("unknown");
    expect(result.confidence).toBe(0.5);
    expect(result.missingData).toEqual([]);
    expect(result.reasoningSummary).toBeDefined();
  });

  it("preserves traceId from input", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "custom-trace",
      messages: [],
    });

    expect(result.traceId).toBe("custom-trace");
  });

  it("accepts sessionContext without crashing", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-ctx",
      messages: [{ id: 2, content: "test", createdAt: "2026-06-02T00:00:00Z" }],
      sessionContext: {
        activeModule: "notes",
        awaitingConfirmation: true,
      },
    });

    expect(result.module).toBe("unknown");
    expect(result.confidence).toBe(0.5);
  });
});
