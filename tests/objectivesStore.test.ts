import { describe, expect, it, vi } from "vitest";
import { createObjectivesStore } from "../src/infra/objectivesStore.js";
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

describe("objectivesStore", () => {
  it("createObjective calls sara_create_objective RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        objective_id: "o1",
        event_id: "e1",
        title: "mejorar mi energia",
        slug: "mejorar-mi-energia",
        area_id: null,
        area_name: null,
        trace_id: "trace-1",
        schema_version: "objectives_create_result.v1",
      },
      error: null,
    });

    const store = createObjectivesStore(supabase);
    const result = await store.createObjective({
      schemaVersion: "objectives_create_input.v1",
      traceId: "trace-1",
      title: "mejorar mi energia",
      slug: "mejorar-mi-energia",
      successCriteria: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.objectiveId).toBe("o1");
    expect(result.eventId).toBe("e1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_create_objective", {
      p_trace_id: "trace-1",
      p_title: "mejorar mi energia",
      p_slug: "mejorar-mi-energia",
      p_description: null,
      p_area_id: null,
      p_area_slug: null,
      p_target_date: null,
      p_success_criteria: [],
      p_source: "chatwoot",
    });
  });

  it("createObjective handles RPC error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createObjectivesStore(supabase);
    const result = await store.createObjective({
      schemaVersion: "objectives_create_input.v1",
      traceId: "trace-1",
      title: "test",
      slug: "test",
      successCriteria: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("achieveObjective calls sara_achieve_objective RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        objective_id: "o1",
        event_id: "e1",
        title: "mejorar mi energia",
        slug: "mejorar-mi-energia",
        trace_id: "trace-1",
        schema_version: "objectives_achieve_result.v1",
      },
      error: null,
    });

    const store = createObjectivesStore(supabase);
    const result = await store.achieveObjective({
      schemaVersion: "objectives_achieve_input.v1",
      traceId: "trace-1",
      slug: "mejorar-mi-energia",
      source: "chatwoot",
    });

    expect(result.status).toBe("achieved");
    expect(result.objectiveId).toBe("o1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_achieve_objective", {
      p_trace_id: "trace-1",
      p_objective_id: null,
      p_slug: "mejorar-mi-energia",
      p_source: "chatwoot",
    });
  });

  it("archiveObjective calls sara_archive_objective RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        objective_id: "o1",
        event_id: "e1",
        title: "mejorar mi energia",
        slug: "mejorar-mi-energia",
        trace_id: "trace-1",
        schema_version: "objectives_archive_result.v1",
      },
      error: null,
    });

    const store = createObjectivesStore(supabase);
    const result = await store.archiveObjective({
      schemaVersion: "objectives_archive_input.v1",
      traceId: "trace-1",
      slug: "mejorar-mi-energia",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.objectiveId).toBe("o1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_archive_objective", {
      p_trace_id: "trace-1",
      p_objective_id: null,
      p_slug: "mejorar-mi-energia",
      p_source: "chatwoot",
    });
  });

  it("assignTaskObjective calls sara_assign_task_objective RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        task_id: "t1",
        task_title: "llamar al contador",
        objective_id: "o1",
        objective_title: "facturar mas",
        objective_slug: "facturar-mas",
        event_id: "e1",
        trace_id: "trace-1",
        schema_version: "objectives_assign_task_result.v1",
      },
      error: null,
    });

    const store = createObjectivesStore(supabase);
    const result = await store.assignTaskObjective({
      schemaVersion: "objectives_assign_task_input.v1",
      traceId: "trace-1",
      taskId: "t1",
      objectiveSlug: "facturar-mas",
      source: "chatwoot",
    });

    expect(result.status).toBe("assigned");
    expect(result.taskId).toBe("t1");
    expect(result.taskTitle).toBe("llamar al contador");
    expect(result.objectiveTitle).toBe("facturar mas");
    expect(result.evidence.objectiveSlug).toBe("facturar-mas");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_assign_task_objective", {
      p_trace_id: "trace-1",
      p_task_id: "t1",
      p_objective_id: null,
      p_objective_slug: "facturar-mas",
      p_source: "chatwoot",
    });
  });

  it("listObjectives queries sara_objectives table", async () => {
    const supabase = fakeSupabase();
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValueOnce({
      data: [
        { id: "o1", title: "mejorar mi energia", slug: "mejorar-mi-energia", status: "active", success_criteria: [], created_at: "2026-01-01", updated_at: "2026-01-01" },
      ],
      error: null,
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      select,
      eq,
      order,
      limit,
      single: vi.fn(),
    });

    const store = createObjectivesStore(supabase);
    const result = await store.listObjectives({
      schemaVersion: "objectives_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(1);
    expect(result.objectives[0].title).toBe("mejorar mi energia");
    expect(supabase.from).toHaveBeenCalledWith("sara_objectives");
  });
});
