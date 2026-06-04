import { describe, expect, it } from "vitest";
import { parseRoutinesInput } from "../src/modules/routines/routinesParser.js";

describe("routinesParser - create", () => {
  it("parses crear rutina manana normal", () => {
    const result = parseRoutinesInput("crear rutina manana normal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("manana normal");
    expect(result.slug).toBe("manana-normal");
  });

  it("parses crea rutina manana normal", () => {
    const result = parseRoutinesInput("crea rutina manana normal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("manana normal");
  });

  it("parses nueva rutina tarde productiva", () => {
    const result = parseRoutinesInput("nueva rutina tarde productiva");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("tarde productiva");
  });

  it("parses agregar rutina noche tranquila", () => {
    const result = parseRoutinesInput("agregar rutina noche tranquila");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("noche tranquila");
  });

  it("parses crear rutina with steps separated by colon", () => {
    const result = parseRoutinesInput("crear rutina manana normal: 7:00 despertar; 7:15 desayuno");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("manana normal");
    expect(result.slug).toBe("manana-normal");
    expect(result.steps).toHaveLength(2);
    expect(result.steps![0].position).toBe(1);
    expect(result.steps![0].timeOfDay).toBe("07:00");
    expect(result.steps![0].title).toBe("despertar");
    expect(result.steps![1].position).toBe(2);
    expect(result.steps![1].timeOfDay).toBe("07:15");
    expect(result.steps![1].title).toBe("desayuno");
  });

  it("parses crear rutina with steps and descriptions", () => {
    const result = parseRoutinesInput("crear rutina entrenamiento: 07:00 despertar (levantarse de la cama); 07:30 ejercicios");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.steps).toHaveLength(2);
    expect(result.steps![0].title).toBe("despertar");
    expect(result.steps![0].description).toBe("levantarse de la cama");
  });

  it("returns missing routineName for create without name", () => {
    const result = parseRoutinesInput("crear rutina");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("routineName");
  });

  it("generates slug deterministico ASCII-safe", () => {
    const result = parseRoutinesInput("crear rutina atencion y foco");
    expect(result.success).toBe(true);
    expect(result.slug).toBe("atencion-y-foco");
  });

  it("returns missing routine name for bare pattern", () => {
    const result = parseRoutinesInput("crea rutina");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("routineName");
  });
});

describe("routinesParser - list", () => {
  it("parses que rutinas tengo", () => {
    const result = parseRoutinesInput("que rutinas tengo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses listar rutinas", () => {
    const result = parseRoutinesInput("listar rutinas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses mis rutinas", () => {
    const result = parseRoutinesInput("mis rutinas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses ver rutinas", () => {
    const result = parseRoutinesInput("ver rutinas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses lista rutinas", () => {
    const result = parseRoutinesInput("lista rutinas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });
});

describe("routinesParser - activate", () => {
  it("parses activar rutina manana normal", () => {
    const result = parseRoutinesInput("activar rutina manana normal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("activate");
    expect(result.routineSlug).toBe("manana-normal");
  });

  it("parses activa rutina manana normal", () => {
    const result = parseRoutinesInput("activa rutina manana normal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("activate");
    expect(result.routineSlug).toBe("manana-normal");
  });

  it("parses iniciar rutina manana normal", () => {
    const result = parseRoutinesInput("iniciar rutina manana normal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("activate");
    expect(result.routineSlug).toBe("manana-normal");
  });

  it("returns missing routine for activate without name", () => {
    const result = parseRoutinesInput("activar rutina");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("routine");
  });
});

describe("routinesParser - pause", () => {
  it("parses pausar rutina manana normal", () => {
    const result = parseRoutinesInput("pausar rutina manana normal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("pause");
    expect(result.routineSlug).toBe("manana-normal");
  });

  it("parses detener rutina manana normal", () => {
    const result = parseRoutinesInput("detener rutina manana normal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("pause");
    expect(result.routineSlug).toBe("manana-normal");
  });

  it("returns missing routine for pause without name", () => {
    const result = parseRoutinesInput("pausar rutina");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("routine");
  });
});

describe("routinesParser - archive", () => {
  it("parses archivar rutina manana normal", () => {
    const result = parseRoutinesInput("archivar rutina manana normal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.routineSlug).toBe("manana-normal");
  });

  it("parses archiva rutina tarde productiva", () => {
    const result = parseRoutinesInput("archiva rutina tarde productiva");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.routineSlug).toBe("tarde-productiva");
  });

  it("returns missing routine for archive without name", () => {
    const result = parseRoutinesInput("archivar rutina");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("routine");
  });
});

describe("routinesParser - unknown", () => {
  it("returns unknown for empty string", () => {
    const result = parseRoutinesInput("");
    expect(result.intent).toBe("unknown");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("routines_command");
  });

  it("returns unknown for unrelated text", () => {
    const result = parseRoutinesInput("como estuvo mi dia?");
    expect(result.intent).toBe("unknown");
    expect(result.success).toBe(false);
  });
});
