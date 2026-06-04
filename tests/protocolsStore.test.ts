import { describe, expect, it, vi } from "vitest";
import { createProtocolsStore } from "../src/infra/protocolsStore.js";
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

describe("protocolsStore", () => {
  it("createProtocol calls sara_create_protocol RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        protocol_id: "p1",
        event_id: "e1",
        name: "energia baja",
        slug: "energia-baja",
        scope: "daily",
        status: "draft",
        trace_id: "trace-1",
        schema_version: "protocols_create_result.v1",
      },
      error: null,
    });

    const store = createProtocolsStore(supabase);
    const result = await store.createProtocol({
      schemaVersion: "protocols_create_input.v1",
      traceId: "trace-1",
      name: "energia baja",
      slug: "energia-baja",
      scope: "daily",
      rules: [{ condition: "dormi menos de 6 horas", action: "bajar carga" }],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.protocolId).toBe("p1");
    expect(result.eventId).toBe("e1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_create_protocol", {
      p_trace_id: "trace-1",
      p_name: "energia baja",
      p_slug: "energia-baja",
      p_scope: "daily",
      p_rules: [{ condition: "dormi menos de 6 horas", action: "bajar carga" }],
      p_description: null,
      p_source: "chatwoot",
    });
  });

  it("createProtocol handles RPC error", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const store = createProtocolsStore(supabase);
    const result = await store.createProtocol({
      schemaVersion: "protocols_create_input.v1",
      traceId: "trace-1",
      name: "test",
      slug: "test",
      scope: "daily",
      rules: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("activateProtocol calls sara_activate_protocol RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        protocol_id: "p1",
        event_id: "e1",
        name: "energia baja",
        slug: "energia-baja",
        scope: "daily",
        trace_id: "trace-1",
        schema_version: "protocols_activate_result.v1",
      },
      error: null,
    });

    const store = createProtocolsStore(supabase);
    const result = await store.activateProtocol({
      schemaVersion: "protocols_activate_input.v1",
      traceId: "trace-1",
      slug: "energia-baja",
      source: "chatwoot",
    });

    expect(result.status).toBe("activated");
    expect(result.protocolId).toBe("p1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_activate_protocol", {
      p_trace_id: "trace-1",
      p_protocol_id: null,
      p_slug: "energia-baja",
      p_source: "chatwoot",
    });
  });

  it("archiveProtocol calls sara_archive_protocol RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        protocol_id: "p1",
        event_id: "e1",
        name: "energia baja",
        slug: "energia-baja",
        scope: "daily",
        trace_id: "trace-1",
        schema_version: "protocols_archive_result.v1",
      },
      error: null,
    });

    const store = createProtocolsStore(supabase);
    const result = await store.archiveProtocol({
      schemaVersion: "protocols_archive_input.v1",
      traceId: "trace-1",
      slug: "energia-baja",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.protocolId).toBe("p1");
    expect(supabase.rpc).toHaveBeenCalledWith("sara_archive_protocol", {
      p_trace_id: "trace-1",
      p_protocol_id: null,
      p_slug: "energia-baja",
      p_source: "chatwoot",
    });
  });

  it("evaluateProtocol calls sara_log_protocol_evaluation RPC", async () => {
    const supabase = fakeSupabase();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        protocol_id: "p1",
        event_id: "e1",
        name: "energia baja",
        slug: "energia-baja",
        scope: "daily",
        status: "active",
        trace_id: "trace-1",
        schema_version: "protocols_evaluate_result.v1",
      },
      error: null,
    });

    const store = createProtocolsStore(supabase);
    const result = await store.evaluateProtocol({
      schemaVersion: "protocols_evaluate_input.v1",
      traceId: "trace-1",
      slug: "energia-baja",
      context: {
        sleepHours: 5,
        rulesEvaluated: 1,
        rulesMatched: 1,
        suggestions: [
          {
            rule: { condition: "dormi menos de 6 horas", action: "bajar carga" },
            applies: true,
            suggestion: "bajar carga",
            evidence: "sleepHours: 5 < 6",
          },
        ],
      },
      source: "chatwoot",
    });

    expect(result.status).toBe("evaluated");
    expect(result.protocolId).toBe("p1");
    expect(result.evidence.eventType).toBe("protocol_evaluated");
    expect(result.evidence.rulesCount).toBe(1);
    expect(result.evidence.rulesMatched).toBe(1);
    expect(supabase.rpc).toHaveBeenCalledWith("sara_log_protocol_evaluation", expect.objectContaining({
      p_trace_id: "trace-1",
      p_slug: "energia-baja",
    }));
  });

  it("listProtocols queries sara_protocols table", async () => {
    const supabase = fakeSupabase();
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          name: "energia baja",
          slug: "energia-baja",
          status: "active",
          scope: "daily",
          rules: [{ condition: "dormi menos de 6 horas", action: "bajar carga" }],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
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

    const store = createProtocolsStore(supabase);
    const result = await store.listProtocols({
      schemaVersion: "protocols_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(1);
    expect(result.protocols[0].name).toBe("energia baja");
    expect(result.protocols[0].rules).toHaveLength(1);
    expect(result.protocols[0].rules[0].condition).toBe("dormi menos de 6 horas");
    expect(supabase.from).toHaveBeenCalledWith("sara_protocols");
  });
});
