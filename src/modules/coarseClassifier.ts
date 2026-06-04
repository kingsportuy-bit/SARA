import type { CoarseClassificationInput, CoarseClassificationResult } from "../contracts/pipeline.js";
import { matchesNotePrefix, matchesNoteListQuery, matchesNoteSearchQuery, matchesTaskCreate, matchesTaskListQuery, matchesTaskComplete, matchesReminderCreate, matchesReminderListQuery, matchesReminderCancel, matchesDailyLogQuery, matchesAreaQuery, matchesObjectiveQuery } from "./patterns.js";
import { parseRoutinesInput } from "./routines/routinesParser.js";
import { parseWorkoutsInput } from "./workouts/workoutsParser.js";
import { parseTimersInput } from "./timers/timersParser.js";
import { parseProgressInput } from "./progress/progressParser.js";
import { parsePlansInput } from "./plans/plansParser.js";
import { parseProtocolsInput } from "./protocols/protocolsParser.js";

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

      if (matchesTaskCreate(text) || matchesTaskListQuery(text)) {
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

      const routines = parseRoutinesInput(text);
      if (routines.intent !== "unknown") {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "routines",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Routine module detected from deterministic parser.",
        };
      }

      const workouts = parseWorkoutsInput(text);
      if (workouts.intent !== "unknown") {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "workouts",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Workout module detected from deterministic parser.",
        };
      }

      const timers = parseTimersInput(text);
      if (timers.intent !== "unknown") {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "timers",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Timer module detected from deterministic parser.",
        };
      }

      const plans = parsePlansInput(text);
      if (plans.intent !== "unknown") {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "plans",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Plan module detected from deterministic parser.",
        };
      }

      const protocols = parseProtocolsInput(text);
      if (protocols.intent !== "unknown") {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "protocols",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Protocol module detected from deterministic parser.",
        };
      }

      const progress = parseProgressInput(text);
      if (progress.intent !== "unknown") {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "progress",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Progress module detected from deterministic parser.",
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

      if (matchesTaskComplete(text)) {
        return {
          schemaVersion: "coarse_classification_result.v1",
          traceId: input.traceId,
          module: "tasks",
          confidence: 0.9,
          missingData: [],
          reasoningSummary: "Task module detected from explicit match.",
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
