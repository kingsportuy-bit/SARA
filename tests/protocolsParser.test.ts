import { describe, expect, it } from "vitest";
import { parseProtocolsInput } from "../src/modules/protocols/protocolsParser.js";

describe("protocolsParser - create", () => {
  it("parses crear protocolo energia baja: si dormi menos de 6 horas, rutina liviana", () => {
    const result = parseProtocolsInput("crear protocolo energia baja: si dormi menos de 6 horas, rutina liviana");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("energia baja");
    expect(result.slug).toBe("energia-baja");
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].condition).toBe("dormi menos de 6 horas");
    expect(result.rules[0].action).toBe("rutina liviana");
  });

  it("parses crear protocolo sin reglas (just name)", () => {
    const result = parseProtocolsInput("crear protocolo evitar cafe tarde");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("evitar cafe tarde");
    expect(result.slug).toBe("evitar-cafe-tarde");
    expect(result.rules).toHaveLength(0);
  });

  it("parses nuevo protocolo descanso activo", () => {
    const result = parseProtocolsInput("nuevo protocolo descanso activo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("descanso activo");
  });

  it("parses agregar protocolo revision semanal", () => {
    const result = parseProtocolsInput("agregar protocolo revision semanal");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("create");
    expect(result.name).toBe("revision semanal");
  });

  it("returns missing protocolName for create without name", () => {
    const result = parseProtocolsInput("crear protocolo");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("protocolName");
  });

  it("generates slug deterministico ASCII-safe", () => {
    const result = parseProtocolsInput("crear protocolo energia y foco");
    expect(result.success).toBe(true);
    expect(result.slug).toBe("energia-y-foco");
  });
});

describe("protocolsParser - list", () => {
  it("parses que protocolos tengo", () => {
    const result = parseProtocolsInput("que protocolos tengo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses listar protocolos", () => {
    const result = parseProtocolsInput("listar protocolos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses mis protocolos", () => {
    const result = parseProtocolsInput("mis protocolos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses ver protocolos", () => {
    const result = parseProtocolsInput("ver protocolos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });
});

describe("protocolsParser - activate", () => {
  it("parses activar protocolo energia baja", () => {
    const result = parseProtocolsInput("activar protocolo energia baja");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("activate");
    expect(result.slug).toBe("energia-baja");
  });

  it("parses activa protocolo descanso activo", () => {
    const result = parseProtocolsInput("activa protocolo descanso activo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("activate");
    expect(result.slug).toBe("descanso-activo");
  });

  it("returns missing protocol for activate without name", () => {
    const result = parseProtocolsInput("activar protocolo");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("protocol");
  });
});

describe("protocolsParser - archive", () => {
  it("parses archivar protocolo energia baja", () => {
    const result = parseProtocolsInput("archivar protocolo energia baja");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.slug).toBe("energia-baja");
  });

  it("parses archiva protocolo descanso activo", () => {
    const result = parseProtocolsInput("archiva protocolo descanso activo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("archive");
    expect(result.slug).toBe("descanso-activo");
  });

  it("returns missing protocol for archive without name", () => {
    const result = parseProtocolsInput("archivar protocolo");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("protocol");
  });
});

describe("protocolsParser - evaluate", () => {
  it("parses evaluar protocolo energia baja", () => {
    const result = parseProtocolsInput("evaluar protocolo energia baja");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("evaluate");
    expect(result.slug).toBe("energia-baja");
  });

  it("parses revisar protocolo descanso activo", () => {
    const result = parseProtocolsInput("revisar protocolo descanso activo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("evaluate");
    expect(result.slug).toBe("descanso-activo");
  });

  it("returns missing protocol for evaluate without name", () => {
    const result = parseProtocolsInput("evaluar protocolo");
    expect(result.success).toBe(false);
    expect(result.missingData).toContain("protocol");
  });
});

describe("protocolsParser - unknown", () => {
  it("returns unknown for random text", () => {
    const result = parseProtocolsInput("cual es el clima hoy");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("unknown");
    expect(result.missingData).toContain("protocols_command");
  });

  it("returns unknown for empty text", () => {
    const result = parseProtocolsInput("");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("unknown");
  });
});
