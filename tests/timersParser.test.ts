import { describe, expect, it } from "vitest";
import { parseTimersInput } from "../src/modules/timers/timersParser.js";

describe("timersParser - start rest", () => {
  it("parses descanso 90 segundos", () => {
    const result = parseTimersInput("descanso 90 segundos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.kind).toBe("workout_rest");
    expect(result.durationSeconds).toBe(90);
    expect(result.title).toBe("Descanso 1m30s");
  });

  it("parses descanso 120 segundos", () => {
    const result = parseTimersInput("descanso 120 segundos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.kind).toBe("workout_rest");
    expect(result.durationSeconds).toBe(120);
    expect(result.title).toBe("Descanso 2m");
  });

  it("parses descanso 2 minutos", () => {
    const result = parseTimersInput("descanso 2 minutos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.kind).toBe("workout_rest");
    expect(result.durationSeconds).toBe(120);
    expect(result.title).toBe("Descanso 2m");
  });

  it("parses descanso de 90 segundos", () => {
    const result = parseTimersInput("descanso de 90 segundos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.durationSeconds).toBe(90);
  });

  it("parses descansar 60 segundos", () => {
    const result = parseTimersInput("descansar 60 segundos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.kind).toBe("workout_rest");
    expect(result.durationSeconds).toBe(60);
  });

  it("parses descanso 5 segundo singular", () => {
    const result = parseTimersInput("descanso 5 segundo");
    expect(result.success).toBe(true);
    expect(result.durationSeconds).toBe(5);
    expect(result.title).toBe("Descanso 5s");
  });

  it("returns missing duration for bare descanso", () => {
    const result = parseTimersInput("descanso");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("start");
    expect(result.missingData).toContain("duration");
  });
});

describe("timersParser - start generic", () => {
  it("parses timer 2 minutos", () => {
    const result = parseTimersInput("timer 2 minutos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.kind).toBe("generic");
    expect(result.durationSeconds).toBe(120);
    expect(result.title).toBe("Timer 2m");
  });

  it("parses timer 10 segundos", () => {
    const result = parseTimersInput("timer 10 segundos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.durationSeconds).toBe(10);
    expect(result.title).toBe("Timer 10s");
  });

  it("parses timer de 5 minutos", () => {
    const result = parseTimersInput("timer de 5 minutos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.durationSeconds).toBe(300);
  });

  it("parses temporizador 3 minutos", () => {
    const result = parseTimersInput("temporizador 3 minutos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.kind).toBe("generic");
    expect(result.durationSeconds).toBe(180);
  });

  it("parses timer 1 minuto 30 segundos as separate (just parses number)", () => {
    const result = parseTimersInput("timer 1 minuto");
    expect(result.success).toBe(true);
    expect(result.durationSeconds).toBe(60);
  });

  it("returns missing duration for bare timer", () => {
    const result = parseTimersInput("timer");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("start");
    expect(result.kind).toBe("generic");
    expect(result.missingData).toContain("duration");
  });

  it("returns missing duration for bare temporizador", () => {
    const result = parseTimersInput("temporizador");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("start");
    expect(result.missingData).toContain("duration");
  });
});

describe("timersParser - cancel", () => {
  it("parses cancelar timer", () => {
    const result = parseTimersInput("cancelar timer");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("cancel");
    expect(result.missingData).toContain("timerId");
  });

  it("parses cancelar temporizador", () => {
    const result = parseTimersInput("cancelar temporizador");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("cancel");
    expect(result.missingData).toContain("timerId");
  });

  it("parses cancelar descanso", () => {
    const result = parseTimersInput("cancelar descanso");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("cancel");
    expect(result.missingData).toContain("timerId");
  });

  it("parses parar timer", () => {
    const result = parseTimersInput("parar timer");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("cancel");
  });

  it("parses detener temporizador", () => {
    const result = parseTimersInput("detener temporizador");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("cancel");
  });
});

describe("timersParser - unknown", () => {
  it("returns unknown for empty input", () => {
    const result = parseTimersInput("");
    expect(result.intent).toBe("unknown");
    expect(result.success).toBe(false);
  });

  it("returns unknown for irrelevant text", () => {
    const result = parseTimersInput("que hora es");
    expect(result.intent).toBe("unknown");
    expect(result.success).toBe(false);
  });
});
