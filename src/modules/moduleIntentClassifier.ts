import type { ModuleIntentInput, ModuleIntentResult } from "../contracts/pipeline.js";

export interface ModuleIntentClassifier {
  classify(input: ModuleIntentInput): Promise<ModuleIntentResult>;
}

const NOTE_PATTERNS = [
  /^(?:nota|guarda una nota|anota esto|anotar|guardar nota|crea una nota|crear nota)[\s:]+(.*)/i,
  /^(?:aprendizaje|idea|problema|riesgo|mejora|observacion)[\s:]+(.*)/i,
];

const NOTE_PREFIX_REMOVE = /^(?:nota|guarda una nota|anota esto|anotar|guardar nota|crea una nota|crear nota)[\s:]+/i;

function detectNotesIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;

  const matched = NOTE_PATTERNS.some((pattern) => pattern.test(text));
  if (!matched) return null;

  const cleaned = text.replace(NOTE_PREFIX_REMOVE, "").trim();

  if (!cleaned) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "notes",
      action: "create",
      confidence: 0.4,
      entities: {},
      missingData: ["content"],
      requiresConfirmation: false,
      reasoningSummary: "Note intent detected but no content provided.",
    };
  }

  let noteType: string | undefined;
  for (const typePattern of NOTE_PATTERNS.slice(1)) {
    const typeMatch = typePattern.exec(text);
    if (typeMatch && typeMatch[1]) {
      const inferredType = typePattern.source.match(/^\^\(\?\:([^)]+)\)/)!;
      const types = inferredType[1].split("|");
      for (const t of types) {
        if (text.toLowerCase().startsWith(t)) {
          noteType = t;
          break;
        }
      }
      break;
    }
  }

  return {
    schemaVersion: "module_intent_result.v1",
    traceId: input.traceId,
    module: "notes",
    action: "create",
    confidence: 0.85,
    entities: {
      content: cleaned,
      noteType: noteType || "observacion",
    },
    missingData: [],
    requiresConfirmation: false,
    reasoningSummary: "Note creation intent detected from explicit pattern.",
  };
}

export function createModuleIntentClassifier(): ModuleIntentClassifier {
  return {
    async classify(input) {
      if (input.module === "notes") {
        const detected = detectNotesIntent(input);
        if (detected) return detected;
      }

      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: input.module,
        action: "none",
        confidence: 0.1,
        entities: {},
        missingData: ["intent classification not implemented"],
        requiresConfirmation: false,
        reasoningSummary: "Skeleton classifier: intent detection not yet implemented.",
      };
    },
  };
}
