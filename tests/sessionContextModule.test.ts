import { describe, expect, it, vi } from "vitest";
import { createSessionContextModule } from "../src/modules/sessionContext/sessionContextModule.js";
import type { SessionContextRepository, SessionContextRecord } from "../src/contracts/sessionContext.js";

function fakeRepo(overrides?: Partial<SessionContextRepository>) {
  return {
    get: vi.fn(),
    upsert: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  } as SessionContextRepository;
}

function makeRecord(overrides?: Partial<SessionContextRecord>): SessionContextRecord {
  return {
    id: "ctx-1",
    schemaVersion: "session_context.v1",
    accountId: 7,
    inboxId: 45,
    conversationId: 85,
    activeModule: "tasks",
    activeFlow: "task_created",
    focusedEntityType: "task",
    focusedEntityId: "task-1",
    awaitingConfirmation: false,
    context: { lastTaskTitle: "llamar al contador" },
    createdAt: "2026-06-03T00:00:00Z",
    updatedAt: "2026-06-03T00:00:00Z",
    ...overrides,
  };
}

describe("sessionContextModule", () => {
  describe("get", () => {
    it("returns context when valid account/inbox/conversation provided", async () => {
      const record = makeRecord();
      const repo = fakeRepo({ get: vi.fn().mockResolvedValue({ context: record }) });
      const mod = createSessionContextModule(repo);

      const result = await mod.get({ accountId: 7, inboxId: 45, conversationId: 85 });

      expect(result.context).toEqual(record);
      expect(repo.get).toHaveBeenCalledWith({ accountId: 7, inboxId: 45, conversationId: 85 });
    });

    it("returns null when no context exists", async () => {
      const repo = fakeRepo({ get: vi.fn().mockResolvedValue({ context: null }) });
      const mod = createSessionContextModule(repo);

      const result = await mod.get({ accountId: 7, inboxId: 45, conversationId: 85 });

      expect(result.context).toBeNull();
    });

    it("returns null when accountId is missing", async () => {
      const repo = fakeRepo();
      const mod = createSessionContextModule(repo);

      const result = await mod.get({ accountId: 0, inboxId: 45, conversationId: 85 });

      expect(result.context).toBeNull();
      expect(repo.get).not.toHaveBeenCalled();
    });

    it("ignores expired context (store returns null for expired)", async () => {
      const repo = fakeRepo({ get: vi.fn().mockResolvedValue({ context: null }) });
      const mod = createSessionContextModule(repo);

      const result = await mod.get({ accountId: 7, inboxId: 45, conversationId: 85 });

      expect(result.context).toBeNull();
    });
  });

  describe("upsert", () => {
    it("upserts valid input and returns isNew flag", async () => {
      const repo = fakeRepo({
        upsert: vi.fn().mockResolvedValue({
          context: makeRecord({ activeFlow: "task_listed" }),
          isNew: false,
        }),
      });
      const mod = createSessionContextModule(repo);

      const result = await mod.upsert({
        traceId: "trace-1",
        accountId: 7,
        inboxId: 45,
        conversationId: 85,
        activeModule: "tasks",
        activeFlow: "task_listed",
        focusedEntityType: "task",
        focusedEntityId: "task-2",
        context: { lastTaskList: [{ position: 1, id: "task-2", title: "test" }] },
      });

      expect(result.isNew).toBe(false);
      expect(result.context.activeFlow).toBe("task_listed");
      expect(repo.upsert).toHaveBeenCalledTimes(1);
    });

    it("throws when accountId is missing", async () => {
      const repo = fakeRepo();
      const mod = createSessionContextModule(repo);

      await expect(mod.upsert({
        traceId: "trace-1",
        accountId: 0,
        inboxId: 45,
        conversationId: 85,
      })).rejects.toThrow("accountId, inboxId, and conversationId are required");
    });

    it("validates account/inbox/conversation", async () => {
      const repo = fakeRepo({ upsert: vi.fn().mockResolvedValue({ context: makeRecord(), isNew: true }) });
      const mod = createSessionContextModule(repo);

      const result = await mod.upsert({
        traceId: "trace-2",
        accountId: 100,
        inboxId: 200,
        conversationId: 300,
      });

      expect(result.isNew).toBe(true);
      expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({
        accountId: 100,
        inboxId: 200,
        conversationId: 300,
      }));
    });
  });

  describe("clear", () => {
    it("clears context and returns cleared: true with evidence", async () => {
      const repo = fakeRepo({
        clear: vi.fn().mockResolvedValue({ cleared: true }),
      });
      const mod = createSessionContextModule(repo);

      const result = await mod.clear({ traceId: "trace-3", accountId: 7, inboxId: 45, conversationId: 85 });

      expect(result.cleared).toBe(true);
      expect(repo.clear).toHaveBeenCalledWith({ traceId: "trace-3", accountId: 7, inboxId: 45, conversationId: 85 });
    });

    it("returns cleared: false with reason when no active context found", async () => {
      const repo = fakeRepo({
        clear: vi.fn().mockResolvedValue({ cleared: false, reason: "no active context found" }),
      });
      const mod = createSessionContextModule(repo);

      const result = await mod.clear({ traceId: "trace-4", accountId: 7, inboxId: 45, conversationId: 85 });

      expect(result.cleared).toBe(false);
      expect(result.reason).toBe("no active context found");
    });
  });
});
