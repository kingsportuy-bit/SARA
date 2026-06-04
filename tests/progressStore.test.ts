import { describe, expect, it } from "vitest";
import { createProgressStore } from "../src/infra/progressStore.js";

function fakeSupabase(overrides: {
  sessions?: { data: unknown; error: unknown } | Error;
  sets?: { data: unknown; error: unknown } | Error;
  objective?: { data: unknown; error: unknown } | Error;
  tasks?: { data: unknown; error: unknown } | Error;
  dailyLog?: { data: unknown; error: unknown } | Error;
} = {}) {
  return {
    rpc: async () => {
      return { data: null, error: new Error("not implemented") };
    },
    from: (table: string) => {
      const throwOrReturn = (val: { data: unknown; error: unknown } | Error | undefined, def: unknown) => {
        if (val instanceof Error) throw val;
        if (val) return val;
        return def;
      };

      if (table === "sara_workout_sessions") {
        const sessions = throwOrReturn(overrides.sessions, { data: [], error: null });
        return {
          select: () => ({
            eq: () => ({
              order: () => sessions,
            }),
          }),
        };
      }
      if (table === "sara_workout_sets") {
        const sets = throwOrReturn(overrides.sets, { data: [], error: null });
        return {
          select: () => ({
            in: () => ({
              ilike: () => ({
                order: () => sets,
              }),
            }),
          }),
        };
      }
      if (table === "sara_objectives") {
        const objective = throwOrReturn(overrides.objective, { data: null, error: null });
        return {
          select: () => ({
            eq: () => ({
              single: () => objective,
              maybeSingle: () => objective,
            }),
          }),
        };
      }
      if (table === "sara_tasks") {
        const tasks = throwOrReturn(overrides.tasks, { data: [], error: null });
        return {
          select: () => ({
            eq: () => ({
              order: () => tasks,
            }),
          }),
        };
      }
      if (table === "sara_daily_log") {
        const dailyLog = throwOrReturn(overrides.dailyLog, { data: [], error: null });
        return {
          select: () => ({
            order: () => ({
              limit: () => dailyLog,
            }),
          }),
        };
      }
      throw new Error(`unknown table: ${table}`);
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("progressStore - getWorkoutProgress", () => {
  it("returns empty when no exerciseName", async () => {
    const store = createProgressStore(fakeSupabase());
    const result = await store.getWorkoutProgress({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "",
    });

    expect(result.status).toBe("empty");
  });

  it("returns empty when no finished sessions", async () => {
    const store = createProgressStore(fakeSupabase({
      sessions: { data: [], error: null },
    }));
    const result = await store.getWorkoutProgress({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "sentadilla",
    });

    expect(result.status).toBe("empty");
  });

  it("returns success with progress data", async () => {
    const sessionsData = [
      { id: "s1", status: "finished", finished_at: "2026-06-01T10:00:00Z", created_at: "2026-06-01T10:00:00Z" },
    ];
    const setsData = [
      { id: "set3", session_id: "s1", exercise_name: "sentadilla", set_number: 3, actual_reps: 6, weight_kg: 80, created_at: "2026-06-01T10:15:00Z" },
      { id: "set2", session_id: "s1", exercise_name: "sentadilla", set_number: 2, actual_reps: 8, weight_kg: 70, created_at: "2026-06-01T10:10:00Z" },
      { id: "set1", session_id: "s1", exercise_name: "sentadilla", set_number: 1, actual_reps: 10, weight_kg: 60, created_at: "2026-06-01T10:05:00Z" },
    ];

    const store = createProgressStore(fakeSupabase({
      sessions: { data: sessionsData, error: null },
      sets: { data: setsData, error: null },
    }));
    const result = await store.getWorkoutProgress({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "sentadilla",
    });

    expect(result.status).toBe("success");
    expect(result.progress).toBeDefined();
    expect(result.progress!.exerciseName).toBe("sentadilla");
    expect(result.progress!.totalSessions).toBe(1);
    expect(result.progress!.totalSets).toBe(3);
    expect(result.progress!.lastWeightKg).toBe(80);
    expect(result.progress!.lastReps).toBe(6);
    expect(result.progress!.maxWeightKg).toBe(80);
  });

  it("handles sessions query error", async () => {
    const store = createProgressStore(fakeSupabase({
      sessions: { data: null, error: { message: "DB error" } },
    }));
    const result = await store.getWorkoutProgress({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "sentadilla",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("returns empty when no matching sets", async () => {
    const sessionsData = [
      { id: "s1", status: "finished", finished_at: "2026-06-01T10:00:00Z", created_at: "2026-06-01T10:00:00Z" },
    ];

    const store = createProgressStore(fakeSupabase({
      sessions: { data: sessionsData, error: null },
      sets: { data: [], error: null },
    }));
    const result = await store.getWorkoutProgress({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "curl",
    });

    expect(result.status).toBe("empty");
  });

  it("handles sets query error", async () => {
    const sessionsData = [
      { id: "s1", status: "finished", finished_at: "2026-06-01T10:00:00Z", created_at: "2026-06-01T10:00:00Z" },
    ];

    const store = createProgressStore(fakeSupabase({
      sessions: { data: sessionsData, error: null },
      sets: { data: null, error: { message: "DB sets error" } },
    }));
    const result = await store.getWorkoutProgress({
      schemaVersion: "progress_workout_input.v1",
      traceId: "trace-1",
      exerciseName: "sentadilla",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB sets error");
  });
});

describe("progressStore - getObjectiveProgress", () => {
  it("returns empty when objective not found by slug", async () => {
    const store = createProgressStore(fakeSupabase({
      objective: { data: null, error: null },
    }));
    const result = await store.getObjectiveProgress({
      schemaVersion: "progress_objective_input.v1",
      traceId: "trace-1",
      objectiveSlug: "nonexistent",
    });

    expect(result.status).toBe("empty");
  });

  it("returns empty when objective not found by id", async () => {
    const store = createProgressStore(fakeSupabase({
      objective: { data: null, error: { message: "not found" } },
    }));
    const result = await store.getObjectiveProgress({
      schemaVersion: "progress_objective_input.v1",
      traceId: "trace-1",
      objectiveId: "nonexistent",
    });

    expect(result.status).toBe("failed");
  });

  it("returns progress with tasks for objective by slug", async () => {
    const objectiveData = { id: "obj-1", title: "mejorar mi energia", slug: "mejorar-energia", status: "active" };
    const tasksData = [
      { id: "t1", title: "dormir 8h", status: "completed" },
      { id: "t2", title: "caminar", status: "pending" },
    ];

    const store = createProgressStore(fakeSupabase({
      objective: { data: objectiveData, error: null },
      tasks: { data: tasksData, error: null },
    }));
    const result = await store.getObjectiveProgress({
      schemaVersion: "progress_objective_input.v1",
      traceId: "trace-1",
      objectiveSlug: "mejorar-energia",
    });

    expect(result.status).toBe("success");
    expect(result.progress).toBeDefined();
    expect(result.progress!.objectiveSlug).toBe("mejorar-energia");
    expect(result.progress!.totalTasks).toBe(2);
    expect(result.progress!.completedTasks).toBe(1);
    expect(result.progress!.pendingTasks).toBe(1);
  });

  it("returns progress by objective id", async () => {
    const objectiveData = { id: "obj-1", title: "mejorar mi energia", slug: "mejorar-energia", status: "active" };

    const store = createProgressStore(fakeSupabase({
      objective: { data: objectiveData, error: null },
      tasks: { data: [], error: null },
    }));
    const result = await store.getObjectiveProgress({
      schemaVersion: "progress_objective_input.v1",
      traceId: "trace-1",
      objectiveId: "obj-1",
    });

    expect(result.status).toBe("success");
    expect(result.progress!.totalTasks).toBe(0);
  });
});

describe("progressStore - getDailyConsistency", () => {
  it("returns empty when no daily logs", async () => {
    const store = createProgressStore(fakeSupabase({
      dailyLog: { data: [], error: null },
    }));
    const result = await store.getDailyConsistency({
      schemaVersion: "progress_consistency_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("empty");
  });

  it("returns summary with streak calculation", async () => {
    const logData = [
      { date: "2026-06-03", wake_energy: 8, sleep_hours: 7 },
      { date: "2026-06-02", wake_energy: 7, sleep_hours: 6.5 },
      { date: "2026-06-01", wake_energy: 6, sleep_hours: 7 },
    ];

    const store = createProgressStore(fakeSupabase({
      dailyLog: { data: logData, error: null },
    }));
    const result = await store.getDailyConsistency({
      schemaVersion: "progress_consistency_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.summary).toBeDefined();
    expect(result.summary!.totalDays).toBe(3);
    expect(result.summary!.streak).toBe(3);
    expect(result.summary!.lastDate).toBe("2026-06-03");
    expect(result.summary!.averageWakeEnergy).toBe(7);
    expect(result.summary!.averageSleepHours).toBeCloseTo(6.8, 1);
  });

  it("handles query error", async () => {
    const store = createProgressStore(fakeSupabase({
      dailyLog: { data: null, error: { message: "DB error" } },
    }));
    const result = await store.getDailyConsistency({
      schemaVersion: "progress_consistency_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("calculates streak correctly with gaps", async () => {
    const logData = [
      { date: "2026-06-03", wake_energy: 8, sleep_hours: 7 },
      { date: "2026-06-01", wake_energy: 6, sleep_hours: 6.5 },
      { date: "2026-05-30", wake_energy: 7, sleep_hours: 7 },
    ];

    const store = createProgressStore(fakeSupabase({
      dailyLog: { data: logData, error: null },
    }));
    const result = await store.getDailyConsistency({
      schemaVersion: "progress_consistency_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.summary!.streak).toBe(1);
    expect(result.summary!.lastDate).toBe("2026-06-03");
  });
});
