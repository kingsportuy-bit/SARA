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

function getTodayDate(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const mv = new Date(utcMs - 3 * 3600000);
  const y = mv.getFullYear();
  const m = String(mv.getMonth() + 1).padStart(2, "0");
  const d = String(mv.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterdayDate(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const mv = new Date(utcMs - 3 * 3600000 - 86400000);
  const y = mv.getFullYear();
  const m = String(mv.getMonth() + 1).padStart(2, "0");
  const d = String(mv.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function extractEnergy(text: string): number | undefined {
  const m = text.match(/(?:energia|energía)\s*(\d+)\b/i);
  if (m) {
    const v = parseInt(m[1], 10);
    if (v >= 1 && v <= 10) return v;
  }
  return undefined;
}

function extractSleep(text: string): number | undefined {
  const m = text.match(/(?:dorm[iií]\s*|dormiste\s*|dormi\s*|sueño\s*)(\d+(?:[.,]\d+)?)/i);
  if (m) {
    const v = parseFloat(m[1].replace(",", "."));
    if (v >= 0) return v;
  }
  return undefined;
}

function extractIntention(text: string): string | undefined {
  const m = text.match(/(?:foco|intencion|intención|intencion del dia|objetivo|voy a)\s*:?\s*(.+)/i);
  if (m && m[1].trim()) return m[1].trim();

  const m2 = text.match(/(?:voy a|planeo|me propongo)\s+(.+)/i);
  if (m2 && m2[1].trim()) return m2[1].trim();

  return undefined;
}

function extractReview(text: string): string | undefined {
  const m = text.match(/(?:avance|reflexion|reflexión|avances|logre|logré|termine|terminé)\s*:?\s*(.+)/i);
  if (m && m[1].trim()) return m[1].trim();

  const m2 = text.match(/(?:hice|camine|caminé|logre|logré|termine|terminé)\s+(.+)/i);
  if (m2 && m2[1].trim()) return m2[1].trim();

  return undefined;
}

export function parseDailyLog(text: string): ParseResult {
  if (!text) return { success: false, missingData: ["dailyLogFields"] };

  const lower = text.toLowerCase().trim();

  const isMorning =
    /\bbuen\s*d[iíi]a\b/i.test(lower) ||
    /\bcheckin\s+ma[nñ]ana\b/i.test(lower) ||
    /\bbuenas\b/i.test(lower) ||
    /\bcheck[\s-]*in\s+ma[nñ]ana\b/i.test(lower) ||
    /\bbuenos\s+d[iíi]as\b/i.test(lower) ||
    /\benergia\b/i.test(lower) ||
    /\bdormi\b/i.test(lower) ||
    /\bintencion\b/i.test(lower);

  const isSummary =
    /\bresumen\s+del\s+d[iíi]a\b/i.test(lower) ||
    /\bcomo\s+estuvo\s+mi\s+d[iíi]a\b/i.test(lower) ||
    /\bque\s+tal\s+mi\s+d[iíi]a\b/i.test(lower) ||
    /\bver\s+mi\s+d[iíi]a\b/i.test(lower) ||
    /\bmi\s+d[iíi]a\s+de\s+hoy\b/i.test(lower);

  const isEvening =
    /\bcierre\s+del\s+d[iíi]a\b/i.test(lower) ||
    /\bcierre\s+de\s+hoy\b/i.test(lower) ||
    /\bcierre\s+diario\b/i.test(lower) ||
    /\bfin\s+del\s+d[iíi]a\b/i.test(lower);

  if (isSummary) {
    let date = getTodayDate();
    if (/\bayer\b/i.test(lower)) {
      date = getYesterdayDate();
    }

    return {
      success: true,
      parsed: {
        intent: "summary",
        date,
      },
    };
  }

  if (isEvening) {
    let date = getTodayDate();
    if (/\bayer\b/i.test(lower)) {
      date = getYesterdayDate();
    }

    const eveningReview = extractReview(lower);

    if (!eveningReview) {
      return { success: false, missingData: ["dailyLogFields"] };
    }

    return {
      success: true,
      parsed: {
        intent: "evening",
        date,
        eveningReview,
      },
    };
  }

  if (isMorning) {
    let date = getTodayDate();
    if (/\bayer\b/i.test(lower)) {
      date = getYesterdayDate();
    }

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
        date,
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
