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

  it("preserves module from input in result when no intent detected", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-2",
      module: "daily-log",
      messages: [{ id: 2, content: "como estoy hoy", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.module).toBe("daily-log");
    expect(result.action).toBe("none");
  });
});

describe("moduleIntentClassifier notes.create detection", () => {
  it("detects nota: prefix and extracts content", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n1",
      module: "notes",
      messages: [{ id: 1, content: "nota: recordar que dormir poco me baja mucho el foco", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.module).toBe("notes");
    expect(result.action).toBe("create");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
    expect(result.entities).toHaveProperty("content", "recordar que dormir poco me baja mucho el foco");
    expect(result.requiresConfirmation).toBe(false);
  });

  it("detects guarda una nota prefix", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n2",
      module: "notes",
      messages: [{ id: 1, content: "guarda una nota: revisar el protocolo de Barberox", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
  });

  it("detects anota esto as prefix", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n3",
      module: "notes",
      messages: [{ id: 1, content: "anota esto como idea: crear una rutina semanal de revision", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("create");
    expect(result.entities).toHaveProperty("content");
    expect(result.missingData).toEqual([]);
  });

  it("returns missingData when prefix has no content", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n4",
      module: "notes",
      messages: [{ id: 1, content: "nota:", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("content");
  });

  it("does not detect notes.create for non-notes modules", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n5",
      module: "unknown",
      messages: [{ id: 1, content: "nota: esto es importante", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("none");
    expect(result.confidence).toBe(0.1);
  });

  it("does not detect notes.create for daily-log module", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n6",
      module: "daily-log",
      messages: [{ id: 1, content: "nota: esto no deberia activar", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("none");
  });

  it("does no false positive on non-note messages in notes module", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n7",
      module: "notes",
      messages: [{ id: 1, content: "hola que tal", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("none");
    expect(result.confidence).toBe(0.1);
  });
});
