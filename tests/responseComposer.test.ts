import { describe, expect, it } from "vitest";
import { createResponseComposer } from "../src/modules/responseComposer.js";
import type { ResponseCompositionInput } from "../src/contracts/pipeline.js";

const composer = createResponseComposer();

const baseInput: ResponseCompositionInput = {
  schemaVersion: "response_composition_input.v1",
  traceId: "trace-1",
  messages: [{ id: 1, content: "hola", createdAt: "2026-06-02T00:00:00Z" }],
  classification: {
    coarse: {
      schemaVersion: "coarse_classification_result.v1",
      traceId: "trace-1",
      module: "unknown",
      confidence: 0.5,
      missingData: [],
      reasoningSummary: "Skeleton classifier.",
    },
    intent: {
      schemaVersion: "module_intent_result.v1",
      traceId: "trace-1",
      module: "unknown",
      action: "none",
      confidence: 0.1,
      entities: {},
      missingData: ["intent classification not implemented"],
      requiresConfirmation: false,
      reasoningSummary: "Skeleton classifier.",
    },
  },
  actionResult: {
    schemaVersion: "action_execution_result.v1",
    traceId: "trace-1",
    status: "skipped",
    evidence: { reason: "No domain modules." },
    stateChanges: [],
  },
};

describe("responseComposer", () => {
  it("returns schema version v1 with traceId", async () => {
    const result = await composer.compose(baseInput);

    expect(result.schemaVersion).toBe("response_composition_result.v1");
    expect(result.traceId).toBe("trace-1");
  });

  it("reports missing data when intent has missingData", async () => {
    const result = await composer.compose(baseInput);

    expect(result.content).toContain("No tengo suficiente informacion");
    expect(result.evidenceUsed).toHaveProperty("classification");
    expect(result.evidenceUsed).toHaveProperty("actionStatus");
  });

  it("reports low confidence when coarse confidence < 0.75", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.4 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("No estoy segura");
  });

  it("reports needs_confirmation status", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "needs_confirmation",
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("confirmacion explicita");
  });

  it("reports skipped status", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "skipped",
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("modulo solicitado aun no esta disponible");
  });

  it("reports executed status", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Accion ejecutada");
  });

  it("reports failed status with error message", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "failed",
        error: "DB connection lost",
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("DB connection lost");
  });
});
