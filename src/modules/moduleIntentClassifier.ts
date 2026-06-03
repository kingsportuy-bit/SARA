import type { ModuleIntentInput, ModuleIntentResult } from "../contracts/pipeline.js";

export interface ModuleIntentClassifier {
  classify(input: ModuleIntentInput): Promise<ModuleIntentResult>;
}

export function createModuleIntentClassifier(): ModuleIntentClassifier {
  return {
    async classify(input) {
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
