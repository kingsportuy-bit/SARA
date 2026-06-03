import { describe, expect, it } from "vitest";
import { createMessageNormalizer } from "../src/modules/messageNormalizer.js";

const normalizer = createMessageNormalizer();

describe("messageNormalizer", () => {
  it("removes Chatwoot group header at the start", () => {
    const result = normalizer.normalize([
      { id: 1, content: "**+598 91 608 727 - Fabian:**\nnota: recordar esta prueba", createdAt: "2026-06-03T00:00:00Z" },
    ]);
    expect(result[0].content).toBe("nota: recordar esta prueba");
    expect(result[0].normalization.removedChatwootGroupHeader).toBe(true);
  });

  it("preserves originalContent unchanged", () => {
    const original = "**+598 91 608 727 - Fabian:**\nnota: recordar esta prueba";
    const result = normalizer.normalize([
      { id: 1, content: original, createdAt: "2026-06-03T00:00:00Z" },
    ]);
    expect(result[0].originalContent).toBe(original);
  });

  it("does not remove content that is not a group header", () => {
    const result = normalizer.normalize([
      { id: 1, content: "nota: recordar que dormir poco me baja el foco", createdAt: "2026-06-03T00:00:00Z" },
    ]);
    expect(result[0].content).toBe("nota: recordar que dormir poco me baja el foco");
    expect(result[0].normalization.removedChatwootGroupHeader).toBe(false);
  });

  it("does not remove bold text that is not at the start", () => {
    const result = normalizer.normalize([
      { id: 1, content: "esto es **importante** y normal", createdAt: "2026-06-03T00:00:00Z" },
    ]);
    expect(result[0].content).toBe("esto es **importante** y normal");
    expect(result[0].normalization.removedChatwootGroupHeader).toBe(false);
  });

  it("does not remove bold text at the start when it is not a Chatwoot group header", () => {
    const result = normalizer.normalize([
      { id: 1, content: "**idea:** mejorar la rutina semanal", createdAt: "2026-06-03T00:00:00Z" },
    ]);
    expect(result[0].content).toBe("**idea:** mejorar la rutina semanal");
    expect(result[0].normalization.removedChatwootGroupHeader).toBe(false);
  });

  it("normalizes multiple messages preserving id mapping", () => {
    const result = normalizer.normalize([
      { id: 1, content: "**+598 91 608 727 - Fabian:**\nnota: primera", createdAt: "2026-06-03T00:00:00Z" },
      { id: 2, content: "nota: segunda", createdAt: "2026-06-03T00:00:01Z" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[0].content).toBe("nota: primera");
    expect(result[0].normalization.removedChatwootGroupHeader).toBe(true);
    expect(result[1].id).toBe("2");
    expect(result[1].content).toBe("nota: segunda");
    expect(result[1].normalization.removedChatwootGroupHeader).toBe(false);
  });

  it("returns empty content for header-only message", () => {
    const result = normalizer.normalize([
      { id: 1, content: "**+598 91 608 727 - Fabian:**", createdAt: "2026-06-03T00:00:00Z" },
    ]);
    expect(result[0].content).toBe("");
    expect(result[0].normalization.removedChatwootGroupHeader).toBe(true);
  });

  it("preserves createdAt intact", () => {
    const result = normalizer.normalize([
      { id: 1, content: "hola", createdAt: "2026-06-03T12:34:56Z" },
    ]);
    expect(result[0].createdAt).toBe("2026-06-03T12:34:56Z");
  });

  it("returns empty array for empty input", () => {
    const result = normalizer.normalize([]);
    expect(result).toEqual([]);
  });

  it("removes Chatwoot header with multiline gap", () => {
    const result = normalizer.normalize([
      { id: 1, content: "**+598 91 608 727 - Fabian:**\n\n\nnota: tercera prueba real", createdAt: "2026-06-03T00:00:00Z" },
    ]);
    expect(result[0].content).toBe("nota: tercera prueba real");
    expect(result[0].normalization.removedChatwootGroupHeader).toBe(true);
  });
});
