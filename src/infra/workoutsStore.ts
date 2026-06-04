import type { SupabaseClient } from "@supabase/supabase-js";
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
  WorkoutSessionRecord,
  WorkoutSessionStatus,
} from "../contracts/workouts.js";

interface StartSessionRpcResult {
  session_id: string;
  event_id: string;
  title?: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface LogSetRpcResult {
  set_id: string;
  event_id: string;
  session_id: string;
  exercise_name: string;
  set_number: number;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface FinishSessionRpcResult {
  session_id: string;
  event_id: string;
  title?: string;
  set_count: number;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface CancelSessionRpcResult {
  session_id: string;
  event_id: string;
  title?: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ListSessionsRpcResult {
  sessions: Record<string, unknown>[];
  count: number;
  trace_id: string;
  schema_version: string;
}

interface SessionRow {
  id: string;
  schema_version: string;
  title?: string;
  status: string;
  routine_id?: string;
  area_id?: string;
  objective_id?: string;
  started_at: string;
  finished_at?: string;
  notes?: string;
  trace_id?: string;
  created_at: string;
  updated_at: string;
  set_count?: number;
}

function toSessionRecord(row: SessionRow): WorkoutSessionRecord {
  return {
    id: row.id,
    schemaVersion: row.schema_version ?? "",
    title: row.title ?? undefined,
    status: (row.status ?? "active") as WorkoutSessionStatus,
    routineId: row.routine_id ?? undefined,
    areaId: row.area_id ?? undefined,
    objectiveId: row.objective_id ?? undefined,
    startedAt: row.started_at ?? "",
    finishedAt: row.finished_at ?? undefined,
    notes: row.notes ?? undefined,
    traceId: row.trace_id ?? undefined,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    setCount: row.set_count ?? undefined,
  };
}

export function createWorkoutsStore(supabase: SupabaseClient): WorkoutsRepository {
  return {
    async startSession(input: StartWorkoutSessionInput): Promise<StartWorkoutSessionResult> {
      const { data, error } = await supabase.rpc("sara_start_workout_session", {
        p_trace_id: input.traceId,
        p_title: input.title ?? null,
        p_routine_id: input.routineId ?? null,
        p_area_id: input.areaId ?? null,
        p_objective_id: input.objectiveId ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "workouts_start_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as StartSessionRpcResult;

      if (result.error) {
        return {
          schemaVersion: "workouts_start_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "workouts_start_result.v1",
        traceId: input.traceId,
        status: "started",
        sessionId: result.session_id,
        eventId: result.event_id,
        title: result.title,
        evidence: {
          sessionId: result.session_id,
          eventId: result.event_id,
          eventType: "workout_session_started",
        },
      };
    },

    async logSet(input: LogWorkoutSetInput): Promise<LogWorkoutSetResult> {
      const { data, error } = await supabase.rpc("sara_log_workout_set", {
        p_trace_id: input.traceId,
        p_session_id: input.sessionId,
        p_exercise_name: input.exerciseName,
        p_set_number: input.setNumber,
        p_target_reps: input.targetReps ?? null,
        p_actual_reps: input.actualReps ?? null,
        p_weight_kg: input.weightKg ?? null,
        p_duration_seconds: input.durationSeconds ?? null,
        p_rest_seconds: input.restSeconds ?? null,
        p_notes: input.notes ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "workouts_set_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as LogSetRpcResult;

      if (result.error) {
        return {
          schemaVersion: "workouts_set_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "workouts_set_result.v1",
        traceId: input.traceId,
        status: "logged",
        setId: result.set_id,
        eventId: result.event_id,
        sessionId: result.session_id,
        exerciseName: result.exercise_name,
        setNumber: result.set_number,
        evidence: {
          setId: result.set_id,
          eventId: result.event_id,
          eventType: "workout_set_logged",
        },
      };
    },

    async finishSession(input: FinishWorkoutSessionInput): Promise<FinishWorkoutSessionResult> {
      const { data, error } = await supabase.rpc("sara_finish_workout_session", {
        p_trace_id: input.traceId,
        p_session_id: input.sessionId ?? null,
        p_notes: input.notes ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "workouts_finish_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as FinishSessionRpcResult;

      if (result.error) {
        return {
          schemaVersion: "workouts_finish_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "workouts_finish_result.v1",
        traceId: input.traceId,
        status: "finished",
        sessionId: result.session_id,
        eventId: result.event_id,
        title: result.title,
        setCount: result.set_count,
        evidence: {
          sessionId: result.session_id,
          eventId: result.event_id,
          eventType: "workout_session_finished",
        },
      };
    },

    async cancelSession(input: CancelWorkoutSessionInput): Promise<CancelWorkoutSessionResult> {
      const { data, error } = await supabase.rpc("sara_cancel_workout_session", {
        p_trace_id: input.traceId,
        p_session_id: input.sessionId ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "workouts_cancel_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CancelSessionRpcResult;

      if (result.error) {
        return {
          schemaVersion: "workouts_cancel_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "workouts_cancel_result.v1",
        traceId: input.traceId,
        status: "canceled",
        sessionId: result.session_id,
        eventId: result.event_id,
        title: result.title,
        evidence: {
          sessionId: result.session_id,
          eventId: result.event_id,
          eventType: "workout_session_canceled",
        },
      };
    },

    async listSessions(input: ListWorkoutSessionsInput): Promise<ListWorkoutSessionsResult> {
      const { data, error } = await supabase.rpc("sara_list_workout_sessions", {
        p_trace_id: input.traceId,
        p_status: input.status ?? null,
        p_limit: input.limit ?? 10,
      });

      if (error) {
        return {
          schemaVersion: "workouts_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          sessions: [],
          count: 0,
          error: error.message,
        };
      }

      const result = data as ListSessionsRpcResult;
      const sessions = (result.sessions || []).map((row) => toSessionRecord(row as unknown as SessionRow));

      return {
        schemaVersion: "workouts_list_result.v1",
        traceId: input.traceId,
        status: "success",
        sessions,
        count: result.count ?? sessions.length,
      };
    },
  };
}
