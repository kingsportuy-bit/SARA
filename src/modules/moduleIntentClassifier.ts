import type { ModuleIntentInput, ModuleIntentResult } from "../contracts/pipeline.js";
import { matchesNotePrefix, extractNoteContent, matchesNoteListQuery, matchesNoteSearchQuery, extractSearchQuery } from "./patterns.js";

export interface ModuleIntentClassifier {
  classify(input: ModuleIntentInput): Promise<ModuleIntentResult>;
}

function detectNotesIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;

  if (matchesNoteSearchQuery(text)) {
    const query = extractSearchQuery(text);
    if (query) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "notes",
        action: "search",
        confidence: 0.85,
        entities: { query },
        missingData: [],
        requiresConfirmation: false,
        reasoningSummary: "Note search intent detected.",
      };
    }
  }

  if (matchesNoteListQuery(text)) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "notes",
      action: "list",
      confidence: 0.85,
      entities: {},
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Note list intent detected.",
    };
  }

  if (!matchesNotePrefix(text)) return null;

  const cleaned = extractNoteContent(text);

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

  let noteType = "observacion";
  const lower = text.toLowerCase();
  const noteTypes = ["aprendizaje", "idea", "problema", "riesgo", "mejora", "observacion"] as const;
  for (const nt of noteTypes) {
    if (lower.startsWith(nt)) {
      noteType = nt;
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
      noteType,
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
