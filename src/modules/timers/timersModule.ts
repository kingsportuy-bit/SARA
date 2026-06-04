import type {
  StartTimerInput,
  StartTimerResult,
  CancelTimerInput,
  CancelTimerResult,
  ClaimDueTimersInput,
  ClaimDueTimersResult,
  MarkTimerFiredInput,
  MarkTimerFiredResult,
  TimersRepository,
  TimerRecord,
  TimerKind,
  TimerStatus,
} from "../../contracts/timers.js";

export interface TimersModule {
  start(input: StartTimerInput): Promise<StartTimerResult>;
  cancel(input: CancelTimerInput): Promise<CancelTimerResult>;
  claimDue(input: ClaimDueTimersInput): Promise<ClaimDueTimersResult>;
  markFired(input: MarkTimerFiredInput): Promise<MarkTimerFiredResult>;
}

const MVP_MAX_DURATION_SECONDS = 1800; // 30 minutes
const MVP_MIN_DURATION_SECONDS = 1;

export function createTimersModule(repository: TimersRepository): TimersModule {
  return {
    async start(input: StartTimerInput): Promise<StartTimerResult> {
      const title = (input.title ?? "").trim();

      if (!title) {
        return {
          schemaVersion: "timers_start_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "timer title cannot be empty",
        };
      }

      if (input.durationSeconds < MVP_MIN_DURATION_SECONDS) {
        return {
          schemaVersion: "timers_start_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "duration must be positive",
        };
      }

      if (input.durationSeconds > MVP_MAX_DURATION_SECONDS) {
        return {
          schemaVersion: "timers_start_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "duration exceeds MVP maximum of 30 minutes",
        };
      }

      if (input.kind !== "workout_rest" && input.kind !== "generic") {
        return {
          schemaVersion: "timers_start_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "invalid timer kind",
        };
      }

      return repository.startTimer({ ...input, title });
    },

    async cancel(input: CancelTimerInput): Promise<CancelTimerResult> {
      if (!input.timerId) {
        return {
          schemaVersion: "timers_cancel_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "timerId is required to cancel",
        };
      }

      return repository.cancelTimer(input);
    },

    async claimDue(input: ClaimDueTimersInput): Promise<ClaimDueTimersResult> {
      if (input.limit < 1) {
        return {
          schemaVersion: "timers_claim_due_result.v1",
          traceId: input.traceId,
          status: "failed",
          timers: [],
          count: 0,
          error: "limit must be positive",
        };
      }

      return repository.claimDueTimers(input);
    },

    async markFired(input: MarkTimerFiredInput): Promise<MarkTimerFiredResult> {
      if (!input.timerId) {
        return {
          schemaVersion: "timers_mark_fired_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "timerId is required to mark fired",
        };
      }

      return repository.markTimerFired(input);
    },
  };
}
