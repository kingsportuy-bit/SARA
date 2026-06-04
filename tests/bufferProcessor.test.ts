import { describe, expect, it, vi } from "vitest";
import { createBufferProcessor } from "../src/modules/bufferProcessor.js";
import { createCoarseClassifier } from "../src/modules/coarseClassifier.js";
import { createModuleIntentClassifier } from "../src/modules/moduleIntentClassifier.js";
import { createModuleRouter, registerModule } from "../src/modules/moduleRouter.js";
import { createActionExecutor } from "../src/modules/actionExecutor.js";
import { createResponseComposer } from "../src/modules/responseComposer.js";
import { createMessageNormalizer } from "../src/modules/messageNormalizer.js";
import { createNotesModule } from "../src/modules/notes/notesModule.js";
import type { MessageStore, OutboundChatwoot, ResponseGenerator } from "../src/contracts.js";
import type { ActionExecutionInput, ActionExecutionResult } from "../src/contracts/pipeline.js";

function fakeStore(buffers?: Array<{ bid: string; tid: string; cid: number; msgs: Array<{ id: number; content: string }> }>) {
  const complete = vi.fn();
  const fail = vi.fn();
  return {
    store: {
      async claimDue() {
        return (buffers ?? []).map((b) => ({
          buffer_id: b.bid,
          trace_id: b.tid,
          account_id: 7,
          inbox_id: 45,
          conversation_id: b.cid,
          messages: b.msgs.map((m) => ({ id: m.id, content: m.content, created_at: "2026-06-03T00:00:00Z" })),
        }));
      },
      complete,
      fail,
      async ingest() { return { accepted: true, duplicate: false }; },
    } as unknown as MessageStore,
    complete,
    fail,
  };
}

function fakeOutbound() {
  const send = vi.fn(async (_cid: number, _content: string) => ({ id: 99 }));
  return { outbound: { send } as OutboundChatwoot, send };
}

function fakeGenerator(response = "fallback response") {
  const generate = vi.fn(async () => response);
  return { generator: { generate } as ResponseGenerator, generate };
}

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

function buildProcessor(buffers: Array<{ bid: string; tid: string; cid: number; msgs: Array<{ id: number; content: string }> }>) {
  const { store, complete, fail } = fakeStore(buffers);
  const { outbound, send } = fakeOutbound();
  const { generator, generate } = fakeGenerator();
  const logger = fakeLogger();

  const proc = createBufferProcessor({
    store,
    normalizer: createMessageNormalizer(),
    coarseClassifier: createCoarseClassifier(),
    intentClassifier: createModuleIntentClassifier(),
    router: createModuleRouter(),
    executor: createActionExecutor({}),
    composer: createResponseComposer(),
    fallbackGenerator: generator,
    outbound,
    logger,
  });

  return { proc, store, complete, fail, send, generate, logger };
}

describe("bufferProcessor", () => {
  it("uses DeepSeek fallback for non-note message", async () => {
    const { proc, generate, send, complete } = buildProcessor([
      { bid: "b1", tid: "t1", cid: 85, msgs: [{ id: 1, content: "hola como estas" }] },
    ]);

    await proc.processDue();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(85, "fallback response");
    expect(complete).toHaveBeenCalledWith("b1", "fallback response", 99);
  });

  it("executes notes.create for nota: message with handler", async () => {
    registerModule("notes", ["create"]);

    const notesRepo = {
      async createNote() {
        return {
          schemaVersion: "notes_create_result.v1" as const,
          traceId: "t1",
          status: "created" as const,
          noteId: "note-1",
          eventId: "event-1",
          evidence: { noteId: "note-1", eventId: "event-1", eventType: "note_created" as const },
        };
      },
    };
    const notesMod = createNotesModule(notesRepo);

    function notesHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
      return notesMod.create({
        schemaVersion: "notes_create_input.v1",
        traceId: input.traceId,
        content: String(input.entities.content ?? ""),
        noteType: (input.entities.noteType as any) || "observacion",
        source: "chatwoot",
        tags: [],
      }).then((r) => {
        if (r.status === "created") {
          return {
            schemaVersion: "action_execution_result.v1",
            traceId: input.traceId,
            status: "executed",
            evidence: { noteId: r.noteId, eventId: r.eventId },
            stateChanges: [{ entityType: "note", entityId: r.noteId, eventType: "note_created", payload: {} }],
          };
        }
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          stateChanges: [],
          error: r.error,
        };
      });
    }

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b2", tid: "t2", cid: 85, msgs: [{ id: 1, content: "nota: recordar dormir" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ notes: { create: notesHandler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b2", expect.any(String), 99);
  });

  it("uses DeepSeek fallback when notes.create has no content and handler blocks it", async () => {
    registerModule("notes", ["create"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "",
      status: "failed",
      evidence: { reason: "content required" },
      stateChanges: [],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b3", tid: "t3", cid: 85, msgs: [{ id: 1, content: "nota:" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator("sin contenido amigo");
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ notes: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(handler).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    const sentContent = send.mock.calls[0][1];
    expect(sentContent).toContain("No tengo suficiente informacion");
    expect(complete).toHaveBeenCalledWith("b3", expect.any(String), 99);
  });

  it("completes buffer with response composed by responseComposer on action executed", async () => {
    registerModule("notes", ["create"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t4",
      status: "executed",
      evidence: { noteId: "n1", eventId: "e1" },
      stateChanges: [{ entityType: "note", entityId: "n1", eventType: "note_created", payload: {} }],
    }));

    const { store, complete, send } = (() => {
      const s = fakeStore([{ bid: "b4", tid: "t4", cid: 85, msgs: [{ id: 1, content: "nota: test ejecucion" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ notes: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate: vi.fn() },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b4", expect.any(String), 99);
  });

  it("does not confirm note without noteId and eventId", async () => {
    registerModule("notes", ["create"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t5",
      status: "executed",
      evidence: {},
      stateChanges: [],
    }));

    const { store, complete, send } = (() => {
      const s = fakeStore([{ bid: "b5", tid: "t5", cid: 85, msgs: [{ id: 1, content: "nota: sin evidencia real" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ notes: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate: vi.fn() },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(send).toHaveBeenCalledTimes(1);
    const sentContent = send.mock.calls[0][1];
    expect(sentContent).toContain("no se puede verificar");
    expect(complete).toHaveBeenCalledWith("b5", expect.any(String), 99);
  });

  it("executes notes.create with Chatwoot header format (normalized by normalizer)", async () => {
    registerModule("notes", ["create"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t6",
      status: "executed",
      evidence: { noteId: "n1", eventId: "e1" },
      stateChanges: [{ entityType: "note", entityId: "n1", eventType: "note_created", payload: {} }],
    }));

    const { store, complete, send } = (() => {
      const s = fakeStore([{ bid: "b6", tid: "t6", cid: 85, msgs: [{ id: 1, content: "**+598 91 608 727 - Fabian:**\nnota: recordar esta prueba" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ notes: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate: vi.fn() },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b6", expect.any(String), 99);
  });

  it("executes notes.list for que notas tengo message", async () => {
    registerModule("notes", ["list"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t7",
      status: "executed",
      evidence: { notes: [{ noteType: "observacion", content: "test note" }], count: 1 },
      stateChanges: [],
    }));

    const { store, complete, send } = (() => {
      const s = fakeStore([{ bid: "b7", tid: "t7", cid: 85, msgs: [{ id: 1, content: "que notas tengo" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ notes: { list: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate: vi.fn() },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b7", expect.any(String), 99);
  });

  it("executes notes.search for busca notas sobre foco and does not call DeepSeek", async () => {
    registerModule("notes", ["search"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t8",
      status: "executed",
      evidence: { notes: [], count: 0, query: "foco" },
      stateChanges: [],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b8", tid: "t8", cid: 85, msgs: [{ id: 1, content: "busca notas sobre foco" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ notes: { search: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b8", expect.any(String), 99);
  });

  it("uses DeepSeek fallback when route is not executable for unregistered action", async () => {
    registerModule("notes", ["create"]);

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b9", tid: "t9", cid: 85, msgs: [{ id: 1, content: "que notas tengo" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({}),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalled();
  });
});

describe("bufferProcessor TASK-20260603-020 integration", () => {
  it("executes routines.create and does not call DeepSeek", async () => {
    registerModule("routines", ["create"]);
    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { routineId: "routine-1", eventId: "event-1", name: input.entities.name, slug: input.entities.slug },
      stateChanges: [{ entityType: "routine", entityId: "routine-1", eventType: "routine_created", payload: {} }],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-routine-020", tid: "t-routine-020", cid: 85, msgs: [{ id: 1, content: "crear rutina manana normal: 07:00 despertar" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ routines: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(85, expect.stringContaining("Rutina creada"));
    expect(complete).toHaveBeenCalledWith("b-routine-020", expect.stringContaining("Rutina creada"), 99);
  });
});

describe("bufferProcessor tasks integration", () => {
  it("executes tasks.create for tarea: message and does not call DeepSeek", async () => {
    registerModule("tasks", ["create"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t10",
      status: "executed",
      evidence: { taskId: "t1", eventId: "e1", title: "llamar al contador" },
      stateChanges: [{ entityType: "task", entityId: "t1", eventType: "task_created", payload: {} }],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b10", tid: "t10", cid: 85, msgs: [{ id: 1, content: "tarea: llamar al contador" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b10", expect.any(String), 99);
  });

  it("executes tasks.list for que tareas tengo and does not call DeepSeek", async () => {
    registerModule("tasks", ["list"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t11",
      status: "executed",
      evidence: { tasks: [{ title: "test" }], count: 1 },
      stateChanges: [],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b11", tid: "t11", cid: 85, msgs: [{ id: 1, content: "que tareas tengo" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { list: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b11", expect.any(String), 99);
  });

  it("executes tasks.complete with position and does not call DeepSeek", async () => {
    registerModule("tasks", ["complete"]);

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t12",
      status: "executed",
      evidence: { taskId: "t1", eventId: "e1", title: "llamar al contador" },
      stateChanges: [{ entityType: "task", entityId: "t1", eventType: "task_completed", payload: {} }],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b12", tid: "t12", cid: 85, msgs: [{ id: 1, content: "completar tarea 1" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { complete: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b12", expect.any(String), 99);
  });

  it("blocks tasks.complete when no identifier is provided (missingData)", async () => {
    registerModule("tasks", ["complete"]);

    const handler = vi.fn();

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b13", tid: "t13", cid: 85, msgs: [{ id: 1, content: "completar tarea" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { complete: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger: fakeLogger(),
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    const sentContent = send.mock.calls[0][1];
    expect(sentContent).toContain("No tengo suficiente informacion");
    expect(complete).toHaveBeenCalledWith("b13", expect.any(String), 99);
  });
});

describe("bufferProcessor session context integration", () => {
  it("passes sessionContext to coarseClassifier when context is loaded", async () => {
    registerModule("tasks", ["create"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t-sc1",
      status: "executed",
      evidence: { taskId: "t1", eventId: "e1", title: "llamar al contador" },
      stateChanges: [{ entityType: "task", entityId: "t1", eventType: "task_created", payload: {} }],
    }));

    const sessionCtxMod = {
      get: vi.fn().mockResolvedValue({
        context: {
          id: "ctx-1",
          schemaVersion: "session_context.v1",
          accountId: 7,
          inboxId: 45,
          conversationId: 85,
          activeModule: "tasks",
          activeFlow: "task_created",
          focusedEntityType: "task",
          focusedEntityId: "task-focused",
          awaitingConfirmation: false,
          context: { lastTaskTitle: "llamar al contador" },
          createdAt: "now",
          updatedAt: "now",
        },
      }),
      upsert: vi.fn().mockResolvedValue({ context: {}, isNew: false }),
      clear: vi.fn().mockResolvedValue({ cleared: true }),
    } as any;

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-sc1", tid: "t-sc1", cid: 85, msgs: [{ id: 1, content: "tarea: llamar al contador" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
      sessionContextModule: sessionCtxMod,
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b-sc1", expect.any(String), 99);
    expect(sessionCtxMod.get).toHaveBeenCalledWith({ accountId: 7, inboxId: 45, conversationId: 85 });
  });

  it("updates session context focus after tasks.create with evidence", async () => {
    registerModule("tasks", ["create"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t-sc2",
      status: "executed",
      evidence: { taskId: "t-new", eventId: "e-new", title: "nueva tarea" },
      stateChanges: [{ entityType: "task", entityId: "t-new", eventType: "task_created", payload: {} }],
    }));

    const sessionCtxMod = {
      get: vi.fn().mockResolvedValue({ context: null }),
      upsert: vi.fn().mockResolvedValue({ context: {}, isNew: true }),
      clear: vi.fn(),
    } as any;

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-sc2", tid: "t-sc2", cid: 85, msgs: [{ id: 1, content: "tarea: nueva tarea" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
      sessionContextModule: sessionCtxMod,
    });

    await proc.processDue();

    expect(sessionCtxMod.upsert).toHaveBeenCalledWith(expect.objectContaining({
      activeModule: "tasks",
      activeFlow: "task_created",
      focusedEntityType: "task",
      focusedEntityId: "t-new",
      context: { lastTaskTitle: "nueva tarea" },
    }));
  });

  it("updates lastTaskList after tasks.list with multiple tasks", async () => {
    registerModule("tasks", ["list"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t-sc3",
      status: "executed",
      evidence: {
        tasks: [{ id: "t1", title: "task 1" }, { id: "t2", title: "task 2" }],
        count: 2,
      },
      stateChanges: [],
    }));

    const sessionCtxMod = {
      get: vi.fn().mockResolvedValue({ context: null }),
      upsert: vi.fn().mockResolvedValue({ context: {}, isNew: true }),
      clear: vi.fn(),
    } as any;

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-sc3", tid: "t-sc3", cid: 85, msgs: [{ id: 1, content: "que tareas tengo" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { list: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
      sessionContextModule: sessionCtxMod,
    });

    await proc.processDue();

    expect(sessionCtxMod.upsert).toHaveBeenCalledWith(expect.objectContaining({
      activeModule: "tasks",
      context: {
        lastTaskList: [
          { position: 1, id: "t1", title: "task 1" },
          { position: 2, id: "t2", title: "task 2" },
        ],
      },
    }));
  });

  it("does not fail main action if session context update fails", async () => {
    registerModule("tasks", ["create"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: "t-sc4",
      status: "executed",
      evidence: { taskId: "t1", eventId: "e1", title: "test task" },
      stateChanges: [{ entityType: "task", entityId: "t1", eventType: "task_created", payload: {} }],
    }));

    const sessionCtxMod = {
      get: vi.fn().mockResolvedValue({ context: null }),
      upsert: vi.fn().mockRejectedValue(new Error("DB error")),
      clear: vi.fn(),
    } as any;

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-sc4", tid: "t-sc4", cid: 85, msgs: [{ id: 1, content: "tarea: test task" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { create: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
      sessionContextModule: sessionCtxMod,
    });

    await proc.processDue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b-sc4", expect.any(String), 99);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: "DB error" }),
      "failed to update session context",
    );
  });

  it("resolves completar esa via moduleIntentClassifier with session context focus", async () => {
    registerModule("tasks", ["complete"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { taskId: input.entities.taskId, eventId: "e-resolve", title: "llamar al contador" },
      stateChanges: [{ entityType: "task", entityId: input.entities.taskId as string, eventType: "task_completed", payload: {} }],
    }));

    const sessionCtxMod = {
      get: vi.fn().mockResolvedValue({
        context: {
          id: "ctx-resolve",
          schemaVersion: "session_context.v1",
          accountId: 7,
          inboxId: 45,
          conversationId: 85,
          focusedEntityType: "task",
          focusedEntityId: "task-focused-99",
          awaitingConfirmation: false,
          context: {},
          createdAt: "now",
          updatedAt: "now",
        },
      }),
      upsert: vi.fn().mockResolvedValue({ context: {}, isNew: false }),
      clear: vi.fn(),
    } as any;

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-resolve", tid: "t-resolve", cid: 85, msgs: [{ id: 1, content: "completar esa" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ tasks: { complete: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
      sessionContextModule: sessionCtxMod,
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    const handlerInput = handler.mock.calls[0][0] as ActionExecutionInput;
    expect(handlerInput.entities).toHaveProperty("taskId", "task-focused-99");
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b-resolve", expect.any(String), 99);
  });
});

describe("bufferProcessor daily-log", () => {
  it("executes daily-log.morning and does not call DeepSeek", async () => {
    registerModule("daily-log", ["morning"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { dailyLogId: "dl1", eventId: "e1", date: "2026-06-03" },
      stateChanges: [{ entityType: "daily_log", entityId: "dl1", eventType: "daily_log_morning_updated", payload: {} }],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-dl1", tid: "t-dl1", cid: 85, msgs: [{ id: 1, content: "buen dia energia 7 dormi 6.5 foco terminar propuestas" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ "daily-log": { morning: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b-dl1", expect.any(String), 99);
  });

  it("executes daily-log.evening and does not call DeepSeek", async () => {
    registerModule("daily-log", ["evening"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { dailyLogId: "dl2", eventId: "e2", date: "2026-06-03" },
      stateChanges: [{ entityType: "daily_log", entityId: "dl2", eventType: "daily_log_evening_updated", payload: {} }],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-dl2", tid: "t-dl2", cid: 85, msgs: [{ id: 1, content: "cierre del dia avance termine propuestas" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ "daily-log": { evening: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b-dl2", expect.any(String), 99);
  });

  it("executes daily-log.summary and does not call DeepSeek", async () => {
    registerModule("daily-log", ["summary"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: {
        dailyLog: { wakeEnergy: 7, sleepHours: 6.5, morningIntention: "terminar propuestas", eveningReview: "termine todo" },
        dailyLogId: "dl3",
        date: "2026-06-03",
      },
      stateChanges: [],
    }));

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-dl3", tid: "t-dl3", cid: 85, msgs: [{ id: 1, content: "resumen del dia" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ "daily-log": { summary: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
    });

    await proc.processDue();

    expect(generate).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b-dl3", expect.any(String), 99);
  });

  it("updates session context after daily-log.morning", async () => {
    registerModule("daily-log", ["morning"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { dailyLogId: "dl-sc1", eventId: "e-sc1", date: "2026-06-03" },
      stateChanges: [{ entityType: "daily_log", entityId: "dl-sc1", eventType: "daily_log_morning_updated", payload: {} }],
    }));

    const sessionCtxMod = {
      get: vi.fn().mockResolvedValue({ context: null }),
      upsert: vi.fn().mockResolvedValue({ context: {}, isNew: true }),
      clear: vi.fn(),
    } as any;

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-dl-sc1", tid: "t-dl-sc1", cid: 85, msgs: [{ id: 1, content: "buen dia energia 7" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ "daily-log": { morning: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
      sessionContextModule: sessionCtxMod,
    });

    await proc.processDue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(sessionCtxMod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        activeModule: "daily-log",
        focusedEntityType: "daily_log",
        focusedEntityId: "dl-sc1",
      }),
    );
  });

  it("does not fail main action if session context update fails for daily-log", async () => {
    registerModule("daily-log", ["morning"]);
    const logger = fakeLogger();

    const handler = vi.fn(async (input: ActionExecutionInput): Promise<ActionExecutionResult> => ({
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "executed",
      evidence: { dailyLogId: "dl-sc2", eventId: "e-sc2", date: "2026-06-03" },
      stateChanges: [{ entityType: "daily_log", entityId: "dl-sc2", eventType: "daily_log_morning_updated", payload: {} }],
    }));

    const sessionCtxMod = {
      get: vi.fn().mockResolvedValue({ context: null }),
      upsert: vi.fn().mockRejectedValue(new Error("DB error")),
      clear: vi.fn(),
    } as any;

    const { store, complete, send, generate } = (() => {
      const s = fakeStore([{ bid: "b-dl-sc2", tid: "t-dl-sc2", cid: 85, msgs: [{ id: 1, content: "buen dia energia 7" }] }]);
      const o = fakeOutbound();
      const g = fakeGenerator();
      return { ...s, ...o, ...g, store: s.store };
    })();

    const proc = createBufferProcessor({
      store,
      normalizer: createMessageNormalizer(),
      coarseClassifier: createCoarseClassifier(),
      intentClassifier: createModuleIntentClassifier(),
      router: createModuleRouter(),
      executor: createActionExecutor({ "daily-log": { morning: handler } }),
      composer: createResponseComposer(),
      fallbackGenerator: { generate },
      outbound: { send },
      logger,
      sessionContextModule: sessionCtxMod,
    });

    await proc.processDue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("b-dl-sc2", expect.any(String), 99);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: "DB error" }),
      "failed to update session context",
    );
  });
});
