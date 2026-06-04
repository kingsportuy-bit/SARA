export interface ParsedObjectivesInput {
  intent: "create" | "list" | "achieve" | "archive" | "assign-task" | "unknown";
  title?: string;
  slug?: string;
  description?: string;
  areaSlug?: string;
  targetDate?: string;
  successCriteria: string[];
  objectiveSlug?: string;
  taskId?: string;
  success: boolean;
  missingData: string[];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractObjectiveName(raw: string): string {
  return raw.replace(/^(?:al\s+|a\s+la?\s+)?\s*objetivo\s+/i, "").trim();
}

const OBJECTIVE_CREATE_PATTERNS = [
  /^crear\s+objetivo\s+(.+)/i,
  /^crea\s+objetivo\s+(.+)/i,
  /^nuevo\s+objetivo\s+(.+)/i,
  /^agregar\s+objetivo\s+(.+)/i,
];

const OBJECTIVE_CREATE_BARE_PATTERNS = [
  /^crear\s+objetivo\s*$/i,
  /^crea\s+objetivo\s*$/i,
  /^nuevo\s+objetivo\s*$/i,
  /^agregar\s+objetivo\s*$/i,
];

const OBJECTIVE_LIST_PATTERNS = [
  /^(?:que|mis)\s+objetivos\s+(?:tengo|hay|tienes|existen)/i,
  /^listar?\s*objetivos/i,
  /^lista\s*(?:mis\s*)?objetivos/i,
  /^mis\s*objetivos/i,
  /^objetivos\s*$/i,
  /^ver\s*objetivos/i,
  /^mostrar\s*objetivos/i,
];

const OBJECTIVE_ACHIEVE_PATTERNS = [
  /^(?:logr[eé]|marcar)\s+(?:objetivo\s+)?(.+?)\s+como\s+logrado/i,
  /^logr[eé]\s+objetivo\s+(.+)/i,
  /^marcar\s+objetivo\s+(.+)/i,
  /^(?:objetivo\s+)?logrado\s+(.+)/i,
  /^consegu[ií]\s+objetivo\s+(.+)/i,
];

const OBJECTIVE_ACHIEVE_BARE_PATTERNS = [
  /^(?:logr[eé]|marcar)\s+objetivo\s*$/i,
  /^consegu[ií]\s+objetivo\s*$/i,
];

const OBJECTIVE_ARCHIVE_PATTERNS = [
  /^archivar\s+objetivo\s+(.+)/i,
  /^archiva\s+objetivo\s+(.+)/i,
  /^descarta[r]\s+objetivo\s+(.+)/i,
];

const OBJECTIVE_ARCHIVE_BARE_PATTERNS = [
  /^archivar\s+objetivo\s*$/i,
  /^archiva\s+objetivo\s*$/i,
];

const OBJECTIVE_ASSIGN_TASK_PATTERNS = [
  /^asociar\s+(?:esa\s+)?tarea\s+(?:al|a\s+la?)\s+objetivo\s+(.+)/i,
  /^asignar\s+(?:esa\s+|la\s+ultima\s+|ultima\s+)?tarea\s+(?:al|a\s+la?)\s+objetivo\s+(.+)/i,
  /^vincular\s+(?:esa\s+)?tarea\s+(?:al|a\s+la?)\s+objetivo\s+(.+)/i,
  /^asociar\s+(?:la\s+)?ultima\s+tarea\s+(?:al\s+)?objetivo\s+(.+)/i,
  /^asignar\s+(?:la\s+)?ultima\s+tarea\s+(?:al\s+)?objetivo\s+(.+)/i,
];

const OBJECTIVE_ASSIGN_TASK_BARE_PATTERNS = [
  /^asociar\s+(?:esa\s+)?tarea\s+(?:al|a\s+la?)\s+objetivo\s*$/i,
  /^asignar\s+(?:esa\s+|la\s+ultima\s+|ultima\s+)?tarea\s+(?:al|a\s+la?)\s+objetivo\s*$/i,
  /^vincular\s+(?:esa\s+)?tarea\s+(?:al|a\s+la?)\s+objetivo\s*$/i,
];

function extractAreaAndCriteriaFromTitle(rawTitle: string): { cleanTitle: string; areaSlug?: string; targetDate?: string; successCriteria: string[] } {
  let remaining = rawTitle.trim();
  let areaSlug: string | undefined;
  let targetDate: string | undefined;
  const successCriteria: string[] = [];

  // Extract targetDate: "para YYYY-MM-DD"
  const dateMatch = remaining.match(/\bpara\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (dateMatch && dateMatch[1]) {
    targetDate = dateMatch[1];
    remaining = remaining.replace(dateMatch[0], "").trim();
  }

  // Extract area: "area X" at the end
  const areaMatch = remaining.match(/\barea\s+([a-z0-9\s]+)$/i);
  if (areaMatch && areaMatch[1]) {
    areaSlug = slugify(areaMatch[1].trim());
    remaining = remaining.replace(areaMatch[0], "").trim();
  }

  // Extract successCriteria: "criterio: X" or "criterios: X, Y, Z"
  const criteriaMatch = remaining.match(/\b(?:criterio|criterios)\s*:\s*(.+)/i);
  if (criteriaMatch && criteriaMatch[1]) {
    const criteriaText = criteriaMatch[1].trim();
    const split = criteriaText.split(/[,;]\s*/);
    for (const c of split) {
      const trimmed = c.trim();
      if (trimmed) successCriteria.push(trimmed);
    }
    remaining = remaining.replace(criteriaMatch[0], "").trim();
  }

  return { cleanTitle: remaining, areaSlug, targetDate, successCriteria };
}

export function parseObjectivesInput(text: string): ParsedObjectivesInput {
  if (!text) {
    return { intent: "unknown", success: false, missingData: ["objectives_command"], successCriteria: [] };
  }

  const trimmed = text.trim();

  // Check create bare patterns (no title)
  for (const pattern of OBJECTIVE_CREATE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "create", success: false, missingData: ["objectiveTitle"], successCriteria: [] };
    }
  }

  // Check create patterns
  for (const pattern of OBJECTIVE_CREATE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const rawTitle = match[1].trim();
      const { cleanTitle, areaSlug, targetDate, successCriteria } = extractAreaAndCriteriaFromTitle(rawTitle);
      const slug = slugify(cleanTitle);
      if (!slug) {
        return { intent: "create", title: cleanTitle, success: false, missingData: ["objectiveTitle"], successCriteria };
      }
      return { intent: "create", title: cleanTitle, slug, areaSlug, targetDate, successCriteria, success: true, missingData: [] };
    }
  }

  // Check list patterns
  for (const pattern of OBJECTIVE_LIST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "list", success: true, missingData: [], successCriteria: [] };
    }
  }

  // Check achieve bare patterns
  for (const pattern of OBJECTIVE_ACHIEVE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "achieve", success: false, missingData: ["objective"], successCriteria: [] };
    }
  }

  // Check achieve patterns
  for (const pattern of OBJECTIVE_ACHIEVE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractObjectiveName(match[1].trim());
      const objectiveSlug = slugify(raw);
      if (!objectiveSlug) {
        return { intent: "achieve", success: false, missingData: ["objective"], successCriteria: [] };
      }
      return { intent: "achieve", objectiveSlug, success: true, missingData: [], successCriteria: [] };
    }
  }

  // Check archive bare patterns
  for (const pattern of OBJECTIVE_ARCHIVE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "archive", success: false, missingData: ["objective"], successCriteria: [] };
    }
  }

  // Check archive patterns
  for (const pattern of OBJECTIVE_ARCHIVE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractObjectiveName(match[1].trim());
      const objectiveSlug = slugify(raw);
      if (!objectiveSlug) {
        return { intent: "archive", success: false, missingData: ["objective"], successCriteria: [] };
      }
      return { intent: "archive", objectiveSlug, success: true, missingData: [], successCriteria: [] };
    }
  }

  // Check assign task bare patterns
  for (const pattern of OBJECTIVE_ASSIGN_TASK_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "assign-task", success: false, missingData: ["objective"], successCriteria: [] };
    }
  }

  // Check assign task patterns
  for (const pattern of OBJECTIVE_ASSIGN_TASK_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractObjectiveName(match[1].trim());
      const objectiveSlug = slugify(raw);
      if (!objectiveSlug) {
        return { intent: "assign-task", success: false, missingData: ["objective"], successCriteria: [] };
      }
      return { intent: "assign-task", objectiveSlug, success: true, missingData: [], successCriteria: [] };
    }
  }

  return { intent: "unknown", success: false, missingData: ["objectives_command"], successCriteria: [] };
}
