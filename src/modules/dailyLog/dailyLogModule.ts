import type {
  DailyLogMorningInput,
  DailyLogMorningResult,
  DailyLogEveningInput,
  DailyLogEveningResult,
  DailyLogSummaryInput,
  DailyLogSummaryResult,
  DailyLogRepository,
} from "../../contracts/dailyLog.js";

export interface DailyLogModule {
  morning(input: DailyLogMorningInput): Promise<DailyLogMorningResult>;
  evening(input: DailyLogEveningInput): Promise<DailyLogEveningResult>;
  summary(input: DailyLogSummaryInput): Promise<DailyLogSummaryResult>;
}

export function createDailyLogModule(repository: DailyLogRepository): DailyLogModule {
  return {
    async morning(input) {
      const hasField =
        input.wakeEnergy !== undefined ||
        input.sleepHours !== undefined ||
        (input.morningIntention && input.morningIntention.trim().length > 0) ||
        (Array.isArray(input.notes) && input.notes.length > 0);

      if (!hasField) {
        return {
          schemaVersion: "daily_log_morning_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "no actualizable fields provided for morning",
        };
      }

      if (input.wakeEnergy !== undefined && (input.wakeEnergy < 1 || input.wakeEnergy > 10)) {
        return {
          schemaVersion: "daily_log_morning_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "wakeEnergy must be between 1 and 10",
        };
      }

      if (input.sleepHours !== undefined && input.sleepHours < 0) {
        return {
          schemaVersion: "daily_log_morning_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "sleepHours cannot be negative",
        };
      }

      return repository.upsertMorning(input);
    },

    async evening(input) {
      const hasField =
        (input.eveningReview && input.eveningReview.trim().length > 0) ||
        (input.mood && input.mood.trim().length > 0) ||
        (Array.isArray(input.notes) && input.notes.length > 0);

      if (!hasField) {
        return {
          schemaVersion: "daily_log_evening_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "no actualizable fields provided for evening",
        };
      }

      return repository.upsertEvening(input);
    },

    async summary(input) {
      return repository.getSummary(input);
    },
  };
}
