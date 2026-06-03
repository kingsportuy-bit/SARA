import { describe, expect, it } from "vitest";
import { parseAreasInput } from "../src/modules/areas/areasParser.js";

describe("areasParser - create", () => {
  it("parses crear area salud", () => {
    const result = parseAreasInput("crear area salud");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("salud");
    expect(result.slug).toBe("salud");
  });

  it("parses nueva area trabajo", () => {
    const result = parseAreasInput("nueva area trabajo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("trabajo");
    expect(result.slug).toBe("trabajo");
  });

  it("parses agregar area salud fitness", () => {
    const result = parseAreasInput("agregar area salud fitness");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("salud fitness");
    expect(result.slug).toBe("salud-fitness");
  });

  it("creates slug from accented name", () => {
    const result = parseAreasInput("crear area atencion");
    expect(result.success).toBe(true);
    expect(result.slug).toBe("atencion");
  });

  it("returns missing areaName for empty name", () => {
    const result = parseAreasInput("crear area");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("areaName");
  });
});

describe("areasParser - list", () => {
  it("parses que areas tengo", () => {
    const result = parseAreasInput("que areas tengo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses listar areas", () => {
    const result = parseAreasInput("listar areas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses mis areas", () => {
    const result = parseAreasInput("mis areas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses ver areas", () => {
    const result = parseAreasInput("ver areas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });
});

describe("areasParser - archive", () => {
  it("parses archivar area salud", () => {
    const result = parseAreasInput("archivar area salud");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.areaSlug).toBe("salud");
  });

  it("parses archiva area trabajo", () => {
    const result = parseAreasInput("archiva area trabajo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.areaSlug).toBe("trabajo");
  });

  it("returns missing area for empty archive", () => {
    const result = parseAreasInput("archivar area");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("area");
  });
});

describe("areasParser - assign note", () => {
  it("parses asociar esa nota al area salud", () => {
    const result = parseAreasInput("asociar esa nota al area salud");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-note");
    expect(result.entityType).toBe("note");
    expect(result.areaSlug).toBe("salud");
  });

  it("parses asignar esa nota al area aprendizaje", () => {
    const result = parseAreasInput("asignar esa nota al area aprendizaje");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-note");
    expect(result.areaSlug).toBe("aprendizaje");
  });

  it("parses mover esa nota al area trabajo", () => {
    const result = parseAreasInput("mover esa nota al area trabajo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-note");
    expect(result.areaSlug).toBe("trabajo");
  });
});

describe("areasParser - assign task", () => {
  it("parses asociar esa tarea al area salud", () => {
    const result = parseAreasInput("asociar esa tarea al area salud");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-task");
    expect(result.entityType).toBe("task");
    expect(result.areaSlug).toBe("salud");
  });

  it("parses asignar ultima tarea a salud", () => {
    const result = parseAreasInput("asignar ultima tarea a salud");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-task");
    expect(result.areaSlug).toBe("salud");
  });

  it("parses asignar la ultima tarea al area trabajo", () => {
    const result = parseAreasInput("asignar la ultima tarea al area trabajo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-task");
    expect(result.areaSlug).toBe("trabajo");
  });

  it("parses asociar ultima tarea al area fitness", () => {
    const result = parseAreasInput("asociar ultima tarea al area fitness");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-task");
    expect(result.areaSlug).toBe("fitness");
  });
});
