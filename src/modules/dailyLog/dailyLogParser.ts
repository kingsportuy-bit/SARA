export interface ParsedDailyLog {
  intent: "morning" | "evening" | "summary";
  date: string;
  wakeEnergy?: number;
  sleepHours?: number;
  morningIntention?: string;
  eveningReview?: string;
  mood?: string;
  notes?: string[];
}

type ParseResult =
  | { success: true; parsed: ParsedDailyLog }
  | { success: false; missingData: string[] };

const MONTEVIDEO_OFFSET_MS = -3 * 3600000;

function dateInMontevideo(offsetDays = 0): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const mv = new Date(utcMs + MONTEVIDEO_OFFSET_MS + offsetDays * 86400000);
  const y = mv.getFullYear();
  const m = String(mv.getMonth() + 1).padStart(2, "0");
  const d = String(mv.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayDate(): string {
  return dateInMontevideo();
}

function getYesterdayDate(): string {
  return dateInMontevideo(-1);
}

function extractEnergy(text: string): number | undefined {
  const m = text.match(/(?:energia|energ\u00eda)\s*(\d+)\b/i);
  if (m) {
    const v = parseInt(m[1], 10);
    if (v >= 1 && v <= 10) return v;
  }
  return undefined;
}

function extractSleep(text: string): number | undefined {
  const m = text.match(/(?:dorm[i\u00ed]\s*|dormiste\s*|dormi\s*|sue(?:n|\u00f1)o\s*)(\d+(?:[.,]\d+)?)/i);
  if (m) {
    const v = parseFloat(m[1].replace(",", "."));
    if (v >= 0) return v;
  }
  return undefined;
}

function extractIntention(text: string): string | undefined {
  const m = text.match(/(?:foco|intencion|intenci\u00f3n|intencion del dia|objetivo|voy a)\s*:?\s*(.+)/i);
  if (m && m[1].trim()) return m[1].trim();

  const m2 = text.match(/(?:voy a|planeo|me propongo)\s+(.+)/i);
  if (m2 && m2[1].trim()) return m2[1].trim();

  return undefined;
}

function extractReview(text: string): string | undefined {
  const m = text.match(/(?:avance|reflexion|reflexi\u00f3n|avances|logre|logr\u00e9|termine|termin\u00e9)\s*:?\s*(.+)/i);
  if (m && m[1].trim()) return m[1].trim();

  const m2 = text.match(/(?:hice|camine|camin\u00e9|logre|logr\u00e9|termine|termin\u00e9)\s+(.+)/i);
  if (m2 && m2[1].trim()) return m2[1].trim();

  return undefined;
}

function resolveDate(text: string): string {
  return /\bayer\b/i.test(text) ? getYesterdayDate() : getTodayDate();
}

export function parseDailyLog(text: string): ParseResult {
  if (!text) return { success: false, missingData: ["dailyLogFields"] };

  const lower = text.toLowerCase().trim();

  const isMorning =
    /\bbuen\s*d(?:i|\u00ed)a\b/i.test(lower) ||
    /\bcheckin\s+ma(?:n|\u00f1)ana\b/i.test(lower) ||
    /\bbuenas\b/i.test(lower) ||
    /\bcheck[\s-]*in\s+ma(?:n|\u00f1)ana\b/i.test(lower) ||
    /\bbuenos\s+d(?:i|\u00ed)as\b/i.test(lower) ||
    /\benergia\b/i.test(lower) ||
    /\benerg\u00eda\b/i.test(lower) ||
    /\bdormi\b/i.test(lower) ||
    /\bintencion\b/i.test(lower) ||
    /\bintenci\u00f3n\b/i.test(lower);

  const isSummary =
    /\bresumen\s+del\s+d(?:i|\u00ed)a\b/i.test(lower) ||
    /\bcomo\s+estuvo\s+mi\s+d(?:i|\u00ed)a\b/i.test(lower) ||
    /\bque\s+tal\s+mi\s+d(?:i|\u00ed)a\b/i.test(lower) ||
    /\bver\s+mi\s+d(?:i|\u00ed)a\b/i.test(lower) ||
    /\bmi\s+d(?:i|\u00ed)a\s+de\s+hoy\b/i.test(lower);

  const isEvening =
    /\bcierre\s+del\s+d(?:i|\u00ed)a\b/i.test(lower) ||
    /\bcierre\s+de\s+hoy\b/i.test(lower) ||
    /\bcierre\s+diario\b/i.test(lower) ||
    /\bfin\s+del\s+d(?:i|\u00ed)a\b/i.test(lower);

  if (isSummary) {
    return {
      success: true,
      parsed: {
        intent: "summary",
        date: resolveDate(lower),
      },
    };
  }

  if (isEvening) {
    const eveningReview = extractReview(lower);

    if (!eveningReview) {
      return { success: false, missingData: ["dailyLogFields"] };
    }

    return {
      success: true,
      parsed: {
        intent: "evening",
        date: resolveDate(lower),
        eveningReview,
      },
    };
  }

  if (isMorning) {
    const wakeEnergy = extractEnergy(lower);
    const sleepHours = extractSleep(lower);
    const morningIntention = extractIntention(lower);

    const hasAnyField = wakeEnergy !== undefined || sleepHours !== undefined || morningIntention !== undefined;

    if (!hasAnyField) {
      return { success: false, missingData: ["dailyLogFields"] };
    }

    return {
      success: true,
      parsed: {
        intent: "morning",
        date: resolveDate(lower),
        wakeEnergy,
        sleepHours,
        morningIntention,
      },
    };
  }

  return { success: false, missingData: ["dailyLogFields"] };
}

export function formatDateDisplay(isoDate: string): string {
  return isoDate;
}
