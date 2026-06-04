import { describe, expect, it, vi } from "vitest";
import { createWorkoutsStore } from "../src/infra/workoutsStore.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeSupabase(): SupabaseClient {
  const rpc = vi.fn();
  return {
    rpc,
  } as unknown as SupabaseClient;
}

describe("workoutsStore", () => {
  it("startSession calls sara_start_workout_session RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        session_id: "s1",
        event_id: "e1",
        title: "piernas",
        trace_id: "trace-1",
        schema_version: "workouts_start_result.v1",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.startSession({
      schemaVersion: "workouts_start_input.v1",
      traceId: "trace-1",
      title: "piernas",
      source: "chatwoot",
    });

    expect(result.status).toBe("started");
    expect(result.sessionId).toBe("s1");
    expect(result.eventId).toBe("e1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_start_workout_session", {
      p_trace_id: "trace-1",
      p_title: "piernas",
      p_routine_id: null,
      p_area_id: null,
      p_objective_id: null,
      p_source: "chatwoot",
    });
  });

  it("startSession handles already active session error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        error: "there is already an active workout session",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.startSession({
      schemaVersion: "workouts_start_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("already an active workout session");
  });

  it("startSession handles RPC error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB connection error" },
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.startSession({
      schemaVersion: "workouts_start_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB connection error");
  });

  it("logSet calls sara_log_workout_set RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        set_id: "w1",
        event_id: "e1",
        session_id: "s1",
        exercise_name: "sentadilla",
        set_number: 1,
        trace_id: "trace-1",
        schema_version: "workouts_set_result.v1",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "s1",
      exerciseName: "sentadilla",
      setNumber: 1,
      actualReps: 8,
      weightKg: 60,
      source: "chatwoot",
    });

    expect(result.status).toBe("logged");
    expect(result.setId).toBe("w1");
    expect(result.exerciseName).toBe("sentadilla");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_log_workout_set", {
      p_trace_id: "trace-1",
      p_session_id: "s1",
      p_exercise_name: "sentadilla",
      p_set_number: 1,
      p_target_reps: null,
      p_actual_reps: 8,
      p_weight_kg: 60,
      p_duration_seconds: null,
      p_rest_seconds: null,
      p_notes: null,
      p_source: "chatwoot",
    });
  });

  it("logSet handles session not found error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        error: "active workout session not found",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "bad-id",
      exerciseName: "sentadilla",
      setNumber: 1,
      actualReps: 8,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("active workout session not found");
  });

  it("finishSession calls sara_finish_workout_session RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        session_id: "s1",
        event_id: "e1",
        title: "piernas",
        set_count: 5,
        trace_id: "trace-1",
        schema_version: "workouts_finish_result.v1",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.finishSession({
      schemaVersion: "workouts_finish_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("finished");
    expect(result.sessionId).toBe("s1");
    expect(result.setCount).toBe(5);
    expect(supabase.rpc).toHaveBeenCalledWith("sara_finish_workout_session", {
      p_trace_id: "trace-1",
      p_session_id: null,
      p_notes: null,
      p_source: "chatwoot",
    });
  });

  it("finishSession handles no active session error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        error: "no active workout session found",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.finishSession({
      schemaVersion: "workouts_finish_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("no active workout session found");
  });

  it("cancelSession calls sara_cancel_workout_session RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        session_id: "s1",
        event_id: "e1",
        title: "piernas",
        trace_id: "trace-1",
        schema_version: "workouts_cancel_result.v1",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.cancelSession({
      schemaVersion: "workouts_cancel_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("canceled");
    expect(result.sessionId).toBe("s1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_cancel_workout_session", {
      p_trace_id: "trace-1",
      p_session_id: null,
      p_source: "chatwoot",
    });
  });

  it("cancelSession handles no active session error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        error: "no active workout session found",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.cancelSession({
      schemaVersion: "workouts_cancel_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("no active workout session found");
  });

  it("listSessions calls sara_list_workout_sessions RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        sessions: [
          {
            id: "s1",
            schema_version: "workouts_session.v1",
            title: "piernas",
            status: "finished",
            started_at: "2026-06-01T10:00:00Z",
            finished_at: "2026-06-01T11:00:00Z",
            created_at: "2026-06-01T10:00:00Z",
            updated_at: "2026-06-01T11:00:00Z",
            set_count: 5,
          },
        ],
        count: 1,
        trace_id: "trace-1",
        schema_version: "workouts_list_result.v1",
      },
      error: null,
    });

    const store = createWorkoutsStore(supabase);
    const result = await store.listSessions({
      schemaVersion: "workouts_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.sessions.length).toBe(1);
    expect(result.count).toBe(1);
    expect(result.sessions[0].title).toBe("piernas");
    expect(result.sessions[0].setCount).toBe(5);
    expect(supabase.rpc).toHaveBeenCalledWith("sara_list_workout_sessions", {
      p_trace_id: "trace-1",
      p_status: null,
      p_limit: 10,
    });
  });
});
