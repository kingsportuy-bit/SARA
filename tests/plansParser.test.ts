import { describe, expect, it } from "vitest";
import { parsePlansInput } from "../src/modules/plans/plansParser.js";

describe("plansParser - create", () => {
  it("parses crear plan mejorar energia: caminar 20 minutos; dormir antes de 23", () => {
    const result = parsePlansInput("crear plan mejorar energia: caminar 20 minutos; dormir antes de 23");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("mejorar energia");
    expect(result.slug).toBe("mejorar-energia");
    expect(result.steps).toEqual(["caminar 20 minutos", "dormir antes de 23"]);
  });

  it("parses crear plan para objetivo mejorar energia: caminar; dormir", () => {
    const result = parsePlansInput("crear plan para objetivo mejorar energia: caminar; dormir");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("mejorar energia");
    expect(result.objectiveSlug).toBe("mejorar-energia");
    expect(result.steps).toEqual(["caminar", "dormir"]);
  });

  it("parses nuevo plan facturar mas: llamar clientes; actualizar precios", () => {
    const result = parsePlansInput("nuevo plan facturar mas: llamar clientes; actualizar precios");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("facturar mas");
    expect(result.slug).toBe("facturar-mas");
    expect(result.steps).toEqual(["llamar clientes", "actualizar precios"]);
  });

  it("parses crear plan mejorar energia: caminar 20 minutos", () => {
    const result = parsePlansInput("crear plan mejorar energia: caminar 20 minutos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.title).toBe("mejorar energia");
    expect(result.steps).toEqual(["caminar 20 minutos"]);
  });

  it("returns missing planSteps for create without steps", () => {
    const result = parsePlansInput("crear plan mejorar energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.missingData).toContain("planSteps");
  });

  it("returns missing planTitle for create without title", () => {
    const result = parsePlansInput("crear plan");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("planTitle");
  });

  it("generates slug deterministico ASCII-safe", () => {
    const result = parsePlansInput("crear plan atencion y foco: paso 1; paso 2");
    expect(result.success).toBe(true);
    expect(result.slug).toBe("atencion-y-foco");
  });
});

describe("plansParser - list", () => {
  it("parses que planes tengo", () => {
    const result = parsePlansInput("que planes tengo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses listar planes", () => {
    const result = parsePlansInput("listar planes");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses mis planes", () => {
    const result = parsePlansInput("mis planes");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses ver planes", () => {
    const result = parsePlansInput("ver planes");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });
});

describe("plansParser - archive", () => {
  it("parses archivar plan mejorar energia", () => {
    const result = parsePlansInput("archivar plan mejorar energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.planSlug).toBe("mejorar-energia");
  });

  it("parses archiva plan facturar mas", () => {
    const result = parsePlansInput("archiva plan facturar mas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.planSlug).toBe("facturar-mas");
  });

  it("returns missing plan for archive without title", () => {
    const result = parsePlansInput("archivar plan");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("plan");
  });
});

describe("plansParser - complete-step", () => {
  it("parses completar paso 1 del plan mejorar energia", () => {
    const result = parsePlansInput("completar paso 1 del plan mejorar energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("complete-step");
    expect(result.planSlug).toBe("mejorar-energia");
    expect(result.stepPosition).toBe(1);
  });

  it("parses completar paso 2 del plan facturar mas", () => {
    const result = parsePlansInput("completar paso 2 del plan facturar mas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("complete-step");
    expect(result.planSlug).toBe("facturar-mas");
    expect(result.stepPosition).toBe(2);
  });

  it("parses marcar paso 3 del plan mejorar energia", () => {
    const result = parsePlansInput("marcar paso 3 del plan mejorar energia");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("complete-step");
    expect(result.planSlug).toBe("mejorar-energia");
    expect(result.stepPosition).toBe(3);
  });

  it("parses paso 1 del plan mejorar energia completado", () => {
    const result = parsePlansInput("paso 1 del plan mejorar energia completado");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("complete-step");
    expect(result.planSlug).toBe("mejorar-energia");
    expect(result.stepPosition).toBe(1);
  });

  it("returns missing plan/stepPosition for complete step without data", () => {
    const result = parsePlansInput("completar paso");
    expect(result.success).toBe(false);
    expect(result.missingData).toEqual(expect.arrayContaining(["plan", "stepPosition"]));
  });
});
