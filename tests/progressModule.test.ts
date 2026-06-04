import { describe, expect, it } from "vitest";
import { createProgressModule } from "../src/modules/progress/progressModule.js";
import type {
  ProgressRepository,
  GetWorkoutProgressInput,
  GetWorkoutProgressResult,
  GetObjectiveProgressInput,
  GetObjectiveProgressResult,
  GetDailyConsistencyInput,
  GetDailyConsistencyResult,
} from "../src/contracts/progress.js";

function fakeRepo(): ProgressRepository {
  return {
    async getWorkoutProgress(input: GetWorkoutProgressInput): Promise<GetWorkoutProgressResult> {
      if (!input.exerciseName) {
        return {
          schemaVersion: "progress_workout_result.v1",
          traceId: input.traceId,
          status: "empty",
        };
      }
      return {
        schemaVersion: "progress_workout_result.v1",
        traceId: input.traceId,
        status: "success",
        progress: {
          exerciseName: input.exerciseName,
          totalSessions: 3,
          totalSets: 9,
          lastWeightKg: 80,
          lastReps: 8,
          maxWeightKg: 85,
          maxWeightDate: "2026-05-28T10:00:00Z",
          volumeBySession: [
            { sessionId: "s3", sessionDate: "2026-06-01T10:00:00Z", sets: 3, totalVolume: 1920 },
            { sessionId: "s2", sessionDate: "2026-05-28T10:00:00Z", sets: 3, totalVolume: 2040 },
            { sessionId: "s1", sessionDate: "2026-05-25T10:00:00Z", sets: 3, totalVolume: 1800 },
          ],
          recentSessions: [
            { sessionId: "s3", date: "2026-06-01T10:00:00Z", sets: 3 },
            { sessionId: "s2", date: "2026-05-28T10:00:00Z", sets: 3 },
            { sessionId: "s1", date: "2026-05-25T10:00:00Z", sets: 3 },
          ],
        },
      };
    },

    async getObjectiveProgress(input: GetObjectiveProgressInput): Promise<GetObjectiveProgressResult> {
      const slug = input.objectiveSlug ?? "mejorar-energia";
      if (slug === "empty-obj") {
        return {
          schemaVersion: "progress_objective_result.v1",
          traceId: input.traceId,
          status: "empty",
        };
      }
      return {
        schemaVersion: "progress_objective_result.v1",
        traceId: input.traceId,
        status: "success",
        progress: {
          objectiveId: "obj-1",
          objectiveTitle: "mejorar mi energia",
          objectiveSlug: slug,
          status: "active",
          totalTasks: 4,
          completedTasks: 2,
          pendingTasks: 2,
          tasks: [
            { id: "t1", title: "dormir 8 horas", status: "completed" },
            { id: "t2", title: "caminar 30 min", status: "completed" },
            { id: "t3", title: "comprar vitaminas", status: "pending" },
            { id: "t4", title: "meditar 10 min", status: "pending" },
          ],
        },
      };
    },

    async getDailyConsistency(input: GetDailyConsistencyInput): Promise<GetDailyConsistencyResult> {
      return {
        schemaVersion: "progress_consistency_result.v1",
        traceId: input.traceId,
        status: "success",
        summary: {
          totalDays: 7,
          streak: 5,
          lastDate: "2026-06-03",
          averageWakeEnergy: 7.2,
          averageSleepHours: 6.8,
        },
      };
    },
  };
}

function fakeEmptyRepo(): ProgressRepository {
  return {
    async getWorkoutProgress(input: GetWorkoutProgressInput): Promise<GetWorkoutProgressResult> {
      return {
        schemaVersion: "progress_workout_result.v1",
        traceId: input.traceId,
        status: "empty",
      };
    },
    async getObjectiveProgress(input: GetObjectiveProgressInput): Promise<GetObjectiveProgressResult> {
      return {
        schemaVersion: "progress_objective_result.v1",
        traceId: input.traceId,
        status: "empty",
      };
    },
    async getDailyConsistency(input: GetDailyConsistencyInput): Promise<GetDailyConsistencyResult> {
      return {
        schemaVersion: "progress_consistency_result.v1",
        traceId: input.traceId,
        status: "empty",
      };
    },
  };
}

describe("progressModule - workout", () => {
  it("returns workout progress for a valid exercise name", async () => {
    const mod = createProgressModule(fakeRepo());
    const result = await mod.workout({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "sentadilla",
    });

    expect(result.status).toBe("success");
    expect(result.progress).toBeDefined();
    expect(result.progress!.exerciseName).toBe("sentadilla");
    expect(result.progress!.totalSessions).toBe(3);
    expect(result.progress!.totalSets).toBe(9);
    expect(result.progress!.lastWeightKg).toBe(80);
    expect(result.progress!.lastReps).toBe(8);
  });

  it("returns empty when no exercise name provided", async () => {
    const mod = createProgressModule(fakeRepo());
    const result = await mod.workout({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "",
    });

    expect(result.status).toBe("empty");
  });

  it("returns empty state without data", async () => {
    const mod = createProgressModule(fakeEmptyRepo());
    const result = await mod.workout({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "curl",
    });

    expect(result.status).toBe("empty");
  });
});

describe("progressModule - objective", () => {
  it("returns objective progress for a valid slug", async () => {
    const mod = createProgressModule(fakeRepo());
    const result = await mod.objective({
      schemaVersion: "progress_objective_input.v1",
      traceId: "trace-1",
      objectiveSlug: "mejorar-energia",
    });

    expect(result.status).toBe("success");
    expect(result.progress).toBeDefined();
    expect(result.progress!.objectiveSlug).toBe("mejorar-energia");
    expect(result.progress!.totalTasks).toBe(4);
    expect(result.progress!.completedTasks).toBe(2);
    expect(result.progress!.pendingTasks).toBe(2);
  });

  it("returns objective progress by id", async () => {
    const mod = createProgressModule(fakeRepo());
    const result = await mod.objective({
      schemaVersion: "progress_objective_input.v1",
      traceId: "trace-1",
      objectiveId: "obj-1",
    });

    expect(result.status).toBe("success");
    expect(result.progress).toBeDefined();
  });

  it("fails without identifier", async () => {
    const mod = createProgressModule(fakeRepo());
    const result = await mod.objective({
      schemaVersion: "progress_objective_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("objectiveId or objectiveSlug");
  });

  it("returns empty state without data", async () => {
    const mod = createProgressModule(fakeEmptyRepo());
    const result = await mod.objective({
      schemaVersion: "progress_objective_input.v1",
      traceId: "trace-1",
      objectiveSlug: "empty-obj",
    });

    expect(result.status).toBe("empty");
  });
});

describe("progressModule - summary", () => {
  it("returns daily consistency summary", async () => {
    const mod = createProgressModule(fakeRepo());
    const result = await mod.summary({
      schemaVersion: "progress_consistency_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.summary).toBeDefined();
    expect(result.summary!.totalDays).toBe(7);
    expect(result.summary!.streak).toBe(5);
    expect(result.summary!.averageWakeEnergy).toBe(7.2);
    expect(result.summary!.averageSleepHours).toBe(6.8);
  });

  it("returns empty state without data", async () => {
    const mod = createProgressModule(fakeEmptyRepo());
    const result = await mod.summary({
      schemaVersion: "progress_consistency_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("empty");
  });
});
