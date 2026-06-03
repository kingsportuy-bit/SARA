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

const CHATWOOT_HEADER = /^\*\*.+?\*\*\s*/;

export function stripChatwootHeader(text: string): string {
  if (!text) return "";
  return text.replace(CHATWOOT_HEADER, "").trim();
}

export function matchesNotePrefix(text: string): boolean {
  if (!text) return false;
  return NOTE_PREFIX_PATTERNS.some((pattern) => pattern.test(text));
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
