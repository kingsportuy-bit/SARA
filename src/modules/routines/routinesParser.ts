import type { RoutineStepInput } from "../../contracts/routines.js";

export interface ParsedRoutinesInput {
  intent: "create" | "list" | "activate" | "pause" | "archive" | "unknown";
  name?: string;
  slug?: string;
  description?: string;
  steps?: RoutineStepInput[];
  routineSlug?: string;
  success: boolean;
  missingData: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractRoutineName(raw: string): string {
  return raw.replace(/^(?:a\s+la?\s+)?\s*rutina\s+/i, "").trim();
}

function parseTimeOfDay(raw: string): string | null {
  const timePattern = /^(\d{1,2}):(\d{2})$/;
  const match = timePattern.exec(raw);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseStepsFromRaw(rawSteps: string): { steps: RoutineStepInput[]; valid: boolean; errorStep: string } {
  const steps: RoutineStepInput[] = [];
  const parts = rawSteps.split(/[;]\s*/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    let timeOfDay: string | undefined;
    let title = part;
    let description: string | undefined;

    // Try to extract time prefix like "07:00 descanso"
    const timeMatch = part.match(/^(\d{1,2}:\d{2})\s+(.+)/);
    if (timeMatch) {
      const parsedTime = parseTimeOfDay(timeMatch[1]);
      if (parsedTime) {
        timeOfDay = parsedTime;
        title = timeMatch[2].trim();
      }
    }

    // Try to extract description in parentheses
    const descMatch = title.match(/^(.+?)\s*\((.+)\)$/);
    if (descMatch) {
      title = descMatch[1].trim();
      description = descMatch[2].trim();
    }

    if (!title) {
      return { steps: [], valid: false, errorStep: `step ${i + 1} title is empty` };
    }

    steps.push({
      position: i + 1,
      timeOfDay,
      title,
      description,
    });
  }

  return { steps, valid: true, errorStep: "" };
}

const ROUTINE_CREATE_PATTERNS_WITH_STEPS = [
  /^crear?\s*rutina\s+(.+?):\s*(.+)/i,
  /^nueva\s*rutina\s+(.+?):\s*(.+)/i,
  /^agregar\s*rutina\s+(.+?):\s*(.+)/i,
];

const ROUTINE_CREATE_PATTERNS_BARE = [
  /^crear?\s*rutina\s+(.+)/i,
  /^nueva\s*rutina\s+(.+)/i,
  /^agregar\s*rutina\s+(.+)/i,
];

const ROUTINE_CREATE_BARE = [
  /^crear?\s*rutina\s*$/i,
  /^nueva\s*rutina\s*$/i,
  /^agregar\s*rutina\s*$/i,
];

const ROUTINE_LIST_PATTERNS = [
  /^(?:que|mis)\s*rutinas\s+(?:tengo|hay|tienes|existen)/i,
  /^listar?\s*rutinas/i,
  /^lista\s*(?:mis\s*)?rutinas/i,
  /^mis\s*rutinas/i,
  /^rutinas\s*$/i,
  /^ver\s*rutinas/i,
  /^mostrar\s*rutinas/i,
];

const ROUTINE_ACTIVATE_PATTERNS = [
  /^activar\s*rutina\s+(.+)/i,
  /^activa\s*rutina\s+(.+)/i,
  /^iniciar\s*rutina\s+(.+)/i,
  /^comenzar\s*rutina\s+(.+)/i,
];

const ROUTINE_ACTIVATE_BARE = [
  /^activar\s*rutina\s*$/i,
  /^activa\s*rutina\s*$/i,
  /^iniciar\s*rutina\s*$/i,
  /^comenzar\s*rutina\s*$/i,
];

const ROUTINE_PAUSE_PATTERNS = [
  /^pausar\s*rutina\s+(.+)/i,
  /^pausa\s*rutina\s+(.+)/i,
  /^detener\s*rutina\s+(.+)/i,
];

const ROUTINE_PAUSE_BARE = [
  /^pausar\s*rutina\s*$/i,
  /^pausa\s*rutina\s*$/i,
  /^detener\s*rutina\s*$/i,
];

const ROUTINE_ARCHIVE_PATTERNS = [
  /^archivar\s*rutina\s+(.+)/i,
  /^archiva\s*rutina\s+(.+)/i,
  /^eliminar\s*rutina\s+(.+)/i,
];

const ROUTINE_ARCHIVE_BARE = [
  /^archivar\s*rutina\s*$/i,
  /^archiva\s*rutina\s*$/i,
  /^eliminar\s*rutina\s*$/i,
];

export function parseRoutinesInput(text: string): ParsedRoutinesInput {
  if (!text) {
    return { intent: "unknown", success: false, missingData: ["routines_command"] };
  }

  const trimmed = text.trim();

  // Create bare (no name)
  for (const pattern of ROUTINE_CREATE_BARE) {
    if (pattern.test(trimmed)) {
      return { intent: "create", success: false, missingData: ["routineName"] };
    }
  }

  // Create with steps: "crear rutina manana normal: 7:00 despertar; 7:15 desayuno"
  for (const pattern of ROUTINE_CREATE_PATTERNS_WITH_STEPS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[2]) {
      const name = match[1].trim();
      const rawSteps = match[2].trim();
      const slug = slugify(name);

      if (!slug) {
        return { intent: "create", name, success: false, missingData: ["routineName"] };
      }

      const { steps, valid, errorStep } = parseStepsFromRaw(rawSteps);
      if (!valid) {
        return { intent: "create", name, slug, success: false, missingData: ["routineStepTime"] };
      }

      return { intent: "create", name, slug, steps, success: true, missingData: [] };
    }
  }

  // Create with name only (no steps)
  for (const pattern of ROUTINE_CREATE_PATTERNS_BARE) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const name = match[1].trim();
      const slug = slugify(name);

      if (!slug) {
        return { intent: "create", name, success: false, missingData: ["routineName"] };
      }

      return { intent: "create", name, slug, success: true, missingData: [] };
    }
  }

  // List
  for (const pattern of ROUTINE_LIST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "list", success: true, missingData: [] };
    }
  }

  // Activate bare
  for (const pattern of ROUTINE_ACTIVATE_BARE) {
    if (pattern.test(trimmed)) {
      return { intent: "activate", success: false, missingData: ["routine"] };
    }
  }

  // Activate with name
  for (const pattern of ROUTINE_ACTIVATE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractRoutineName(match[1].trim());
      const routineSlug = slugify(raw);

      if (!routineSlug) {
        return { intent: "activate", success: false, missingData: ["routine"] };
      }

      return { intent: "activate", routineSlug, success: true, missingData: [] };
    }
  }

  // Pause bare
  for (const pattern of ROUTINE_PAUSE_BARE) {
    if (pattern.test(trimmed)) {
      return { intent: "pause", success: false, missingData: ["routine"] };
    }
  }

  // Pause with name
  for (const pattern of ROUTINE_PAUSE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractRoutineName(match[1].trim());
      const routineSlug = slugify(raw);

      if (!routineSlug) {
        return { intent: "pause", success: false, missingData: ["routine"] };
      }

      return { intent: "pause", routineSlug, success: true, missingData: [] };
    }
  }

  // Archive bare
  for (const pattern of ROUTINE_ARCHIVE_BARE) {
    if (pattern.test(trimmed)) {
      return { intent: "archive", success: false, missingData: ["routine"] };
    }
  }

  // Archive with name
  for (const pattern of ROUTINE_ARCHIVE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractRoutineName(match[1].trim());
      const routineSlug = slugify(raw);

      if (!routineSlug) {
        return { intent: "archive", success: false, missingData: ["routine"] };
      }

      return { intent: "archive", routineSlug, success: true, missingData: [] };
    }
  }

  return { intent: "unknown", success: false, missingData: ["routines_command"] };
}
