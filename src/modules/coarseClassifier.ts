import type { CoarseClassificationInput, CoarseClassificationResult } from "../contracts/pipeline.js";
import { matchesNotePrefix, matchesNoteListQuery, matchesNoteSearchQuery, matchesTaskCreate, matchesTaskListQuery, matchesTaskComplete, matchesReminderCreate, matchesReminderListQuery, matchesReminderCancel, matchesDailyLogQuery, matchesAreaQuery, matchesObjectiveQuery } from "./patterns.js";

export interface CoarseClassifier {
  classify(input: CoarseClassificationInput): Promise<CoarseClassificationResult>;
}

export function createCoarseClassifier(): CoarseClassifier {
  return {
    async classify(input) {
      const text = input.messages.map((m) => m.content).join(" ").trim();

      if (matchesNotePrefix(text) || matchesNoteListQuery(text) || matchesNoteSearchQuery(text)) {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "notes",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Note module detected from explicit match.",
        };
      }

      if (matchesDailyLogQuery(text)) {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "daily-log",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Daily log module detected from explicit match.",
        };
      }

      if (matchesTaskCreate(text) || matchesTaskListQuery(text) || matchesTaskComplete(text)) {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "tasks",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Task module detected from explicit match.",
        };
      }

      if (matchesReminderCreate(text) || matchesReminderListQuery(text) || matchesReminderCancel(text)) {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "reminders",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Reminder module detected from explicit match.",
        };
      }

      if (matchesAreaQuery(text)) {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "areas",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Area module detected from explicit match.",
        };
      }

      if (matchesObjectiveQuery(text)) {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "objectives",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Objective module detected from explicit match.",
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
