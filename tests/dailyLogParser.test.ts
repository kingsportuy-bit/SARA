import { describe, expect, it } from "vitest";
import { parseDailyLog, formatDateDisplay } from "../src/modules/dailyLog/dailyLogParser.js";

function getTodayDisplay(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const mv = new Date(utcMs - 3 * 3600000);
  const y = mv.getFullYear();
  const m = String(mv.getMonth() + 1).padStart(2, "0");
  const d = String(mv.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterdayDisplay(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const mv = new Date(utcMs - 3 * 3600000 - 86400000);
  const y = mv.getFullYear();
  const m = String(mv.getMonth() + 1).padStart(2, "0");
  const d = String(mv.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

describe("dailyLogParser - morning", () => {
  it("parses energy from buen dia", () => {
    const result = parseDailyLog("buen dia energia 7 dormi 6.5 foco terminar propuestas");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("morning");
      expect(result.parsed.date).toBe(getTodayDisplay());
      expect(result.parsed.wakeEnergy).toBe(7);
      expect(result.parsed.sleepHours).toBe(6.5);
      expect(result.parsed.morningIntention).toBe("terminar propuestas");
    }
  });

  it("parses checkin manana", () => {
    const result = parseDailyLog("checkin manana energia 8 dormi 7 intencion ordenar agenda");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("morning");
      expect(result.parsed.wakeEnergy).toBe(8);
      expect(result.parsed.sleepHours).toBe(7);
      expect(result.parsed.morningIntention).toBe("ordenar agenda");
    }
  });

  it("parses morning from buenos dias pattern", () => {
    const result = parseDailyLog("buenos dias energia 5 dormi 4 foco escribir");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("morning");
      expect(result.parsed.wakeEnergy).toBe(5);
    }
  });

  it("parses accented morning text", () => {
    const accentedText = [
      "buen d", String.fromCharCode(0x00ed), "a energ", String.fromCharCode(0x00ed),
      "a 7 dorm", String.fromCharCode(0x00ed), " 6,5 intenci", String.fromCharCode(0x00f3),
      "n ordenar agenda",
    ].join("");
    const result = parseDailyLog(accentedText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("morning");
      expect(result.parsed.wakeEnergy).toBe(7);
      expect(result.parsed.sleepHours).toBe(6.5);
      expect(result.parsed.morningIntention).toBe("ordenar agenda");
    }
  });

  it("parses morning from buenas pattern", () => {
    const result = parseDailyLog("buenas dormi 8");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("morning");
      expect(result.parsed.sleepHours).toBe(8);
    }
  });

  it("falls back with missingData when no fields are updatable", () => {
    const result = parseDailyLog("buen dia");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.missingData).toContain("dailyLogFields");
    }
  });

  it("uses hoy date by default for morning", () => {
    const result = parseDailyLog("buen dia energia 6");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.date).toBe(getTodayDisplay());
    }
  });
});

describe("dailyLogParser - evening", () => {
  it("parses cierre del dia with avance", () => {
    const result = parseDailyLog("cierre del dia avance termine propuestas y camine");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("evening");
      expect(result.parsed.date).toBe(getTodayDisplay());
      expect(result.parsed.eveningReview).toBe("termine propuestas y camine");
    }
  });

  it("parses cierre de hoy", () => {
    const result = parseDailyLog("cierre de hoy avance hice ejercicio");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("evening");
      expect(result.parsed.eveningReview).toBe("hice ejercicio");
    }
  });

  it("parses cierre diario", () => {
    const result = parseDailyLog("cierre diario avance logre descansar");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("evening");
    }
  });

  it("parses fin del dia", () => {
    const result = parseDailyLog("fin del dia avance termine todo");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("evening");
    }
  });

  it("falls back with missingData when no evening review", () => {
    const result = parseDailyLog("cierre del dia");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.missingData).toContain("dailyLogFields");
    }
  });

  it("parses reflexion pattern", () => {
    const result = parseDailyLog("cierre del dia avance fue un buen dia");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("evening");
      expect(result.parsed.eveningReview).toBe("fue un buen dia");
    }
  });

  it("parses accented evening text", () => {
    const accentedText = [
      "cierre del d", String.fromCharCode(0x00ed), "a reflexi", String.fromCharCode(0x00f3),
      "n logr", String.fromCharCode(0x00e9), " terminar propuestas",
    ].join("");
    const result = parseDailyLog(accentedText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("evening");
      expect(result.parsed.eveningReview).toBe(`logr${String.fromCharCode(0x00e9)} terminar propuestas`);
    }
  });
});

describe("dailyLogParser - summary", () => {
  it("parses resumen del dia", () => {
    const result = parseDailyLog("resumen del dia");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("summary");
      expect(result.parsed.date).toBe(getTodayDisplay());
    }
  });

  it("parses accented summary text", () => {
    const result = parseDailyLog(`resumen del d${String.fromCharCode(0x00ed)}a`);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("summary");
    }
  });

  it("parses como estuvo mi dia", () => {
    const result = parseDailyLog("como estuvo mi dia");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("summary");
    }
  });

  it("parses que tal mi dia", () => {
    const result = parseDailyLog("que tal mi dia");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("summary");
    }
  });

  it("parses ver mi dia", () => {
    const result = parseDailyLog("ver mi dia");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("summary");
    }
  });

  it("parses mi dia de hoy", () => {
    const result = parseDailyLog("mi dia de hoy");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.intent).toBe("summary");
    }
  });
});

describe("dailyLogParser - date handling", () => {
  it("supports ayer for morning", () => {
    const result = parseDailyLog("ayer buen dia energia 7");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.date).toBe(getYesterdayDisplay());
    }
  });

  it("supports ayer for evening", () => {
    const result = parseDailyLog("ayer cierre del dia avance hice cosas");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.date).toBe(getYesterdayDisplay());
    }
  });

  it("supports ayer for summary", () => {
    const result = parseDailyLog("resumen del dia de ayer");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.date).toBe(getYesterdayDisplay());
    }
  });
});

describe("dailyLogParser - edge cases", () => {
  it("rejects empty text", () => {
    const result = parseDailyLog("");
    expect(result.success).toBe(false);
  });

  it("rejects unrelated text", () => {
    const result = parseDailyLog("hola como estas");
    expect(result.success).toBe(false);
  });

  it("parses sleep with comma", () => {
    const result = parseDailyLog("buen dia dormi 6,5 horas");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.sleepHours).toBe(6.5);
    }
  });

  it("parses voy a pattern for intention", () => {
    const result = parseDailyLog("buen dia voy a terminar la documentacion");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.morningIntention).toBe("terminar la documentacion");
    }
  });

  it("parses hice pattern for review", () => {
    const result = parseDailyLog("cierre del dia hice ejercicio y medite");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.eveningReview).toBe("ejercicio y medite");
    }
  });

  it("parses logre pattern for review", () => {
    const result = parseDailyLog("cierre del dia logre avanzar el proyecto");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.parsed.eveningReview).toBe("avanzar el proyecto");
    }
  });
});

describe("formatDateDisplay", () => {
  it("returns iso date as string", () => {
    const result = formatDateDisplay("2026-06-03");
    expect(result).toBe("2026-06-03");
  });
});
