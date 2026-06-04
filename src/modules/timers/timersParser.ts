export interface ParsedTimersInput {
  intent: "start" | "cancel" | "unknown";
  kind?: "workout_rest" | "generic";
  durationSeconds?: number;
  title?: string;
  timerId?: string;
  success: boolean;
  missingData: string[];
}

const TIMER_START_REST_PATTERNS = [
  /^descanso\s+(?:de\s+)?(\d+)\s*segundos?/i,
  /^descanso\s+(?:de\s+)?(\d+)\s*minutos?/i,
  /^descansar\s+(?:de\s+)?(\d+)\s*segundos?/i,
  /^descansar\s+(?:de\s+)?(\d+)\s*minutos?/i,
];

const TIMER_START_REST_BARE_PATTERNS = [
  /^descanso\s*$/i,
  /^descansar\s*$/i,
];

const TIMER_START_GENERIC_PATTERNS = [
  /^timer\s+(?:de\s+)?(\d+)\s*segundos?/i,
  /^timer\s+(?:de\s+)?(\d+)\s*minutos?/i,
  /^temporizador\s+(?:de\s+)?(\d+)\s*segundos?/i,
  /^temporizador\s+(?:de\s+)?(\d+)\s*minutos?/i,
];

const TIMER_START_GENERIC_BARE_PATTERNS = [
  /^timer\s*$/i,
  /^temporizador\s*$/i,
];

const TIMER_CANCEL_PATTERNS = [
  /^cancelar\s+timer\s*$/i,
  /^cancelar\s+temporizador\s*$/i,
  /^cancelar\s+descanso\s*$/i,
  /^parar\s+timer\s*$/i,
  /^parar\s+temporizador\s*$/i,
  /^parar\s+descanso\s*$/i,
  /^detener\s+timer\s*$/i,
  /^detener\s+temporizador\s*$/i,
  /^detener\s+descanso\s*$/i,
];

function formatTitle(kind: "workout_rest" | "generic", durationSeconds: number): string {
  if (kind === "workout_rest") {
    if (durationSeconds >= 60) {
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      return secs > 0 ? `Descanso ${mins}m${secs}s` : `Descanso ${mins}m`;
    }
    return `Descanso ${durationSeconds}s`;
  }
  if (durationSeconds >= 60) {
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    return secs > 0 ? `Timer ${mins}m${secs}s` : `Timer ${mins}m`;
  }
  return `Timer ${durationSeconds}s`;
}

function parseDuration(value: number, unit: "segundos" | "minutos"): number {
  return unit === "segundos" ? value : value * 60;
}

export function parseTimersInput(text: string): ParsedTimersInput {
  if (!text || !text.trim()) {
    return { intent: "unknown", success: false, missingData: ["timers_command"] };
  }

  const trimmed = text.trim();

  // Cancel bare patterns first
  for (const pattern of TIMER_CANCEL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "cancel", success: false, missingData: ["timerId"] };
    }
  }

  // Rest bare patterns
  for (const pattern of TIMER_START_REST_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "start", kind: "workout_rest", success: false, missingData: ["duration"] };
    }
  }

  // Generic bare patterns
  for (const pattern of TIMER_START_GENERIC_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "start", kind: "generic", success: false, missingData: ["duration"] };
    }
  }

  // Rest start patterns
  for (const pattern of TIMER_START_REST_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1]) {
      const value = parseInt(match[1], 10);
      const unit = /minutos?/i.test(match[0]) ? "minutos" as const : "segundos" as const;
      const durationSeconds = parseDuration(value, unit);

      if (isNaN(value) || value <= 0) {
        return { intent: "start", kind: "workout_rest", success: false, missingData: ["duration"] };
      }

      const title = formatTitle("workout_rest", durationSeconds);
      return {
        intent: "start",
        kind: "workout_rest",
        durationSeconds,
        title,
        success: true,
        missingData: [],
      };
    }
  }

  // Generic start patterns
  for (const pattern of TIMER_START_GENERIC_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1]) {
      const value = parseInt(match[1], 10);
      const unit = /minutos?/i.test(match[0]) ? "minutos" as const : "segundos" as const;
      const durationSeconds = parseDuration(value, unit);

      if (isNaN(value) || value <= 0) {
        return { intent: "start", kind: "generic", success: false, missingData: ["duration"] };
      }

      const title = formatTitle("generic", durationSeconds);
      return {
        intent: "start",
        kind: "generic",
        durationSeconds,
        title,
        success: true,
        missingData: [],
      };
    }
  }

  return { intent: "unknown", success: false, missingData: ["timers_command"] };
}
