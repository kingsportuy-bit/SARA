import type { CoarseClassificationInput, CoarseClassificationResult } from "../contracts/pipeline.js";

export interface CoarseClassifier {
  classify(input: CoarseClassificationInput): Promise<CoarseClassificationResult>;
}

export function createCoarseClassifier(): CoarseClassifier {
  return {
    async classify(input) {
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
