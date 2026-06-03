export const NOTE_COMMAND_PATTERN =
  /^(?:nota|guarda una nota|anota esto|anotar|guardar nota|crea una nota|crear nota)[\s:]+(.*)/i;

export const NOTE_TYPE_PATTERN =
  /^(?:aprendizaje|idea|problema|riesgo|mejora|observacion)[\s:]+(.*)/i;

export const NOTE_PREFIX_PATTERNS = [
  /^nota[\s:]/i,
  /^guarda una nota[\s:]/i,
  /^anota esto[\s:]/i,
  /^anotar[\s:]/i,
  /^guardar nota[\s:]/i,
  /^crea una nota[\s:]/i,
  /^crear nota[\s:]/i,
  /^aprendizaje[\s:]/i,
  /^idea[\s:]/i,
  /^problema[\s:]/i,
  /^riesgo[\s:]/i,
  /^mejora[\s:]/i,
  /^observacion[\s:]/i,
];

export const NOTE_PREFIX_REMOVE = NOTE_COMMAND_PATTERN;

export const NOTE_LIST_PATTERNS = [
  /que notas (tengo|hay|tienes|existen)/i,
  /listar?\s*notas/i,
  /lista\s*(mis\s*)?notas/i,
  /ultimas?\s*notas/i,
  /ver\s*notas/i,
  /mostrar\s*notas/i,
  /mis\s*notas/i,
];

export const NOTE_SEARCH_PATTERNS = [
  /busc[ao]r?\s*notas?\s*(?:sobre\s*|de\s*)?(.+)/i,
  /notas?\s*(?:sobre\s*|de\s*tipo\s*)(.+)/i,
];

export function matchesNotePrefix(text: string): boolean {
  if (!text) return false;
  return NOTE_PREFIX_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesNoteListQuery(text: string): boolean {
  if (!text) return false;
  return NOTE_LIST_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesNoteSearchQuery(text: string): boolean {
  if (!text) return false;
  return NOTE_SEARCH_PATTERNS.some((pattern) => pattern.test(text));
}

export function extractSearchQuery(text: string): string | null {
  for (const pattern of NOTE_SEARCH_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match[1] && match[1].trim()) return match[1].trim();
  }
  return null;
}

export const TASK_COMMAND_PATTERN =
  /^(?:tarea|crear tarea|agregar tarea|crea una tarea)[\s:]+(.*)/i;

export const TASK_CREATE_PATTERNS = [
  /^tarea[\s:]/i,
  /^crear tarea[\s:]/i,
  /^crea una tarea[\s:]/i,
  /^agregar tarea[\s:]/i,
  /^tengo que\b/i,
  /^debo\b/i,
  /^pendiente[\s:]/i,
];

export const TASK_LIST_PATTERNS = [
  /que tareas (tengo|hay|tienes|existen)/i,
  /listar?\s*tareas/i,
  /lista\s*(mis\s*)?tareas/i,
  /mis\s*tareas/i,
  /tareas\s*pendientes/i,
];

export const TASK_COMPLETE_PATTERNS = [
  /completar\s*tarea\s*(\d+|.+)/i,
  /marcar\s*tarea\s*(\d+|.+)\s*(?:como\s*hech[oa])?/i,
  /complete\s+(.+)/i,
  /termine\s+(.+)/i,
];

const TASK_COMPLETE_BARE_PATTERNS = [
  /^completar\s*tarea\s*$/i,
  /^marcar\s*tarea\s*$/i,
];

export const TASK_REFERENCE_PATTERNS = [
  /^(?:completar|marcar)\s+(?:la\s+)?(?:ultima|anterior|esa)\s*(?:tarea)?(?:\s+(?:como\s+)?hech[oa])?$/i,
  /^(?:marcar)\s+(?:esa)\s+(?:como\s+)?hech[oa]$/i,
];

export function matchesTaskCreate(text: string): boolean {
  if (!text) return false;
  return TASK_CREATE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesTaskListQuery(text: string): boolean {
  if (!text) return false;
  return TASK_LIST_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesTaskComplete(text: string): boolean {
  if (!text) return false;
  return TASK_COMPLETE_PATTERNS.some((pattern) => pattern.test(text)) ||
    TASK_COMPLETE_BARE_PATTERNS.some((pattern) => pattern.test(text)) ||
    TASK_REFERENCE_PATTERNS.some((pattern) => pattern.test(text));
}

export function extractTaskTitle(text: string): string {
  const match = TASK_COMMAND_PATTERN.exec(text);
  if (match) {
    if (match[1] && match[1].trim()) return match[1].trim();
    return "";
  }
  for (const pattern of TASK_CREATE_PATTERNS) {
    const m = pattern.exec(text);
    if (m) {
      const after = text.slice(m[0].length).trim();
      if (after) return after;
    }
  }
  return text;
}

export function extractCompleteTaskIdentifier(text: string): { position?: number; titleMatch?: string } | null {
  for (const pattern of TASK_COMPLETE_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match[1] && match[1].trim()) {
      const raw = match[1].trim();
      const num = Number(raw);
      if (!isNaN(num) && num > 0) {
        return { position: num };
      }
      return { titleMatch: raw };
    }
  }
  return null;
}

export function extractNoteContent(text: string): string {
  const match = NOTE_COMMAND_PATTERN.exec(text);
  if (match) {
    if (match[1] && match[1].trim()) return match[1].trim();
    return "";
  }
  const typeMatch = NOTE_TYPE_PATTERN.exec(text);
  if (typeMatch) {
    if (typeMatch[1] && typeMatch[1].trim()) return typeMatch[1].trim();
    return "";
  }
  return text;
}

export function matchesTaskReference(text: string): boolean {
  if (!text) return false;
  return TASK_REFERENCE_PATTERNS.some((pattern) => pattern.test(text));
}

export interface ResolvedTaskReference {
  taskId?: string;
  position?: number;
  title?: string;
}

export function resolveTaskReference(
  sessionContext: {
    focusedEntityType?: string;
    focusedEntityId?: string;
    context?: Record<string, unknown>;
  } | undefined,
): ResolvedTaskReference | null {
  if (!sessionContext) return null;

  if (sessionContext.focusedEntityType === "task" && sessionContext.focusedEntityId) {
    return { taskId: sessionContext.focusedEntityId };
  }

  const lastTaskList = sessionContext.context?.lastTaskList as Array<{ position: number; id: string; title: string }> | undefined;
  if (lastTaskList && Array.isArray(lastTaskList)) {
    if (lastTaskList.length === 1) {
      return { taskId: lastTaskList[0].id };
    }
  }

  return null;
}
