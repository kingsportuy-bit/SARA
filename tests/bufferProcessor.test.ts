import { describe, expect, it, vi } from "vitest";
import { createBufferProcessor } from "../src/modules/bufferProcessor.js";
import { createCoarseClassifier } from "../src/modules/coarseClassifier.js";
import { createModuleIntentClassifier } from "../src/modules/moduleIntentClassifier.js";
import { createModuleRouter, registerModule } from "../src/modules/moduleRouter.js";
import { createActionExecutor } from "../src/modules/actionExecutor.js";
import { createResponseComposer } from "../src/modules/responseComposer.js";
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
});
