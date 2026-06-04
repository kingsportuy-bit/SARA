import type {
  StartWorkoutSessionInput,
  StartWorkoutSessionResult,
  LogWorkoutSetInput,
  LogWorkoutSetResult,
  FinishWorkoutSessionInput,
  FinishWorkoutSessionResult,
  CancelWorkoutSessionInput,
  CancelWorkoutSessionResult,
  ListWorkoutSessionsInput,
  ListWorkoutSessionsResult,
  WorkoutsRepository,
} from "../../contracts/workouts.js";

export interface WorkoutsModule {
  start(input: StartWorkoutSessionInput): Promise<StartWorkoutSessionResult>;
  logSet(input: LogWorkoutSetInput): Promise<LogWorkoutSetResult>;
  finish(input: FinishWorkoutSessionInput): Promise<FinishWorkoutSessionResult>;
  cancel(input: CancelWorkoutSessionInput): Promise<CancelWorkoutSessionResult>;
  list(input: ListWorkoutSessionsInput): Promise<ListWorkoutSessionsResult>;
}

export function createWorkoutsModule(repository: WorkoutsRepository): WorkoutsModule {
  return {
    async start(input: StartWorkoutSessionInput): Promise<StartWorkoutSessionResult> {
      return repository.startSession(input);
    },

    async logSet(input: LogWorkoutSetInput): Promise<LogWorkoutSetResult> {
      const exerciseName = (input.exerciseName ?? "").trim();

      if (!exerciseName) {
        return {
          schemaVersion: "workouts_set_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "exercise name cannot be empty",
        };
      }

      if (input.setNumber <= 0) {
        return {
          schemaVersion: "workouts_set_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "set number must be positive",
        };
      }

      if (input.actualReps == null && input.durationSeconds == null) {
        return {
          schemaVersion: "workouts_set_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "either actualReps or durationSeconds must be provided",
        };
      }

      if (input.actualReps != null && input.actualReps <= 0) {
        return {
          schemaVersion: "workouts_set_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "actual reps must be positive",
        };
      }

      if (input.durationSeconds != null && input.durationSeconds <= 0) {
        return {
          schemaVersion: "workouts_set_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "duration must be positive",
        };
      }

      return repository.logSet({ ...input, exerciseName });
    },

    async finish(input: FinishWorkoutSessionInput): Promise<FinishWorkoutSessionResult> {
      return repository.finishSession(input);
    },

    async cancel(input: CancelWorkoutSessionInput): Promise<CancelWorkoutSessionResult> {
      return repository.cancelSession(input);
    },

    async list(input: ListWorkoutSessionsInput): Promise<ListWorkoutSessionsResult> {
      return repository.listSessions(input);
    },
  };
}
