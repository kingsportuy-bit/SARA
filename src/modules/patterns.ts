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
