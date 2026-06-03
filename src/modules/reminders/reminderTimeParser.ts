export type ParseResult = {
  success: true;
  dueAt: Date;
  dueAtISO: string;
} | {
  success: false;
  missingData: string[];
};

const TIMEZONE = "America/Montevideo";

function getNowInMontevideo(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs - 3 * 3600000);
}

function todayAt(hour: number, minute: number): Date {
  const now = getNowInMontevideo();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  const utcMs = d.getTime() + 3 * 3600000 - new Date().getTimezoneOffset() * 60000;
  return new Date(utcMs);
}

function tomorrowAt(hour: number, minute: number): Date {
  const now = getNowInMontevideo();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute, 0, 0);
  const utcMs = d.getTime() + 3 * 3600000 - new Date().getTimezoneOffset() * 60000;
  return new Date(utcMs);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function extractHourFromText(text: string): number | null {
  const aLasMatch = text.match(/a\s+las\s+(\d{1,2})\b/i);
  if (aLasMatch) {
    const h = parseInt(aLasMatch[1], 10);
    if (h >= 0 && h < 24) return h;
  }
  const hourAtEnd = text.match(/\b(\d{1,2})\s*(?:hs?|horas?)?\s*$/i);
  if (hourAtEnd) {
    const h = parseInt(hourAtEnd[1], 10);
    if (h >= 0 && h < 24) return h;
  }
  return null;
}

export function parseReminderTime(text: string): ParseResult {
  if (!text) return { success: false, missingData: ["dueAt"] };

  const lower = text.toLowerCase().trim();

  const time24MatchAll = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  const timeSimpleMatchAll = lower.match(/\b(\d{1,2})\b(?:\s*(?:hs?|horas?))?(?:\s|$)/);

  const minMatch = lower.match(/en\s+(\d+)\s*minutos?/i);
  if (minMatch) {
    const minutes = parseInt(minMatch[1], 10);
    if (minutes <= 0) return { success: false, missingData: ["dueAt"] };
    const due = addMinutes(new Date(), minutes);
    return { success: true, dueAt: due, dueAtISO: due.toISOString() };
  }

  const hourMatch = lower.match(/en\s+(\d+)\s*horas?/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    if (hours <= 0) return { success: false, missingData: ["dueAt"] };
    const due = addHours(new Date(), hours);
    return { success: true, dueAt: due, dueAtISO: due.toISOString() };
  }

  const dayMatch = lower.match(/en\s+(\d+)\s*dias?/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    if (days <= 0) return { success: false, missingData: ["dueAt"] };
    const due = addDays(new Date(), days);
    return { success: true, dueAt: due, dueAtISO: due.toISOString() };
  }

  if (lower.includes("manana") || lower.includes("mañana")) {
    if (time24MatchAll) {
      const h = parseInt(time24MatchAll[1], 10);
      const m = parseInt(time24MatchAll[2], 10);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        const due = tomorrowAt(h, m);
        return { success: true, dueAt: due, dueAtISO: due.toISOString() };
      }
    }
    const hourFromText = extractHourFromText(lower);
    if (hourFromText !== null) {
      const due = tomorrowAt(hourFromText, 0);
      return { success: true, dueAt: due, dueAtISO: due.toISOString() };
    }
    const due = tomorrowAt(9, 0);
    return { success: true, dueAt: due, dueAtISO: due.toISOString() };
  }

  if (lower.includes("hoy")) {
    if (time24MatchAll) {
      const h = parseInt(time24MatchAll[1], 10);
      const m = parseInt(time24MatchAll[2], 10);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        const due = todayAt(h, m);
        if (due > new Date()) {
          return { success: true, dueAt: due, dueAtISO: due.toISOString() };
        }
        return { success: false, missingData: ["dueAt"] };
      }
    }
    const hourFromText = extractHourFromText(lower);
    if (hourFromText !== null) {
      const due = todayAt(hourFromText, 0);
      if (due > new Date()) {
        return { success: true, dueAt: due, dueAtISO: due.toISOString() };
      }
      return { success: false, missingData: ["dueAt"] };
    }
    return { success: false, missingData: ["dueAt"] };
  }

  return { success: false, missingData: ["dueAt"] };
}

export function formatDueAt(isoDate: string): string {
  const d = new Date(isoDate);
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const local = new Date(utcMs - 3 * 3600000);
  const day = String(local.getDate()).padStart(2, "0");
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const year = local.getFullYear();
  const hours = String(local.getHours()).padStart(2, "0");
  const minutes = String(local.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
