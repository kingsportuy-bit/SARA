import { describe, expect, it } from "vitest";
import { parseObjectivesInput } from "../src/modules/objectives/objectivesParser.js";

describe("objectivesParser - create", () => {
  it("parses crear objetivo mejorar mi energia", () => {
    const result = parseObjectivesInput("crear objetivo mejorar mi energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("mejorar mi energia");
    expect(result.slug).toBe("mejorar-mi-energia");
  });

  it("parses crear objetivo mejorar mi energia area salud", () => {
    const result = parseObjectivesInput("crear objetivo mejorar mi energia area salud");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("mejorar mi energia");
    expect(result.slug).toBe("mejorar-mi-energia");
    expect(result.areaSlug).toBe("salud");
  });

  it("parses nuevo objetivo facturar mas", () => {
    const result = parseObjectivesInput("nuevo objetivo facturar mas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("facturar mas");
    expect(result.slug).toBe("facturar-mas");
  });

  it("parses agregar objetivo leer mas", () => {
    const result = parseObjectivesInput("agregar objetivo leer mas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("leer mas");
  });

  it("parses crear objetivo con criterios", () => {
    const result = parseObjectivesInput("crear objetivo mejorar mi energia criterios: dormir 8 horas, hacer ejercicio");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("mejorar mi energia");
    expect(result.successCriteria).toEqual(["dormir 8 horas", "hacer ejercicio"]);
  });

  it("parses crear objetivo con fecha target", () => {
    const result = parseObjectivesInput("crear objetivo facturar mas para 2026-12-31");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("facturar mas");
    expect(result.targetDate).toBe("2026-12-31");
  });

  it("returns missing objectiveTitle for create without title", () => {
    const result = parseObjectivesInput("crear objetivo");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("objectiveTitle");
  });

  it("generates slug deterministico ASCII-safe", () => {
    const result = parseObjectivesInput("crear objetivo atencion y foco");
    expect(result.success).toBe(true);
    expect(result.slug).toBe("atencion-y-foco");
  });
});

describe("objectivesParser - list", () => {
  it("parses que objetivos tengo", () => {
    const result = parseObjectivesInput("que objetivos tengo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses listar objetivos", () => {
    const result = parseObjectivesInput("listar objetivos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses mis objetivos", () => {
    const result = parseObjectivesInput("mis objetivos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses ver objetivos", () => {
    const result = parseObjectivesInput("ver objetivos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });
});

describe("objectivesParser - achieve", () => {
  it("parses marcar objetivo mejorar mi energia como logrado", () => {
    const result = parseObjectivesInput("marcar objetivo mejorar mi energia como logrado");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("achieve");
    expect(result.objectiveSlug).toBe("mejorar-mi-energia");
  });

  it("parses logre objetivo mejorar mi energia", () => {
    const result = parseObjectivesInput("logre objetivo mejorar mi energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("achieve");
    expect(result.objectiveSlug).toBe("mejorar-mi-energia");
  });

  it("parses logré mejorar mi energia como logrado", () => {
    const result = parseObjectivesInput("logré mejorar mi energia como logrado");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("achieve");
    expect(result.objectiveSlug).toBe("mejorar-mi-energia");
  });

  it("parses conseguí objetivo mejorar mi energia", () => {
    const result = parseObjectivesInput("conseguí objetivo mejorar mi energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("achieve");
    expect(result.objectiveSlug).toBe("mejorar-mi-energia");
  });

  it("returns missing objective for achieve without title", () => {
    const result = parseObjectivesInput("logré objetivo");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("objective");
  });
});

describe("objectivesParser - archive", () => {
  it("parses archivar objetivo mejorar mi energia", () => {
    const result = parseObjectivesInput("archivar objetivo mejorar mi energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.objectiveSlug).toBe("mejorar-mi-energia");
  });

  it("parses archiva objetivo facturar mas", () => {
    const result = parseObjectivesInput("archiva objetivo facturar mas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.objectiveSlug).toBe("facturar-mas");
  });

  it("returns missing objective for archive without title", () => {
    const result = parseObjectivesInput("archivar objetivo");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("objective");
  });
});

describe("objectivesParser - assign-task", () => {
  it("parses asociar esa tarea al objetivo mejorar mi energia", () => {
    const result = parseObjectivesInput("asociar esa tarea al objetivo mejorar mi energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-task");
    expect(result.objectiveSlug).toBe("mejorar-mi-energia");
  });

  it("parses asignar ultima tarea al objetivo mejorar mi energia", () => {
    const result = parseObjectivesInput("asignar ultima tarea al objetivo mejorar mi energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-task");
    expect(result.objectiveSlug).toBe("mejorar-mi-energia");
  });

  it("parses vincular tarea al objetivo facturar mas", () => {
    const result = parseObjectivesInput("vincular tarea al objetivo facturar mas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("assign-task");
    expect(result.objectiveSlug).toBe("facturar-mas");
  });

  it("returns missing objective for assign without objective", () => {
    const result = parseObjectivesInput("asociar esa tarea al objetivo");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("objective");
  });
});
