import type { CoarseClassificationInput, CoarseClassificationResult } from "../contracts/pipeline.js";
import { matchesNotePrefix, stripChatwootHeader } from "./patterns.js";

export interface CoarseClassifier {
  classify(input: CoarseClassificationInput): Promise<CoarseClassificationResult>;
}

export function createCoarseClassifier(): CoarseClassifier {
  return {
    async classify(input) {
      const rawText = input.messages.map((m) => m.content).join(" ").trim();
      const text = stripChatwootHeader(rawText);

      if (matchesNotePrefix(text)) {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "notes",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Note module detected from explicit command prefix.",
        };
      }

      return {
        schemaVersion: "coarse_classification_result.v1",
        traceId: input.traceId,
        module: "unknown",
        confidence: 0.5,
        missingData: [],
        reasoningSummary: "Skeleton classifier: module detection not yet implemented.",
      };
    },
  };
}
