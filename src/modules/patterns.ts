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

export const REMINDER_CREATE_PATTERNS = [
  /recordame\b/i,
  /recuerdame\b/i,
  /crear\s+recordatorio\b/i,
  /agendar\s+recordatorio\b/i,
  /crea\s+un\s+recordatorio\b/i,
  /agenda\s+un\s+recordatorio\b/i,
];

export const REMINDER_LIST_PATTERNS = [
  /que\s+recordatorios\s+(tengo|hay|tienes|existen)/i,
  /listar?\s*recordatorios/i,
  /lista\s*(mis\s*)?recordatorios/i,
  /mis\s*recordatorios/i,
  /recordatorios\s*pendientes/i,
  /ver\s*recordatorios/i,
];

export const REMINDER_CANCEL_PATTERNS = [
  /cancelar\s*recordatorio\s*(\d+|.+)/i,
  /eliminar\s*recordatorio\s*(\d+|.+)/i,
  /borrar\s*recordatorio\s*(\d+|.+)/i,
  /quitar\s*recordatorio\s*(\d+|.+)/i,
];

export const REMINDER_REFERENCE_PATTERNS = [
  /^(?:cancelar|eliminar|borrar)\s+(?:el\s+)?(?:ultimo|ese|aquel|aquel)\s*(?:recordatorio)?$/i,
];

export function matchesReminderCreate(text: string): boolean {
  if (!text) return false;
  return REMINDER_CREATE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesReminderListQuery(text: string): boolean {
  if (!text) return false;
  return REMINDER_LIST_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesReminderCancel(text: string): boolean {
  if (!text) return false;
  return REMINDER_CANCEL_PATTERNS.some((pattern) => pattern.test(text)) ||
    REMINDER_REFERENCE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesReminderReference(text: string): boolean {
  if (!text) return false;
  return REMINDER_REFERENCE_PATTERNS.some((pattern) => pattern.test(text));
}

export function extractCancelReminderIdentifier(text: string): { position?: number; titleMatch?: string } | null {
  for (const pattern of REMINDER_CANCEL_PATTERNS) {
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

export interface ResolvedReminderReference {
  reminderId?: string;
  position?: number;
  title?: string;
}

export function resolveReminderReference(
  sessionContext: {
    focusedEntityType?: string;
    focusedEntityId?: string;
    context?: Record<string, unknown>;
  } | undefined,
): ResolvedReminderReference | null {
  if (!sessionContext) return null;

  if (sessionContext.focusedEntityType === "reminder" && sessionContext.focusedEntityId) {
    return { reminderId: sessionContext.focusedEntityId };
  }

  const lastReminderList = sessionContext.context?.lastReminderList as Array<{ position: number; id: string; title: string }> | undefined;
  if (lastReminderList && Array.isArray(lastReminderList)) {
    if (lastReminderList.length === 1) {
      return { reminderId: lastReminderList[0].id };
    }
  }

  return null;
}

export const DAILY_LOG_MORNING_PATTERNS = [
  /\bbuen\s*d[ií]a\b/i,
  /\bbuenas\b/,
  /\bcheckin\s+ma[nñ]ana\b/i,
  /\bcheck[\s-]*in\s+ma[nñ]ana\b/i,
  /\benergia\b/i,
  /\bdormi\b/i,
  /\bintencion\b/i,
];

export const DAILY_LOG_EVENING_PATTERNS = [
  /\bcierre\s+del\s+d[ií]a\b/i,
  /\bcierre\s+de\s+hoy\b/i,
  /\bcierre\s+diario\b/i,
  /\bfin\s+del\s+d[ií]a\b/i,
];

export const DAILY_LOG_SUMMARY_PATTERNS = [
  /\bresumen\s+del\s+d[ií]a\b/i,
  /\bcomo\s+estuvo\s+mi\s+d[ií]a\b/i,
  /\bque\s+tal\s+mi\s+d[ií]a\b/i,
  /\bver\s+mi\s+d[ií]a\b/i,
  /\bmi\s+d[ií]a\s+de\s+hoy\b/i,
];

export function matchesDailyLogMorning(text: string): boolean {
  if (!text) return false;
  return DAILY_LOG_MORNING_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesDailyLogEvening(text: string): boolean {
  if (!text) return false;
  return DAILY_LOG_EVENING_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesDailyLogSummary(text: string): boolean {
  if (!text) return false;
  return DAILY_LOG_SUMMARY_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesDailyLogQuery(text: string): boolean {
  return matchesDailyLogMorning(text) || matchesDailyLogEvening(text) || matchesDailyLogSummary(text);
}

export function extractReminderTitle(text: string): string {
  for (const pattern of REMINDER_CREATE_PATTERNS) {
    const m = pattern.exec(text);
    if (m) {
      const after = text.slice(m[0].length).trim();
      if (!after) return "";

      const timeMin = after.match(/(?:^|\s)en\s+\d+\s*(?:minutos?|horas?|dias?)\s*/i);
      const timeHoy = after.match(/(?:^|\s)hoy\s+a\s+las\s+\d{1,2}(?::\d{2})?\s*/i);
      const timeManana = after.match(/(?:^|\s)(?:mañana|manana)\s+a\s+las\s+\d{1,2}(?::\d{2})?\s*/i);
      let result = after;
      if (timeMin) result = after.slice(timeMin[0].length).trim();
      else if (timeHoy) result = after.slice(timeHoy[0].length).trim();
      else if (timeManana) result = after.slice(timeManana[0].length).trim();
      return result || "";
    }
  }
  return text;
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

// -- Area patterns --

export const AREA_CREATE_PATTERNS = [
  /^crear\s+area\b/i,
  /^crea\s+area\b/i,
  /^nueva\s+area\b/i,
  /^agregar\s+area\b/i,
];

export const AREA_LIST_PATTERNS = [
  /^(?:que|mis)\s+areas\s+(?:tengo|hay|tienes|existen)/i,
  /^listar?\s*areas/i,
  /^lista\s*(?:mis\s*)?areas/i,
  /^mis\s*areas/i,
  /^areas\s*$/i,
  /^ver\s*areas/i,
  /^mostrar\s*areas/i,
];

export const AREA_ARCHIVE_PATTERNS = [
  /^archivar\s+area\b/i,
  /^archiva\s+area\b/i,
  /^eliminar\s+area\b/i,
];

export const AREA_ASSIGN_PATTERNS = [
  /^asociar\b/i,
  /^asignar\b/i,
  /^mover\b/i,
  /^vincular\b/i,
];

export function matchesAreaCreate(text: string): boolean {
  if (!text) return false;
  return AREA_CREATE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesAreaListQuery(text: string): boolean {
  if (!text) return false;
  return AREA_LIST_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesAreaArchive(text: string): boolean {
  if (!text) return false;
  return AREA_ARCHIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesAreaAssign(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (!/\barea\b/i.test(lower)) return false;
  return AREA_ASSIGN_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesAreaQuery(text: string): boolean {
  return matchesAreaCreate(text) || matchesAreaListQuery(text) || matchesAreaArchive(text) || matchesAreaAssign(text);
}

export interface ResolvedNoteReference {
  noteId?: string;
}

export function resolveNoteReference(
  sessionContext: {
    focusedEntityType?: string;
    focusedEntityId?: string;
    context?: Record<string, unknown>;
  } | undefined,
): ResolvedNoteReference | null {
  if (!sessionContext) return null;

  if (sessionContext.focusedEntityType === "note" && sessionContext.focusedEntityId) {
    return { noteId: sessionContext.focusedEntityId };
  }

  return null;
}

// -- Objective patterns --

export const OBJECTIVE_CREATE_PATTERNS = [
  /^crear\s+objetivo\b/i,
  /^crea\s+objetivo\b/i,
  /^nuevo\s+objetivo\b/i,
  /^agregar\s+objetivo\b/i,
];

export const OBJECTIVE_LIST_PATTERNS = [
  /^(?:que|mis)\s+objetivos\s+(?:tengo|hay|tienes|existen)/i,
  /^listar?\s*objetivos/i,
  /^lista\s*(?:mis\s*)?objetivos/i,
  /^mis\s*objetivos/i,
  /^objetivos\s*$/i,
  /^ver\s*objetivos/i,
  /^mostrar\s*objetivos/i,
];

export const OBJECTIVE_ACHIEVE_PATTERNS = [
  /^logr[e\u00e9]\s+objetivo\b/i,
  /^marcar\s+objetivo\b/i,
  /^objetivo\s+logrado\b/i,
  /^consegu[i\u00ed]\s+objetivo\b/i,
];

export const OBJECTIVE_ARCHIVE_PATTERNS = [
  /^archivar\s+objetivo\b/i,
  /^archiva\s+objetivo\b/i,
  /^descarta[r]\s+objetivo\b/i,
];

export const OBJECTIVE_ASSIGN_PATTERNS = [
  /^asociar\b/i,
  /^asignar\b/i,
  /^vincular\b/i,
];

export function matchesObjectiveCreate(text: string): boolean {
  if (!text) return false;
  return OBJECTIVE_CREATE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesObjectiveListQuery(text: string): boolean {
  if (!text) return false;
  return OBJECTIVE_LIST_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesObjectiveAchieve(text: string): boolean {
  if (!text) return false;
  return OBJECTIVE_ACHIEVE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesObjectiveArchive(text: string): boolean {
  if (!text) return false;
  return OBJECTIVE_ARCHIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesObjectiveAssign(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (!/\bobjetivo\b/i.test(lower)) return false;
  return OBJECTIVE_ASSIGN_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesObjectiveQuery(text: string): boolean {
  return matchesObjectiveCreate(text) || matchesObjectiveListQuery(text) || matchesObjectiveAchieve(text) || matchesObjectiveArchive(text) || matchesObjectiveAssign(text);
}
