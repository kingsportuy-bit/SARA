import { describe, expect, it } from "vitest";
import { parseReminderTime, formatDueAt } from "../src/modules/reminders/reminderTimeParser.js";

describe("reminderTimeParser - parseReminderTime", () => {
  it("parses en N minutos", () => {
    const result = parseReminderTime("recordame en 5 minutos llamar al contador");
    expect(result.success).toBe(true);
    if (result.success) {
      const now = new Date();
      const due = new Date(result.dueAtISO);
      const diffMs = due.getTime() - now.getTime();
      expect(diffMs).toBeGreaterThan(0);
      expect(diffMs).toBeLessThan(6 * 60000);
    }
  });

  it("parses en N horas", () => {
    const result = parseReminderTime("recordame en 2 horas llamar al contador");
    expect(result.success).toBe(true);
    if (result.success) {
      const now = new Date();
      const due = new Date(result.dueAtISO);
      const diffMs = due.getTime() - now.getTime();
      expect(diffMs).toBeGreaterThan(3600000);
      expect(diffMs).toBeLessThan(3 * 3600000);
    }
  });

  it("parses en N dias", () => {
    const result = parseReminderTime("recordame en 1 dia revisar presupuesto");
    expect(result.success).toBe(true);
    if (result.success) {
      const now = new Date();
      const due = new Date(result.dueAtISO);
      const diffMs = due.getTime() - now.getTime();
      expect(diffMs).toBeGreaterThan(0);
      expect(diffMs).toBeLessThan(48 * 3600000);
    }
  });

  it("parses manana a las 9", () => {
    const result = parseReminderTime("recordame manana a las 9 llamar al contador");
    expect(result.success).toBe(true);
    if (result.success) {
      const due = new Date(result.dueAtISO);
      expect(due > new Date()).toBe(true);
    }
  });

  it("parses manana a las 14:30", () => {
    const result = parseReminderTime("recordame manana a las 14:30 revision");
    expect(result.success).toBe(true);
    if (result.success) {
      const due = new Date(result.dueAtISO);
      expect(due > new Date()).toBe(true);
    }
  });

  it("parses hoy a las HH", () => {
    const result = parseReminderTime("recordame hoy a las 23 llamar");
    expect(result.success).toBe(true);
    if (result.success) {
      const due = new Date(result.dueAtISO);
      expect(due > new Date()).toBe(true);
    }
  });

  it("parses hoy a las HH:MM with future time", () => {
    const result = parseReminderTime("recordame hoy a las 23:30 revision");
    expect(result.success).toBe(true);
    if (result.success) {
      const due = new Date(result.dueAtISO);
      expect(due > new Date()).toBe(true);
    }
  });

  it("rejects ambiguous text without time info", () => {
    const result = parseReminderTime("recordame llamar al contador");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.missingData).toContain("dueAt");
    }
  });

  it("rejects zero minutes", () => {
    const result = parseReminderTime("recordame en 0 minutos llamar");
    expect(result.success).toBe(false);
  });

  it("rejects negative values", () => {
    const result = parseReminderTime("recordame en -5 minutos llamar");
    expect(result.success).toBe(false);
  });

  it("parses just en N minutos without prefix", () => {
    const result = parseReminderTime("en 10 minutos llamar al contador");
    expect(result.success).toBe(true);
    if (result.success) {
      const due = new Date(result.dueAtISO);
      expect(due > new Date()).toBe(true);
    }
  });

  it("parses just en N horas without prefix", () => {
    const result = parseReminderTime("en 3 horas revisar facturas");
    expect(result.success).toBe(true);
    if (result.success) {
      const due = new Date(result.dueAtISO);
      expect(due > new Date()).toBe(true);
    }
  });
});

describe("formatDueAt", () => {
  it("formats ISO date to dd/mm/yyyy HH:MM", () => {
    const result = formatDueAt("2026-06-10T13:00:00Z");
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
  });
});
