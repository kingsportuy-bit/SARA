import { describe, expect, it } from "vitest";
import { createRemindersModule } from "../src/modules/reminders/remindersModule.js";
import type {
  CreateReminderInput,
  CreateReminderResult,
  ListRemindersInput,
  ListRemindersResult,
  CancelReminderInput,
  CancelReminderResult,
  RemindersRepository,
} from "../src/contracts/reminders.js";

function fakeRepo(): RemindersRepository {
  return {
    async createReminder(input: CreateReminderInput): Promise<CreateReminderResult> {
      return {
        schemaVersion: "reminders_create_result.v1",
        traceId: input.traceId,
        status: "created",
        reminderId: "reminder-uuid-1",
        eventId: "event-uuid-1",
        dueAt: input.dueAt,
        title: input.title,
        evidence: { reminderId: "reminder-uuid-1", eventId: "event-uuid-1", eventType: "reminder_created" },
      };
    },
    async listReminders(input: ListRemindersInput): Promise<ListRemindersResult> {
      return {
        schemaVersion: "reminders_list_result.v1",
        traceId: input.traceId,
        status: "success",
        reminders: [
          { id: "r1", title: "llamar al contador", status: "pending", source: "chatwoot", dueAt: "2026-06-10T10:00:00Z", accountId: 7, inboxId: 45, conversationId: 85, createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z" },
          { id: "r2", title: "revisar facturas", status: "pending", source: "chatwoot", dueAt: "2026-06-11T15:00:00Z", accountId: 7, inboxId: 45, conversationId: 85, createdAt: "2026-06-02T00:00:00Z", updatedAt: "2026-06-02T00:00:00Z" },
        ],
        count: 2,
      };
    },
    async cancelReminder(input: CancelReminderInput): Promise<CancelReminderResult> {
      return {
        schemaVersion: "reminders_cancel_result.v1",
        traceId: input.traceId,
        status: "canceled",
        reminderId: "reminder-uuid-1",
        eventId: "event-uuid-2",
        title: "llamar al contador",
        evidence: { reminderId: "reminder-uuid-1", eventId: "event-uuid-2", eventType: "reminder_canceled", title: "llamar al contador" },
      };
    },
    async claimDueReminders() {
      return { schemaVersion: "reminders_claim_due_result.v1", traceId: "trace", status: "success", reminders: [], count: 0 };
    },
    async markReminderSent() {
      return { schemaVersion: "reminders_mark_sent_result.v1", traceId: "trace", status: "sent", reminderId: "r1", eventId: "e1" };
    },
    async markReminderFailed() {
      return { schemaVersion: "reminders_mark_failed_result.v1", traceId: "trace", status: "failed_marked", reminderId: "r1", eventId: "e1" };
    },
  };
}

const futureDate = new Date(Date.now() + 3600000).toISOString();

describe("remindersModule.create", () => {
  it("creates a reminder with valid input", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.create({
      schemaVersion: "reminders_create_input.v1",
      traceId: "trace-1",
      title: "llamar al contador",
      dueAt: futureDate,
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("created");
    expect(result.reminderId).toBe("reminder-uuid-1");
    expect(result.eventId).toBe("event-uuid-1");
    expect(result.evidence.reminderId).toBe("reminder-uuid-1");
    expect(result.evidence.eventId).toBe("event-uuid-1");
    expect(result.evidence.eventType).toBe("reminder_created");
  });

  it("rejects empty title", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.create({
      schemaVersion: "reminders_create_input.v1",
      traceId: "trace-2",
      title: "",
      dueAt: futureDate,
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title cannot be empty");
    expect(result.reminderId).toBeUndefined();
  });

  it("rejects whitespace-only title", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.create({
      schemaVersion: "reminders_create_input.v1",
      traceId: "trace-3",
      title: "   ",
      dueAt: futureDate,
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title cannot be empty");
  });

  it("rejects past dueAt", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.create({
      schemaVersion: "reminders_create_input.v1",
      traceId: "trace-4",
      title: "test",
      dueAt: "2020-01-01T00:00:00Z",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("future");
  });

  it("rejects missing dueAt", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.create({
      schemaVersion: "reminders_create_input.v1",
      traceId: "trace-5",
      title: "test",
      dueAt: "",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("dueAt is required");
  });
});

describe("remindersModule.list", () => {
  it("returns pending reminders filtered by conversation", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.list({
      schemaVersion: "reminders_list_input.v1",
      traceId: "trace-l1",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.schemaVersion).toBe("reminders_list_result.v1");
    expect(result.status).toBe("success");
    expect(result.reminders).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.reminders[0].title).toBe("llamar al contador");
    expect(result.reminders[1].title).toBe("revisar facturas");
  });

  it("propagates repository failure", async () => {
    const repo: RemindersRepository = {
      async listReminders(input) {
        return {
          schemaVersion: "reminders_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          reminders: [],
          count: 0,
          error: "DB down",
        };
      },
    } as RemindersRepository;
    const mod = createRemindersModule(repo);
    const result = await mod.list({
      schemaVersion: "reminders_list_input.v1",
      traceId: "trace-l2",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB down");
  });
});

describe("remindersModule.cancel", () => {
  it("cancels a reminder by reminderId with evidence", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.cancel({
      schemaVersion: "reminders_cancel_input.v1",
      traceId: "trace-c1",
      reminderId: "reminder-uuid-1",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("canceled");
    expect(result.reminderId).toBe("reminder-uuid-1");
    expect(result.eventId).toBe("event-uuid-2");
    expect(result.evidence.eventType).toBe("reminder_canceled");
    expect(result.title).toBe("llamar al contador");
  });

  it("cancels a reminder by titleMatch", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.cancel({
      schemaVersion: "reminders_cancel_input.v1",
      traceId: "trace-c2",
      titleMatch: "llamar al contador",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("canceled");
  });

  it("cancels a reminder by position", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.cancel({
      schemaVersion: "reminders_cancel_input.v1",
      traceId: "trace-c3",
      position: 1,
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("canceled");
  });

  it("fails without any identifier", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.cancel({
      schemaVersion: "reminders_cancel_input.v1",
      traceId: "trace-c4",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("reminderId, titleMatch, or positive position required");
  });

  it("fails with zero position", async () => {
    const repo = fakeRepo();
    const mod = createRemindersModule(repo);
    const result = await mod.cancel({
      schemaVersion: "reminders_cancel_input.v1",
      traceId: "trace-c5",
      position: 0,
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("required");
  });
});
