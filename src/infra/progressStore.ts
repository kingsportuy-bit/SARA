import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProgressRepository,
  GetWorkoutProgressInput,
  GetWorkoutProgressResult,
  GetObjectiveProgressInput,
  GetObjectiveProgressResult,
  GetDailyConsistencyInput,
  GetDailyConsistencyResult,
  WorkoutExerciseProgress,
  ObjectiveProgressSummary,
  DailyConsistencySummary,
} from "../contracts/progress.js";

interface WorkoutSetRow {
  id: string;
  session_id: string;
  exercise_name: string;
  set_number: number;
  actual_reps: number | null;
  weight_kg: number | null;
  created_at: string;
}

interface WorkoutSessionRow {
  id: string;
  status: string;
  finished_at: string | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
}

interface ObjectiveRow {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface DailyLogRow {
  date: string;
  wake_energy: number | null;
  sleep_hours: number | null;
}

export function createProgressStore(supabase: SupabaseClient): ProgressRepository {
  return {
    async getWorkoutProgress(input: GetWorkoutProgressInput): Promise<GetWorkoutProgressResult> {
      try {
        const exerciseName = input.exerciseName?.trim();
        if (!exerciseName) {
          return {
            schemaVersion: "progress_workout_result.v1",
            traceId: input.traceId,
            status: "empty",
          };
        }

        const { data: sessions, error: sessionsErr } = await supabase
          .from("sara_workout_sessions")
          .select("id,status,finished_at,created_at")
          .eq("status", "finished")
          .order("created_at", { ascending: false });

        if (sessionsErr) {
          return {
            schemaVersion: "progress_workout_result.v1",
            traceId: input.traceId,
            status: "failed",
            error: sessionsErr.message,
          };
        }

        if (!sessions || sessions.length === 0) {
          return {
            schemaVersion: "progress_workout_result.v1",
            traceId: input.traceId,
            status: "empty",
          };
        }

        const sessionRows = sessions as unknown as WorkoutSessionRow[];
        const sessionIds = sessionRows.map((s) => s.id);

        const { data: sets, error: setsErr } = await supabase
          .from("sara_workout_sets")
          .select("id,session_id,exercise_name,set_number,actual_reps,weight_kg,created_at")
          .in("session_id", sessionIds)
          .ilike("exercise_name", `%${exerciseName}%`)
          .order("created_at", { ascending: false });

        if (setsErr) {
          return {
            schemaVersion: "progress_workout_result.v1",
            traceId: input.traceId,
            status: "failed",
            error: setsErr.message,
          };
        }

        if (!sets || sets.length === 0) {
          return {
            schemaVersion: "progress_workout_result.v1",
            traceId: input.traceId,
            status: "empty",
          };
        }

        const setRows = sets as unknown as WorkoutSetRow[];
        const sessionMap = new Map(sessionRows.map((s) => [s.id, s]));

        let lastWeightKg: number | null = null;
        let lastReps: number | null = null;
        let maxWeightKg: number | null = null;
        let maxWeightDate: string | null = null;

        const volumeBySessionMap = new Map<string, { sessionId: string; sessionDate: string; sets: number; totalVolume: number }>();

        for (const set of setRows) {
          const volume = (set.weight_kg ?? 0) * (set.actual_reps ?? 0);

          if (!volumeBySessionMap.has(set.session_id)) {
            const session = sessionMap.get(set.session_id);
            volumeBySessionMap.set(set.session_id, {
              sessionId: set.session_id,
              sessionDate: session?.finished_at ?? session?.created_at ?? "",
              sets: 0,
              totalVolume: 0,
            });
          }

          const entry = volumeBySessionMap.get(set.session_id)!;
          entry.sets += 1;
          entry.totalVolume += volume;
        }

        const lastSet = setRows[0];
        lastWeightKg = lastSet.weight_kg;
        lastReps = lastSet.actual_reps;

        for (const set of setRows) {
          if (set.weight_kg !== null && (maxWeightKg === null || set.weight_kg > maxWeightKg)) {
            maxWeightKg = set.weight_kg;
            const session = sessionMap.get(set.session_id);
            maxWeightDate = session?.finished_at ?? session?.created_at ?? null;
          }
        }

        const volumeBySession = [...volumeBySessionMap.values()].sort(
          (a, b) => b.sessionDate.localeCompare(a.sessionDate)
        );

        const limit = input.limit ?? 5;
        const recentSessions = volumeBySession.slice(0, limit).map((v) => ({
          sessionId: v.sessionId,
          date: v.sessionDate,
          sets: v.sets,
        }));

        const progress: WorkoutExerciseProgress = {
          exerciseName,
          totalSessions: volumeBySession.length,
          totalSets: setRows.length,
          lastWeightKg,
          lastReps,
          maxWeightKg,
          maxWeightDate,
          volumeBySession,
          recentSessions,
        };

        return {
          schemaVersion: "progress_workout_result.v1",
          traceId: input.traceId,
          status: "success",
          progress,
        };
      } catch (err) {
        return {
          schemaVersion: "progress_workout_result.v1",
          traceId: input.traceId,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async getObjectiveProgress(input: GetObjectiveProgressInput): Promise<GetObjectiveProgressResult> {
      try {
        let objective: ObjectiveRow | null = null;

        if (input.objectiveId) {
          const { data, error } = await supabase
            .from("sara_objectives")
            .select("id,title,slug,status")
            .eq("id", input.objectiveId)
            .single();

          if (error) {
            return {
              schemaVersion: "progress_objective_result.v1",
              traceId: input.traceId,
              status: "failed",
              error: error.message,
            };
          }

          objective = data as unknown as ObjectiveRow;
        } else if (input.objectiveSlug) {
          const { data, error } = await supabase
            .from("sara_objectives")
            .select("id,title,slug,status")
            .eq("slug", input.objectiveSlug)
            .maybeSingle();

          if (error) {
            return {
              schemaVersion: "progress_objective_result.v1",
              traceId: input.traceId,
              status: "failed",
              error: error.message,
            };
          }

          objective = data as unknown as ObjectiveRow;
        }

        if (!objective) {
          return {
            schemaVersion: "progress_objective_result.v1",
            traceId: input.traceId,
            status: "empty",
          };
        }

        const { data: tasks, error: tasksErr } = await supabase
          .from("sara_tasks")
          .select("id,title,status")
          .eq("objective_id", objective.id)
          .order("created_at", { ascending: false });

        if (tasksErr) {
          return {
            schemaVersion: "progress_objective_result.v1",
            traceId: input.traceId,
            status: "failed",
            error: tasksErr.message,
          };
        }

        const taskRows = (tasks as unknown as TaskRow[]) ?? [];
        const completedTasks = taskRows.filter((t) => t.status === "completed").length;
        const pendingTasks = taskRows.filter((t) => t.status === "pending").length;

        const progress: ObjectiveProgressSummary = {
          objectiveId: objective.id,
          objectiveTitle: objective.title,
          objectiveSlug: objective.slug,
          status: objective.status,
          totalTasks: taskRows.length,
          completedTasks,
          pendingTasks,
          tasks: taskRows.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
          })),
        };

        return {
          schemaVersion: "progress_objective_result.v1",
          traceId: input.traceId,
          status: "success",
          progress,
        };
      } catch (err) {
        return {
          schemaVersion: "progress_objective_result.v1",
          traceId: input.traceId,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async getDailyConsistency(input: GetDailyConsistencyInput): Promise<GetDailyConsistencyResult> {
      try {
        const days = input.days ?? 30;

        const { data, error } = await supabase
          .from("sara_daily_log")
          .select("date,wake_energy,sleep_hours")
          .order("date", { ascending: false })
          .limit(days);

        if (error) {
          return {
            schemaVersion: "progress_consistency_result.v1",
            traceId: input.traceId,
            status: "failed",
            error: error.message,
          };
        }

        if (!data || data.length === 0) {
          return {
            schemaVersion: "progress_consistency_result.v1",
            traceId: input.traceId,
            status: "empty",
          };
        }

        const rows = data as unknown as DailyLogRow[];

        let streak = 0;
        let lastDate: string | null = null;
        let totalWakeEnergy = 0;
        let wakeEnergyCount = 0;
        let totalSleepHours = 0;
        let sleepHoursCount = 0;

        const sortedDates = rows
          .map((r) => r.date)
          .filter((d) => d)
          .sort()
          .reverse();

        if (sortedDates.length > 0) {
          lastDate = sortedDates[0];
          streak = 1;

          for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = new Date(sortedDates[i - 1]);
            const currDate = new Date(sortedDates[i]);
            const diffDays =
              (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);

            if (Math.abs(diffDays - 1) < 0.5) {
              streak += 1;
            } else {
              break;
            }
          }
        }

        for (const row of rows) {
          if (row.wake_energy != null) {
            totalWakeEnergy += row.wake_energy;
            wakeEnergyCount += 1;
          }
          if (row.sleep_hours != null) {
            totalSleepHours += row.sleep_hours;
            sleepHoursCount += 1;
          }
        }

        const summary: DailyConsistencySummary = {
          totalDays: rows.length,
          streak,
          lastDate,
          averageWakeEnergy: wakeEnergyCount > 0 ? Math.round((totalWakeEnergy / wakeEnergyCount) * 10) / 10 : null,
          averageSleepHours: sleepHoursCount > 0 ? Math.round((totalSleepHours / sleepHoursCount) * 10) / 10 : null,
        };

        return {
          schemaVersion: "progress_consistency_result.v1",
          traceId: input.traceId,
          status: "success",
          summary,
        };
      } catch (err) {
        return {
          schemaVersion: "progress_consistency_result.v1",
          traceId: input.traceId,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
