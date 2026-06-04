import { describe, expect, it, vi } from "vitest";
import { createTimersStore } from "../src/infra/timersStore.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeSupabase(): SupabaseClient {
  const rpc = vi.fn();
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  });
  return {
    rpc,
    from,
  } as unknown as SupabaseClient;
}

describe("timersStore - startTimer", () => {
  it("calls sara_start_timer RPC with correct params", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        timer_id: "t1",
        event_id: "e1",
        kind: "workout_rest",
        title: "Descanso 90s",
        duration_seconds: 90,
        due_at: "2026-06-03T22:00:00Z",
        trace_id: "trace-1",
        schema_version: "timers_start_result.v1",
      },
      error: null,
    });

    const store = createTimersStore(supabase);
    const result = await store.startTimer({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "workout_rest",
      title: "Descanso 90s",
      durationSeconds: 90,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("started");
    expect(result.timerId).toBe("t1");
    expect(result.eventId).toBe("e1");
    expect(result.kind).toBe("workout_rest");
    expect(result.durationSeconds).toBe(90);
    expect(result.evidence.eventType).toBe("timer_started");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_start_timer", {
      p_trace_id: "trace-1",
      p_kind: "workout_rest",
      p_title: "Descanso 90s",
      p_duration_seconds: 90,
      p_related_entity_type: null,
      p_related_entity_id: null,
      p_account_id: 7,
      p_inbox_id: 45,
      p_conversation_id: 85,
      p_source: "chatwoot",
    });
  });

  it("handles RPC error gracefully", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createTimersStore(supabase);
    const result = await store.startTimer({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "generic",
      title: "Timer",
      durationSeconds: 60,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("handles RPC function error in result", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { error: "duration must be positive" },
      error: null,
    });

    const store = createTimersStore(supabase);
    const result = await store.startTimer({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "generic",
      title: "Timer",
      durationSeconds: -5,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("duration must be positive");
  });
});

describe("timersStore - cancelTimer", () => {
  it("calls sara_cancel_timer RPC with correct params", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        timer_id: "t1",
        event_id: "e1",
        kind: "workout_rest",
        title: "Descanso 90s",
        trace_id: "trace-1",
        schema_version: "timers_cancel_result.v1",
      },
      error: null,
    });

    const store = createTimersStore(supabase);
    const result = await store.cancelTimer({
      schemaVersion: "timers_cancel_input.v1",
      traceId: "trace-1",
      timerId: "t1",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("canceled");
    expect(result.timerId).toBe("t1");
    expect(result.evidence.eventType).toBe("timer_canceled");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_cancel_timer", {
      p_trace_id: "trace-1",
      p_timer_id: "t1",
      p_account_id: 7,
      p_inbox_id: 45,
      p_conversation_id: 85,
      p_source: "chatwoot",
    });
  });
});

describe("timersStore - claimDueTimers", () => {
  it("calls sara_claim_due_timers and maps results", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        {
          timer_id: "t1",
          kind: "workout_rest",
          title: "Descanso 90s",
          duration_seconds: 90,
          due_at: "2026-06-03T22:00:00Z",
          related_entity_type: null,
          related_entity_id: null,
          trace_id: "trace-1",
          created_at: "2026-06-03T21:59:00Z",
        },
      ],
      error: null,
    });

    const store = createTimersStore(supabase);
    const result = await store.claimDueTimers({
      schemaVersion: "timers_claim_due_input.v1",
      traceId: "trace-1",
      limit: 10,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(1);
    expect(result.timers[0].id).toBe("t1");
    expect(result.timers[0].kind).toBe("workout_rest");
    expect(result.timers[0].durationSeconds).toBe(90);
    expect(supabase.rpc).toHaveBeenCalledWith("sara_claim_due_timers", {
      p_limit: 10,
      p_account_id: 7,
      p_inbox_id: 45,
      p_conversation_id: 85,
    });
  });

  it("handles RPC error gracefully", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createTimersStore(supabase);
    const result = await store.claimDueTimers({
      schemaVersion: "timers_claim_due_input.v1",
      traceId: "trace-1",
      limit: 10,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("handles empty results", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const store = createTimersStore(supabase);
    const result = await store.claimDueTimers({
      schemaVersion: "timers_claim_due_input.v1",
      traceId: "trace-1",
      limit: 10,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(0);
    expect(result.timers).toEqual([]);
  });
});

describe("timersStore - markTimerFired", () => {
  it("calls sara_mark_timer_fired RPC with correct params", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        timer_id: "t1",
        event_id: "e1",
        kind: "workout_rest",
        title: "Descanso 90s",
        trace_id: "trace-1",
        schema_version: "timers_mark_fired_result.v1",
      },
      error: null,
    });

    const store = createTimersStore(supabase);
    const result = await store.markTimerFired({
      schemaVersion: "timers_mark_fired_input.v1",
      traceId: "trace-1",
      timerId: "t1",
      source: "chatwoot",
    });

    expect(result.status).toBe("fired");
    expect(result.timerId).toBe("t1");
    expect(result.evidence.eventType).toBe("timer_fired");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_mark_timer_fired", {
      p_trace_id: "trace-1",
      p_timer_id: "t1",
      p_source: "chatwoot",
    });
  });

  it("handles RPC function error in result", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { error: "timer is not pending" },
      error: null,
    });

    const store = createTimersStore(supabase);
    const result = await store.markTimerFired({
      schemaVersion: "timers_mark_fired_input.v1",
      traceId: "trace-1",
      timerId: "t1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("timer is not pending");
  });
});
