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

  it("detects notes module from nota: prefix", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-n1",
      messages: [{ id: 1, content: "nota: recordar que dormir poco me baja el foco", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
    expect(result.confidence).toBe(0.9);
    expect(result.missingData).toEqual([]);
  });

  it("detects notes module from guarda una nota:", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-n2",
      messages: [{ id: 1, content: "guarda una nota: revisar Barberox", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
    expect(result.confidence).toBe(0.9);
  });

  it("detects notes module from anota esto", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-n3",
      messages: [{ id: 1, content: "anota esto: hacer review", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
  });

  it("detects notes module from crea una nota", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-n4",
      messages: [{ id: 1, content: "crea una nota: probar el sistema", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
  });

  it("detects notes module from type prefix aprendizaje:", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-n5",
      messages: [{ id: 1, content: "aprendizaje: dormir bien mejora el foco", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
  });

  it("detects notes with already-normalized content after Chatwoot header removal", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-h1",
      messages: [{ id: 1, content: "nota: recordar que esta es la primera prueba real", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
    expect(result.confidence).toBe(0.9);
  });

  it("returns unknown for normal message", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-n6",
      messages: [{ id: 1, content: "hola como estas", createdAt: "now" }],
    });

    expect(result.module).toBe("unknown");
    expect(result.confidence).toBe(0.5);
  });

  it("detects notes module from que notas tengo", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-l1",
      messages: [{ id: 1, content: "que notas tengo", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
  });

  it("detects notes module from listar notas", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-l2",
      messages: [{ id: 1, content: "listar notas", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
  });

  it("detects notes module from ultimas notas", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-l3",
      messages: [{ id: 1, content: "ultimas notas", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
  });

  it("detects notes module from busca notas sobre foco", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-s1",
      messages: [{ id: 1, content: "busca notas sobre foco", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
  });

  it("detects notes module from notas sobre foco", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-s2",
      messages: [{ id: 1, content: "notas sobre foco", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
  });

  it("remains unknown for non-note natural language", async () => {
    const result = await classifier.classify({
      schemaVersion: "coarse_classification_input.v1",
      traceId: "trace-u1",
      messages: [{ id: 1, content: "cuentame un chiste", createdAt: "now" }],
    });

    expect(result.module).toBe("unknown");
  });
});
