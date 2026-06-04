import { describe, expect, it } from "vitest";
import { parseProgressInput } from "../src/modules/progress/progressParser.js";

describe("progressParser - workout progress", () => {
  it("detects 'como vengo con sentadilla'", () => {
    const result = parseProgressInput("como vengo con sentadilla");
    expect(result.intent).toBe("workout");
    expect(result.exerciseName).toBe("sentadilla");
    expect(result.success).toBe(true);
  });

  it("detects 'progreso sentadilla'", () => {
    const result = parseProgressInput("progreso sentadilla");
    expect(result.intent).toBe("workout");
    expect(result.exerciseName).toBe("sentadilla");
    expect(result.success).toBe(true);
  });

  it("detects 'como voy con press banca'", () => {
    const result = parseProgressInput("como voy con press banca");
    expect(result.intent).toBe("workout");
    expect(result.exerciseName).toBe("press banca");
    expect(result.success).toBe(true);
  });

  it("detects 'progreso de ejercicio peso muerto'", () => {
    const result = parseProgressInput("progreso de ejercicio peso muerto");
    expect(result.intent).toBe("workout");
    expect(result.exerciseName).toBe("peso muerto");
    expect(result.success).toBe(true);
  });

  it("detects 'ver progreso de dominadas'", () => {
    const result = parseProgressInput("ver progreso de dominadas");
    expect(result.intent).toBe("workout");
    expect(result.exerciseName).toBe("dominadas");
    expect(result.success).toBe(true);
  });

  it("detects 'como va la sentadilla'", () => {
    const result = parseProgressInput("como va la sentadilla");
    expect(result.intent).toBe("workout");
    expect(result.exerciseName).toBe("sentadilla");
    expect(result.success).toBe(true);
  });
});

describe("progressParser - objective progress", () => {
  it("detects 'progreso objetivo mejorar energia'", () => {
    const result = parseProgressInput("progreso objetivo mejorar energia");
    expect(result.intent).toBe("objective");
    expect(result.objectiveSlug).toBe("mejorar-energia");
    expect(result.success).toBe(true);
  });

  it("detects 'como voy con mi energia' as objective bare", () => {
    const result = parseProgressInput("como voy con mi energia");
    expect(result.intent).toBe("objective");
    expect(result.objectiveSlug).toBe("energia");
    expect(result.success).toBe(true);
  });

  it("detects 'como voy con el objetivo facturar mas'", () => {
    const result = parseProgressInput("como voy con el objetivo facturar mas");
    expect(result.intent).toBe("objective");
    expect(result.objectiveSlug).toBe("facturar-mas");
    expect(result.success).toBe(true);
  });

  it("detects 'ver progreso del objetivo bajar de peso'", () => {
    const result = parseProgressInput("ver progreso del objetivo bajar de peso");
    expect(result.intent).toBe("objective");
    expect(result.objectiveSlug).toBe("bajar-de-peso");
    expect(result.success).toBe(true);
  });

  it("detects 'como viene mi foco' as objective bare", () => {
    const result = parseProgressInput("como viene mi foco");
    expect(result.intent).toBe("objective");
    expect(result.objectiveSlug).toBe("foco");
    expect(result.success).toBe(true);
  });

  it("detects 'como voy con mi disciplina' as objective bare", () => {
    const result = parseProgressInput("como voy con mi disciplina");
    expect(result.intent).toBe("objective");
    expect(result.objectiveSlug).toBe("disciplina");
    expect(result.success).toBe(true);
  });
});

describe("progressParser - summary", () => {
  it("detects 'resumen de progreso'", () => {
    const result = parseProgressInput("resumen de progreso");
    expect(result.intent).toBe("summary");
    expect(result.success).toBe(true);
  });

  it("detects 'progreso general'", () => {
    const result = parseProgressInput("progreso general");
    expect(result.intent).toBe("summary");
    expect(result.success).toBe(true);
  });

  it("detects 'como voy en general'", () => {
    const result = parseProgressInput("como voy en general");
    expect(result.intent).toBe("summary");
    expect(result.success).toBe(true);
  });

  it("detects 'mi progreso'", () => {
    const result = parseProgressInput("mi progreso");
    expect(result.intent).toBe("summary");
    expect(result.success).toBe(true);
  });

  it("detects 'ver mi progreso'", () => {
    const result = parseProgressInput("ver mi progreso");
    expect(result.intent).toBe("summary");
    expect(result.success).toBe(true);
  });

  it("detects 'como va todo'", () => {
    const result = parseProgressInput("como va todo");
    expect(result.intent).toBe("summary");
    expect(result.success).toBe(true);
  });
});

describe("progressParser - unknown", () => {
  it("returns unknown for empty string", () => {
    const result = parseProgressInput("");
    expect(result.intent).toBe("unknown");
    expect(result.success).toBe(false);
  });

  it("returns unknown for unrelated text", () => {
    const result = parseProgressInput("crear tarea comprar pan");
    expect(result.intent).toBe("unknown");
    expect(result.success).toBe(false);
  });

  it("returns unknown for note creation", () => {
    const result = parseProgressInput("anota esto: idea de negocio");
    expect(result.intent).toBe("unknown");
    expect(result.success).toBe(false);
  });
});
