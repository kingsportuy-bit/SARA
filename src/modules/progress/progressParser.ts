export interface ParsedProgressInput {
  intent: "workout" | "objective" | "summary" | "unknown";
  exerciseName?: string;
  objectiveSlug?: string;
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

function extractExerciseName(raw: string): string {
  return raw.replace(/^(?:con\s+|en\s+|de\s+|del\s+|ejercicio\s+)?/i, "").trim();
}

const WORKOUT_PROGRESS_PATTERNS = [
  /^como\s+(?:voy|vengo|estoy)\s+con\s+(.+)/i,
  /^(?:como\s+)?(?:va|viene)\s+(?:mi\s+)?progreso\s+(?:con\s+|en\s+)?(.+)/i,
  /^progreso\s+de\s+ejercicio\s+(.+)/i,
  /^progreso\s+(?:con\s+|en\s+)?(.+)/i,
  /^(?:ver|mostrar|dame)\s+progreso\s+(?:de\s+|del\s+|con\s+|en\s+)?(.+)/i,
  /^(?:como\s+)?(?:va|viene)\s+(?:la\s+|el\s+)?(.+)/i,
];

const SUMMARY_PATTERNS = [
  /^resumen\s+de\s+progreso/i,
  /^progreso\s+general/i,
  /^como\s+(?:voy|vengo|estoy)\s+en\s+general/i,
  /^(?:ver|mostrar|dame)\s+mi\s+progreso/i,
  /^mi\s+progreso/i,
  /^(?:como\s+)?(?:va|viene)\s+todo/i,
];

export function parseProgressInput(text: string): ParsedProgressInput {
  if (!text) {
    return { intent: "unknown", success: false, missingData: ["progress_command"] };
  }

  const trimmed = text.trim();

  // Check for objective progress patterns first (they have "objetivo" keyword)
  const objectivePatterns = [
    /^progreso\s+(?:del\s+|de\s+|del\s+)?objetivo\s+(.+)/i,
    /^como\s+(?:voy|vengo|estoy)\s+con\s+(?:el\s+|mi\s+|la\s+)?objetivo\s+(.+)/i,
    /^(?:como\s+)?(?:va|viene)\s+(?:el\s+|mi\s+)?objetivo\s+(.+)/i,
    /^(?:ver|mostrar|dame)\s+progreso\s+(?:del\s+|de\s+|del\s+)?objetivo\s+(.+)/i,
  ];

  // Check for objective progress with bare name (no "objetivo" keyword but matches energy/finance names)
  const objectiveBarePatterns = [
    /^como\s+(?:voy|vengo)\s+con\s+mi\s+(energia|enfoque|foco|disciplina|productividad|descanso)/i,
    /^(?:como\s+)?(?:va|viene)\s+mi\s+(energia|enfoque|foco|disciplina|productividad|descanso)/i,
  ];

  for (const pattern of objectivePatterns) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const rawName = match[1].trim();
      const objectiveSlug = slugify(rawName);
      if (!objectiveSlug) {
        return { intent: "objective", success: false, missingData: ["objective"] };
      }
      return { intent: "objective", objectiveSlug, success: true, missingData: [] };
    }
  }

  for (const pattern of objectiveBarePatterns) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const rawName = match[1].trim();
      const objectiveSlug = slugify(rawName);
      return { intent: "objective", objectiveSlug, success: true, missingData: [] };
    }
  }

  // Check for summary patterns
  for (const pattern of SUMMARY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "summary", success: true, missingData: [] };
    }
  }

  // Check for workout progress patterns
  for (const pattern of WORKOUT_PROGRESS_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const exerciseName = extractExerciseName(match[1].trim());
      if (!exerciseName) {
        return { intent: "workout", success: false, missingData: ["exerciseName"] };
      }
      return { intent: "workout", exerciseName, success: true, missingData: [] };
    }
  }

  return { intent: "unknown", success: false, missingData: ["progress_command"] };
}
