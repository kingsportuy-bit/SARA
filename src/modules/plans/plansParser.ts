export interface ParsedPlansInput {
  intent: "create" | "list" | "archive" | "complete-step" | "unknown";
  title?: string;
  slug?: string;
  description?: string;
  objectiveSlug?: string;
  planSlug?: string;
  steps: string[];
  stepPosition?: number;
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

function extractPlanName(raw: string): string {
  return raw.replace(/^(?:al\s+|a\s+la?\s+)?\s*plan\s+/i, "").trim();
}

function parseSteps(rawSteps: string): string[] {
  return rawSteps
    .split(/\s*;\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const PLAN_CREATE_PATTERNS = [
  /^crear\s+plan\s+(.+)/i,
  /^crea\s+plan\s+(.+)/i,
  /^nuevo\s+plan\s+(.+)/i,
  /^agregar\s+plan\s+(.+)/i,
  /^crear\s+plan\s+para\s+(?:objetivo\s+)?(.+)/i,
  /^nuevo\s+plan\s+para\s+(?:objetivo\s+)?(.+)/i,
];

const PLAN_CREATE_BARE_PATTERNS = [
  /^crear\s+plan\s*$/i,
  /^crea\s+plan\s*$/i,
  /^nuevo\s+plan\s*$/i,
  /^agregar\s+plan\s*$/i,
];

const PLAN_LIST_PATTERNS = [
  /^(?:que|mis)\s+planes\s+(?:tengo|hay|tienes|existen)/i,
  /^listar?\s*planes/i,
  /^lista\s*(?:mis\s*)?planes/i,
  /^mis\s*planes/i,
  /^planes\s*$/i,
  /^ver\s*planes/i,
  /^mostrar\s*planes/i,
];

const PLAN_ARCHIVE_PATTERNS = [
  /^archivar\s+plan\s+(.+)/i,
  /^archiva\s+plan\s+(.+)/i,
  /^descarta[r]\s+plan\s+(.+)/i,
];

const PLAN_ARCHIVE_BARE_PATTERNS = [
  /^archivar\s+plan\s*$/i,
  /^archiva\s+plan\s*$/i,
];

const PLAN_COMPLETE_STEP_PATTERNS = [
  /^completar\s+paso\s+(\d+)\s+del\s+plan\s+(.+)/i,
  /^completa\s+paso\s+(\d+)\s+del\s+plan\s+(.+)/i,
  /^marcar\s+paso\s+(\d+)\s+del\s+plan\s+(.+)/i,
  /^terminar\s+paso\s+(\d+)\s+del\s+plan\s+(.+)/i,
  /^paso\s+(\d+)\s+del\s+plan\s+(.+?)\s+completado/i,
];

const PLAN_COMPLETE_STEP_BARE_PATTERNS = [
  /^completar\s+paso\s*$/i,
  /^completa\s+paso\s*$/i,
];

function extractObjectiveFromTitle(rawTitle: string): { cleanTitle: string; objectiveSlug?: string } {
  let remaining = rawTitle.trim();
  let objectiveSlug: string | undefined;

  const paraObjMatch = remaining.match(/^para\s+objetivo\s+(.+)/i);
  if (paraObjMatch && paraObjMatch[1]) {
    objectiveSlug = slugify(paraObjMatch[1].trim());
    remaining = paraObjMatch[1].trim();
    return { cleanTitle: remaining, objectiveSlug };
  }

  const objMatch = remaining.match(/^objetivo\s+(.+)/i);
  if (objMatch && objMatch[1]) {
    objectiveSlug = slugify(objMatch[1].trim());
    remaining = objMatch[1].trim();
    return { cleanTitle: remaining, objectiveSlug };
  }

  return { cleanTitle: remaining, objectiveSlug };
}

export function parsePlansInput(text: string): ParsedPlansInput {
  if (!text) {
    return { intent: "unknown", success: false, missingData: ["plans_command"], steps: [] };
  }

  const trimmed = text.trim();

  // Bare create patterns
  for (const pattern of PLAN_CREATE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "create", success: false, missingData: ["planTitle"], steps: [] };
    }
  }

  // Full create patterns
  for (const pattern of PLAN_CREATE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = match[1].trim();

      // Extract steps after colon
      const colonIndex = raw.indexOf(":");
      let planPart = raw;
      let stepsText = "";

      if (colonIndex > 0) {
        planPart = raw.substring(0, colonIndex).trim();
        stepsText = raw.substring(colonIndex + 1).trim();
      }

      const { cleanTitle, objectiveSlug } = extractObjectiveFromTitle(planPart);
      const slug = slugify(cleanTitle);

      if (!slug) {
        return { intent: "create", title: cleanTitle, success: false, missingData: ["planTitle"], steps: [] };
      }

      const steps = parseSteps(stepsText);

      return {
        intent: "create",
        title: cleanTitle,
        slug,
        objectiveSlug,
        steps,
        success: true,
        missingData: steps.length === 0 ? ["planSteps"] : [],
      };
    }
  }

  // List patterns
  for (const pattern of PLAN_LIST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "list", success: true, missingData: [], steps: [] };
    }
  }

  // Bare archive patterns
  for (const pattern of PLAN_ARCHIVE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "archive", success: false, missingData: ["plan"], steps: [] };
    }
  }

  // Full archive patterns
  for (const pattern of PLAN_ARCHIVE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractPlanName(match[1].trim());
      const planSlug = slugify(raw);
      if (!planSlug) {
        return { intent: "archive", success: false, missingData: ["plan"], steps: [] };
      }
      return { intent: "archive", planSlug, success: true, missingData: [], steps: [] };
    }
  }

  // Bare complete-step patterns
  for (const pattern of PLAN_COMPLETE_STEP_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "complete-step", success: false, missingData: ["plan", "stepPosition"], steps: [] };
    }
  }

  // Full complete-step patterns
  for (const pattern of PLAN_COMPLETE_STEP_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[2]) {
      const position = parseInt(match[1], 10);
      const planNameRaw = match[2].trim();
      const planSlug = slugify(planNameRaw);

      if (!planSlug || isNaN(position) || position <= 0) {
        return { intent: "complete-step", success: false, missingData: ["plan", "stepPosition"], steps: [] };
      }

      return {
        intent: "complete-step",
        planSlug,
        stepPosition: position,
        success: true,
        missingData: [],
        steps: [],
      };
    }
  }

  return { intent: "unknown", success: false, missingData: ["plans_command"], steps: [] };
}
