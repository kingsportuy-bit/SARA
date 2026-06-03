export interface ParsedAreasInput {
  intent: "create" | "list" | "archive" | "assign-note" | "assign-task" | "unknown";
  name?: string;
  slug?: string;
  description?: string;
  areaSlug?: string;
  entityType?: "note" | "task";
  entityId?: string;
  position?: number;
  titleMatch?: string;
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

function extractAreaName(raw: string): string {
  // Strip leading "area " or "al area " or "a la area " if present
  return raw.replace(/^(?:al\s+|a\s+la?\s+)?\s*area\s+/i, "").trim();
}

// Patterns that require a name after "area "
const AREA_CREATE_PATTERNS = [
  /^crear\s+area\s+(.+)/i,
  /^crea\s+area\s+(.+)/i,
  /^nueva\s+area\s+(.+)/i,
  /^agregar\s+area\s+(.+)/i,
];

// Patterns that detect create intent even without name
const AREA_CREATE_BARE_PATTERNS = [
  /^crear\s+area\s*$/i,
  /^crea\s+area\s*$/i,
  /^nueva\s+area\s*$/i,
  /^agregar\s+area\s*$/i,
];

const AREA_LIST_PATTERNS = [
  /^(?:que|mis)\s+areas\s+(?:tengo|hay|tienes|existen)/i,
  /^listar?\s*areas/i,
  /^lista\s*(?:mis\s*)?areas/i,
  /^mis\s*areas/i,
  /^areas\s*$/i,
  /^ver\s*areas/i,
  /^mostrar\s*areas/i,
];

const AREA_ARCHIVE_PATTERNS = [
  /^archivar\s+area\s+(.+)/i,
  /^archiva\s+area\s+(.+)/i,
  /^eliminar\s+area\s+(.+)/i,
];

const AREA_ARCHIVE_BARE_PATTERNS = [
  /^archivar\s+area\s*$/i,
  /^archiva\s+area\s*$/i,
  /^eliminar\s+area\s*$/i,
];

const AREA_ASSIGN_NOTE_PATTERNS = [
  /^asociar\s+(?:esa\s+)?nota\s+(?:al|a\s+la|a\s+el)\s+area\s+(.+)/i,
  /^asignar\s+(?:esa\s+)?nota\s+(?:al|a\s+la|a\s+el)\s+area\s+(.+)/i,
  /^mover\s+(?:esa\s+)?nota\s+(?:al|a\s+la|a\s+el)\s+area\s+(.+)/i,
  /^vincular\s+(?:esa\s+)?nota\s+(?:al|a\s+la|a\s+el)\s+area\s+(.+)/i,
];

const AREA_ASSIGN_NOTE_BARE_PATTERNS = [
  /^asociar\s+(?:esa\s+)?nota\s+(?:al|a\s+la|a\s+el)\s+area\s*$/i,
  /^asignar\s+(?:esa\s+)?nota\s+(?:al|a\s+la|a\s+el)\s+area\s*$/i,
  /^mover\s+(?:esa\s+)?nota\s+(?:al|a\s+la|a\s+el)\s+area\s*$/i,
  /^vincular\s+(?:esa\s+)?nota\s+(?:al|a\s+la|a\s+el)\s+area\s*$/i,
];

const AREA_ASSIGN_TASK_PATTERNS = [
  /^asociar\s+(?:esa\s+)?tarea\s+(?:al|a\s+la|a\s+el)\s+area\s+(.+)/i,
  /^asignar\s+(?:esa\s+|la\s+ultima\s+|ultima\s+)?tarea\s+(?:al|a\s+la|a\s+el)\s+area\s+(.+)/i,
  /^mover\s+(?:esa\s+)?tarea\s+(?:al|a\s+la|a\s+el)\s+area\s+(.+)/i,
  /^vincular\s+(?:esa\s+)?tarea\s+(?:al|a\s+la|a\s+el)\s+area\s+(.+)/i,
  /^asociar\s+(?:la\s+)?ultima\s+tarea\s+(?:a|al|a\s+la)\s+(.+)/i,
  /^asignar\s+(?:la\s+)?ultima\s+tarea\s+(?:a|al|a\s+la)\s+(.+)/i,
];

const AREA_ASSIGN_TASK_BARE_PATTERNS = [
  /^asociar\s+(?:esa\s+)?tarea\s+(?:al|a\s+la|a\s+el)\s+area\s*$/i,
  /^asignar\s+(?:esa\s+|la\s+ultima\s+|ultima\s+)?tarea\s+(?:al|a\s+la|a\s+el)\s+area\s*$/i,
  /^mover\s+(?:esa\s+)?tarea\s+(?:al|a\s+la|a\s+el)\s+area\s*$/i,
  /^vincular\s+(?:esa\s+)?tarea\s+(?:al|a\s+la|a\s+el)\s+area\s*$/i,
];

export function parseAreasInput(text: string): ParsedAreasInput {
  if (!text) {
    return { intent: "unknown", success: false, missingData: ["areas_command"] };
  }

  const trimmed = text.trim();

  // Check create bare patterns (no name provided)
  for (const pattern of AREA_CREATE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "create", success: false, missingData: ["areaName"] };
    }
  }

  // Check create patterns
  for (const pattern of AREA_CREATE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const name = match[1].trim();
      const slug = slugify(name);
      if (!slug) {
        return { intent: "create", name, success: false, missingData: ["areaName"] };
      }
      return { intent: "create", name, slug, success: true, missingData: [] };
    }
  }

  // Check list patterns
  for (const pattern of AREA_LIST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "list", success: true, missingData: [] };
    }
  }

  // Check archive bare patterns
  for (const pattern of AREA_ARCHIVE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "archive", success: false, missingData: ["area"] };
    }
  }

  // Check archive patterns
  for (const pattern of AREA_ARCHIVE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractAreaName(match[1].trim());
      const areaSlug = slugify(raw);
      if (!areaSlug) {
        return { intent: "archive", success: false, missingData: ["area"] };
      }
      return { intent: "archive", areaSlug, success: true, missingData: [] };
    }
  }

  // Check assign note bare patterns
  for (const pattern of AREA_ASSIGN_NOTE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "assign-note", entityType: "note", success: false, missingData: ["area"] };
    }
  }

  // Check assign note patterns
  for (const pattern of AREA_ASSIGN_NOTE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractAreaName(match[1].trim());
      const areaSlug = slugify(raw);
      if (!areaSlug) {
        return { intent: "assign-note", entityType: "note", success: false, missingData: ["area"] };
      }
      return { intent: "assign-note", areaSlug, entityType: "note", success: true, missingData: [] };
    }
  }

  // Check assign task bare patterns
  for (const pattern of AREA_ASSIGN_TASK_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "assign-task", entityType: "task", success: false, missingData: ["area"] };
    }
  }

  // Check assign task patterns
  for (const pattern of AREA_ASSIGN_TASK_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractAreaName(match[1].trim());
      const areaSlug = slugify(raw);
      if (!areaSlug) {
        return { intent: "assign-task", entityType: "task", success: false, missingData: ["area"] };
      }
      return { intent: "assign-task", areaSlug, entityType: "task", success: true, missingData: [] };
    }
  }

  return { intent: "unknown", success: false, missingData: ["areas_command"] };
}
