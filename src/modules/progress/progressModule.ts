import type {
  ProgressRepository,
  GetWorkoutProgressInput,
  GetWorkoutProgressResult,
  GetObjectiveProgressInput,
  GetObjectiveProgressResult,
  GetDailyConsistencyInput,
  GetDailyConsistencyResult,
} from "../../contracts/progress.js";

export interface ProgressModule {
  workout(input: GetWorkoutProgressInput): Promise<GetWorkoutProgressResult>;
  objective(input: GetObjectiveProgressInput): Promise<GetObjectiveProgressResult>;
  summary(input: GetDailyConsistencyInput): Promise<GetDailyConsistencyResult>;
}

export function createProgressModule(repository: ProgressRepository): ProgressModule {
  return {
    async workout(input: GetWorkoutProgressInput): Promise<GetWorkoutProgressResult> {
      const exerciseName = input.exerciseName?.trim();
      if (!exerciseName) {
        return {
          schemaVersion: "progress_workout_result.v1",
          traceId: input.traceId,
          status: "empty",
        };
      }

      return repository.getWorkoutProgress({ ...input, exerciseName });
    },

    async objective(input: GetObjectiveProgressInput): Promise<GetObjectiveProgressResult> {
      if (!input.objectiveId && !input.objectiveSlug) {
        return {
          schemaVersion: "progress_objective_result.v1",
          traceId: input.traceId,
          status: "failed",
          error: "objectiveId or objectiveSlug required to get progress",
        };
      }

      return repository.getObjectiveProgress(input);
    },

    async summary(input: GetDailyConsistencyInput): Promise<GetDailyConsistencyResult> {
      return repository.getDailyConsistency(input);
    },
  };
}
