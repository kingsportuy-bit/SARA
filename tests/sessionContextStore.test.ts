import { describe, expect, it } from "vitest";
import { createSessionContextStore } from "../src/infra/sessionContextStore.js";

function fakeSupabase(rpcOverrides?: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  const defaultRpc = async (fn: string, _params: Record<string, unknown>) => {
    if (fn === "sara_get_session_context") {
      return { data: null, error: null };
    }
    if (fn === "sara_upsert_session_context") {
      return {
        data: {
          id: "ctx-1",
          schemaVersion: "session_context.v1",
          accountId: 7,
          inboxId: 45,
          conversationId: 85,
          activeModule: null,
          activeFlow: null,
          focusedEntityType: null,
          focusedEntityId: null,
          awaitingConfirmation: false,
          confirmationPayload: null,
          context: {},
          expiresAt: null,
          createdAt: "2026-06-03T00:00:00Z",
          updatedAt: "2026-06-03T00:00:00Z",
          eventId: "e1",
          isNew: true,
        },
        error: null,
      };
    }
    if (fn === "sara_clear_session_context") {
      return { data: { cleared: true }, error: null };
    }
    return { data: null, error: new Error("unknown RPC") };
  };

  const rpc = rpcOverrides ?? defaultRpc;

  return {
    rpc,
  } as any;
}

describe("sessionContextStore", () => {
  it("get returns context when RPC returns valid data", async () => {
    const fakeCtx = {
      id: "ctx-get-1",
      schemaVersion: "session_context.v1",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      activeModule: "tasks",
      activeFlow: "task_created",
      focusedEntityType: "task",
      focusedEntityId: "task-1",
      awaitingConfirmation: false,
      confirmationPayload: null,
      context: { lastTaskTitle: "llamar al contador" },
      expiresAt: null,
      createdAt: "2026-06-03T00:00:00Z",
      updatedAt: "2026-06-03T00:00:00Z",
    };

    const supabase = fakeSupabase(async (fn, _params) => {
      if (fn === "sara_get_session_context") return { data: fakeCtx, error: null };
      return { data: null, error: new Error("unknown") };
    });

    const store = createSessionContextStore(supabase);
    const result = await store.get({ accountId: 7, inboxId: 45, conversationId: 85 });

    expect(result.context).not.toBeNull();
    expect(result.context?.id).toBe("ctx-get-1");
    expect(result.context?.activeModule).toBe("tasks");
    expect(result.context?.focusedEntityType).toBe("task");
    expect(result.context?.focusedEntityId).toBe("task-1");
    expect(result.context?.context).toEqual({ lastTaskTitle: "llamar al contador" });
  });

  it("get returns null when RPC returns no data (expired or absent)", async () => {
    const supabase = fakeSupabase(async (fn, _params) => {
      return { data: null, error: null };
    });

    const store = createSessionContextStore(supabase);
    const result = await store.get({ accountId: 7, inboxId: 45, conversationId: 85 });

    expect(result.context).toBeNull();
  });

  it("get returns null when RPC has error", async () => {
    const supabase = fakeSupabase(async (fn, _params) => {
      return { data: null, error: { message: "db error" } };
    });

    const store = createSessionContextStore(supabase);
    const result = await store.get({ accountId: 7, inboxId: 45, conversationId: 85 });

    expect(result.context).toBeNull();
  });

  it("upsert calls sara_upsert_session_context with correct params", async () => {
    let capturedFn = "";
    let capturedParams: Record<string, unknown> = {};
    const supabase = fakeSupabase(async (fn, params) => {
      capturedFn = fn;
      capturedParams = params;
      return {
        data: {
          id: "ctx-upsert-1",
          schemaVersion: "session_context.v1",
          accountId: 7,
          inboxId: 45,
          conversationId: 85,
          activeModule: "tasks",
          activeFlow: "task_created",
          focusedEntityType: "task",
          focusedEntityId: "task-1",
          awaitingConfirmation: false,
          confirmationPayload: null,
          context: { lastTaskTitle: "test" },
          expiresAt: null,
          createdAt: "now",
          updatedAt: "now",
          eventId: "e1",
          isNew: true,
        },
        error: null,
      };
    });

    const store = createSessionContextStore(supabase);
    const result = await store.upsert({
      traceId: "t1",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      activeModule: "tasks",
      focusedEntityType: "task",
      focusedEntityId: "task-1",
      context: { lastTaskTitle: "test" },
    });

    expect(capturedFn).toBe("sara_upsert_session_context");
    expect(capturedParams.p_trace_id).toBe("t1");
    expect(capturedParams.p_account_id).toBe(7);
    expect(capturedParams.p_inbox_id).toBe(45);
    expect(capturedParams.p_conversation_id).toBe(85);
    expect(capturedParams.p_active_module).toBe("tasks");
    expect(capturedParams.p_context).toEqual({ lastTaskTitle: "test" });
    expect(result.isNew).toBe(true);
    expect(result.context.id).toBe("ctx-upsert-1");
  });

  it("upsert throws when RPC fails", async () => {
    const supabase = fakeSupabase(async (_fn, _params) => {
      return { data: null, error: { message: "rpc error" } };
    });

    const store = createSessionContextStore(supabase);
    await expect(store.upsert({
      traceId: "t3", accountId: 7, inboxId: 45, conversationId: 85,
    })).rejects.toThrow("sara_upsert_session_context failed: rpc error");
  });

  it("clear calls sara_clear_session_context and returns result", async () => {
    let capturedFn = "";
    let capturedParams: Record<string, unknown> = {};
    const supabase = fakeSupabase(async (fn, params) => {
      capturedFn = fn;
      capturedParams = params;
      return { data: { cleared: true }, error: null };
    });

    const store = createSessionContextStore(supabase);
    const result = await store.clear({ traceId: "t2", accountId: 7, inboxId: 45, conversationId: 85 });

    expect(capturedFn).toBe("sara_clear_session_context");
    expect(capturedParams.p_trace_id).toBe("t2");
    expect(capturedParams.p_account_id).toBe(7);
    expect(capturedParams.p_inbox_id).toBe(45);
    expect(capturedParams.p_conversation_id).toBe(85);
    expect(result.cleared).toBe(true);
  });

  it("clear throws when RPC fails", async () => {
    const supabase = fakeSupabase(async (_fn, _params) => {
      return { data: null, error: { message: "rpc error" } };
    });

    const store = createSessionContextStore(supabase);
    await expect(store.clear({
      traceId: "t4", accountId: 7, inboxId: 45, conversationId: 85,
    })).rejects.toThrow("sara_clear_session_context failed: rpc error");
  });
});
