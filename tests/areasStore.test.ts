import { describe, expect, it, vi } from "vitest";
import { createAreasStore } from "../src/infra/areasStore.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeSupabase(): SupabaseClient {
  const rpc = vi.fn();
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  });
  return {
    rpc,
    from,
  } as unknown as SupabaseClient;
}

describe("areasStore", () => {
  it("createArea calls sara_create_area RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        area_id: "a1",
        event_id: "e1",
        name: "salud",
        slug: "salud",
        trace_id: "trace-1",
        schema_version: "areas_create_result.v1",
      },
      error: null,
    });

    const store = createAreasStore(supabase);
    const result = await store.createArea({
      schemaVersion: "areas_create_input.v1",
      traceId: "trace-1",
      name: "salud",
      slug: "salud",
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.areaId).toBe("a1");
    expect(result.eventId).toBe("e1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_create_area", {
      p_trace_id: "trace-1",
      p_name: "salud",
      p_slug: "salud",
      p_description: null,
      p_source: "chatwoot",
    });
  });

  it("createArea handles RPC error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createAreasStore(supabase);
    const result = await store.createArea({
      schemaVersion: "areas_create_input.v1",
      traceId: "trace-1",
      name: "salud",
      slug: "salud",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("archiveArea calls sara_archive_area RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        area_id: "a1",
        event_id: "e1",
        name: "salud",
        slug: "salud",
        trace_id: "trace-1",
        schema_version: "areas_archive_result.v1",
      },
      error: null,
    });

    const store = createAreasStore(supabase);
    const result = await store.archiveArea({
      schemaVersion: "areas_archive_input.v1",
      traceId: "trace-1",
      slug: "salud",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.areaId).toBe("a1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_archive_area", {
      p_trace_id: "trace-1",
      p_area_id: null,
      p_slug: "salud",
      p_source: "chatwoot",
    });
  });

  it("assignNoteArea calls sara_assign_note_area RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        note_id: "n1",
        area_id: "a1",
        area_name: "salud",
        area_slug: "salud",
        event_id: "e1",
        trace_id: "trace-1",
        schema_version: "areas_assign_note_result.v1",
      },
      error: null,
    });

    const store = createAreasStore(supabase);
    const result = await store.assignNoteArea({
      schemaVersion: "areas_assign_note_input.v1",
      traceId: "trace-1",
      noteId: "n1",
      areaSlug: "salud",
      source: "chatwoot",
    });

    expect(result.status).toBe("assigned");
    expect(result.noteId).toBe("n1");
    expect(result.areaName).toBe("salud");
    expect(result.evidence.areaSlug).toBe("salud");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_assign_note_area", {
      p_trace_id: "trace-1",
      p_note_id: "n1",
      p_area_id: null,
      p_area_slug: "salud",
      p_source: "chatwoot",
    });
  });

  it("assignTaskArea calls sara_assign_task_area RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        task_id: "t1",
        title: "llamar al contador",
        area_id: "a1",
        area_name: "salud",
        area_slug: "salud",
        event_id: "e1",
        trace_id: "trace-1",
        schema_version: "areas_assign_task_result.v1",
      },
      error: null,
    });

    const store = createAreasStore(supabase);
    const result = await store.assignTaskArea({
      schemaVersion: "areas_assign_task_input.v1",
      traceId: "trace-1",
      taskId: "t1",
      areaSlug: "salud",
      source: "chatwoot",
    });

    expect(result.status).toBe("assigned");
    expect(result.taskId).toBe("t1");
    expect(result.title).toBe("llamar al contador");
    expect(result.evidence.areaSlug).toBe("salud");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_assign_task_area", {
      p_trace_id: "trace-1",
      p_task_id: "t1",
      p_area_id: null,
      p_area_slug: "salud",
      p_source: "chatwoot",
    });
  });

  it("listAreas queries sara_areas table", async () => {
    const supabase = fakeSupabase();
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValueOnce({
      data: [
        { id: "a1", name: "salud", slug: "salud", status: "active", created_at: "2026-01-01", updated_at: "2026-01-01" },
      ],
      error: null,
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      select,
      eq,
      order,
      limit,
    });

    const store = createAreasStore(supabase);
    const result = await store.listAreas({
      schemaVersion: "areas_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(1);
    expect(result.areas[0].name).toBe("salud");
    expect(supabase.from).toHaveBeenCalledWith("sara_areas");
  });
});
