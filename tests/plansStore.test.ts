import { describe, expect, it, vi } from "vitest";
import { createPlansStore } from "../src/infra/plansStore.js";
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

describe("plansStore", () => {
  it("createPlan calls sara_create_plan RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        plan_id: "p1",
        event_id: "e1",
        title: "mejorar energia",
        slug: "mejorar-energia",
        objective_id: null,
        step_titles: ["caminar 20 minutos", "dormir antes de 23"],
        trace_id: "trace-1",
        schema_version: "plans_create_result.v1",
      },
      error: null,
    });

    const store = createPlansStore(supabase);
    const result = await store.createPlan({
      schemaVersion: "plans_create_input.v1",
      traceId: "trace-1",
      title: "mejorar energia",
      slug: "mejorar-energia",
      steps: [{ title: "caminar 20 minutos" }, { title: "dormir antes de 23" }],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.planId).toBe("p1");
    expect(result.eventId).toBe("e1");
    expect(result.stepTitles).toEqual(["caminar 20 minutos", "dormir antes de 23"]);
    expect(supabase.rpc).toHaveBeenCalledWith("sara_create_plan", {
      p_trace_id: "trace-1",
      p_title: "mejorar energia",
      p_slug: "mejorar-energia",
      p_description: null,
      p_objective_id: null,
      p_steps: [{ title: "caminar 20 minutos" }, { title: "dormir antes de 23" }],
      p_source: "chatwoot",
    });
  });

  it("createPlan handles RPC error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createPlansStore(supabase);
    const result = await store.createPlan({
      schemaVersion: "plans_create_input.v1",
      traceId: "trace-1",
      title: "test",
      slug: "test",
      steps: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("createPlan handles RPC result error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        error: "plan with slug already exists",
      },
      error: null,
    });

    const store = createPlansStore(supabase);
    const result = await store.createPlan({
      schemaVersion: "plans_create_input.v1",
      traceId: "trace-1",
      title: "test",
      slug: "test",
      steps: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("plan with slug already exists");
  });

  it("archivePlan calls sara_archive_plan RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        plan_id: "p1",
        event_id: "e1",
        title: "mejorar energia",
        slug: "mejorar-energia",
        trace_id: "trace-1",
        schema_version: "plans_archive_result.v1",
      },
      error: null,
    });

    const store = createPlansStore(supabase);
    const result = await store.archivePlan({
      schemaVersion: "plans_archive_input.v1",
      traceId: "trace-1",
      slug: "mejorar-energia",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.planId).toBe("p1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_archive_plan", {
      p_trace_id: "trace-1",
      p_plan_id: null,
      p_slug: "mejorar-energia",
      p_source: "chatwoot",
    });
  });

  it("archivePlan handles RPC error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createPlansStore(supabase);
    const result = await store.archivePlan({
      schemaVersion: "plans_archive_input.v1",
      traceId: "trace-1",
      planId: "p1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("completePlanStep calls sara_complete_plan_step RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        step_id: "s1",
        event_id: "e1",
        plan_id: "p1",
        position: 1,
        title: "caminar 20 minutos",
        trace_id: "trace-1",
        schema_version: "plans_complete_step_result.v1",
      },
      error: null,
    });

    const store = createPlansStore(supabase);
    const result = await store.completePlanStep({
      schemaVersion: "plans_complete_step_input.v1",
      traceId: "trace-1",
      stepId: "s1",
      source: "chatwoot",
    });

    expect(result.status).toBe("completed");
    expect(result.stepId).toBe("s1");
    expect(result.title).toBe("caminar 20 minutos");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_complete_plan_step", {
      p_trace_id: "trace-1",
      p_step_id: "s1",
      p_plan_slug: null,
      p_step_position: null,
      p_source: "chatwoot",
    });
  });

  it("completePlanStep works by planSlug and position", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        step_id: "s2",
        event_id: "e2",
        plan_id: "p1",
        position: 2,
        title: "dormir antes de 23",
        trace_id: "trace-1",
        schema_version: "plans_complete_step_result.v1",
      },
      error: null,
    });

    const store = createPlansStore(supabase);
    const result = await store.completePlanStep({
      schemaVersion: "plans_complete_step_input.v1",
      traceId: "trace-1",
      planSlug: "mejorar-energia",
      stepPosition: 2,
      source: "chatwoot",
    });

    expect(result.status).toBe("completed");
    expect(result.stepId).toBe("s2");
    expect(result.title).toBe("dormir antes de 23");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_complete_plan_step", {
      p_trace_id: "trace-1",
      p_step_id: null,
      p_plan_slug: "mejorar-energia",
      p_step_position: 2,
      p_source: "chatwoot",
    });
  });

  it("listPlans calls sara_list_plans RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        plans: [
          {
            id: "p1",
            title: "mejorar energia",
            slug: "mejorar-energia",
            status: "active",
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
            steps: [
              { id: "s1", position: 1, title: "caminar 20 minutos", status: "pending", created_at: "2026-01-01", updated_at: "2026-01-01" },
              { id: "s2", position: 2, title: "dormir antes de 23", status: "pending", created_at: "2026-01-01", updated_at: "2026-01-01" },
            ],
          },
        ],
        count: 1,
        trace_id: "trace-1",
        schema_version: "plans_list_result.v1",
      },
      error: null,
    });

    const store = createPlansStore(supabase);
    const result = await store.listPlans({
      schemaVersion: "plans_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(1);
    expect(result.plans[0].title).toBe("mejorar energia");
    expect(result.plans[0].steps.length).toBe(2);
    expect(result.plans[0].steps[0].title).toBe("caminar 20 minutos");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_list_plans", {
      p_trace_id: "trace-1",
      p_status: "active",
      p_limit: 10,
    });
  });

  it("listPlans handles RPC error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createPlansStore(supabase);
    const result = await store.listPlans({
      schemaVersion: "plans_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });
});
