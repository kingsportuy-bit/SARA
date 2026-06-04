import { describe, expect, it, vi } from "vitest";
import { createRoutinesStore } from "../src/infra/routinesStore.js";
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

describe("routinesStore", () => {
  it("createRoutine calls sara_create_routine RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        routine_id: "r1",
        event_id: "e1",
        name: "manana normal",
        slug: "manana-normal",
        trace_id: "trace-1",
        schema_version: "routines_create_result.v1",
      },
      error: null,
    });

    const store = createRoutinesStore(supabase);
    const result = await store.createRoutine({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "manana normal",
      slug: "manana-normal",
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.routineId).toBe("r1");
    expect(result.eventId).toBe("e1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_create_routine", {
      p_trace_id: "trace-1",
      p_name: "manana normal",
      p_slug: "manana-normal",
      p_description: null,
      p_area_id: null,
      p_area_slug: null,
      p_steps: [],
      p_source: "chatwoot",
    });
  });

  it("createRoutine handles RPC error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createRoutinesStore(supabase);
    const result = await store.createRoutine({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "test",
      slug: "test",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("createRoutine handles RPC result error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        error: "routine with slug \"test\" already exists",
      },
      error: null,
    });

    const store = createRoutinesStore(supabase);
    const result = await store.createRoutine({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "test",
      slug: "test",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("already exists");
  });

  it("createRoutine passes steps as array", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        routine_id: "r1",
        event_id: "e1",
        name: "manana normal",
        slug: "manana-normal",
        trace_id: "trace-1",
        schema_version: "routines_create_result.v1",
      },
      error: null,
    });

    const store = createRoutinesStore(supabase);
    const result = await store.createRoutine({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "manana normal",
      slug: "manana-normal",
      steps: [
        { position: 1, timeOfDay: "07:00", title: "despertar" },
        { position: 2, title: "desayuno" },
      ],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_create_routine", expect.objectContaining({
      p_steps: [
        { position: 1, time_of_day: "07:00", title: "despertar", description: null, duration_minutes: null, metadata: {} },
        { position: 2, time_of_day: null, title: "desayuno", description: null, duration_minutes: null, metadata: {} },
      ],
    }));
  });

  it("activateRoutine calls sara_activate_routine RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        routine_id: "r1",
        event_id: "e1",
        name: "manana normal",
        slug: "manana-normal",
        trace_id: "trace-1",
        schema_version: "routines_activate_result.v1",
      },
      error: null,
    });

    const store = createRoutinesStore(supabase);
    const result = await store.activateRoutine({
      schemaVersion: "routines_activate_input.v1",
      traceId: "trace-1",
      slug: "manana-normal",
      source: "chatwoot",
    });

    expect(result.status).toBe("activated");
    expect(result.routineId).toBe("r1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_activate_routine", {
      p_trace_id: "trace-1",
      p_routine_id: null,
      p_slug: "manana-normal",
      p_source: "chatwoot",
    });
  });

  it("pauseRoutine calls sara_pause_routine RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        routine_id: "r1",
        event_id: "e1",
        name: "manana normal",
        slug: "manana-normal",
        trace_id: "trace-1",
        schema_version: "routines_pause_result.v1",
      },
      error: null,
    });

    const store = createRoutinesStore(supabase);
    const result = await store.pauseRoutine({
      schemaVersion: "routines_pause_input.v1",
      traceId: "trace-1",
      slug: "manana-normal",
      source: "chatwoot",
    });

    expect(result.status).toBe("paused");
    expect(result.routineId).toBe("r1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_pause_routine", {
      p_trace_id: "trace-1",
      p_routine_id: null,
      p_slug: "manana-normal",
      p_source: "chatwoot",
    });
  });

  it("archiveRoutine calls sara_archive_routine RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        routine_id: "r1",
        event_id: "e1",
        name: "manana normal",
        slug: "manana-normal",
        trace_id: "trace-1",
        schema_version: "routines_archive_result.v1",
      },
      error: null,
    });

    const store = createRoutinesStore(supabase);
    const result = await store.archiveRoutine({
      schemaVersion: "routines_archive_input.v1",
      traceId: "trace-1",
      slug: "manana-normal",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.routineId).toBe("r1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_archive_routine", {
      p_trace_id: "trace-1",
      p_routine_id: null,
      p_slug: "manana-normal",
      p_source: "chatwoot",
    });
  });

  it("listRoutines calls sara_list_routines RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        routines: [
          { id: "r1", name: "manana normal", slug: "manana-normal", status: "active", schedule: {}, steps: [], created_at: "2026-01-01", updated_at: "2026-01-01" },
        ],
        count: 1,
        status: "success",
      },
      error: null,
    });

    const store = createRoutinesStore(supabase);
    const result = await store.listRoutines({
      schemaVersion: "routines_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(1);
    expect(result.routines[0].name).toBe("manana normal");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_list_routines", {
      p_status: "active",
      p_limit: 10,
    });
  });
});
