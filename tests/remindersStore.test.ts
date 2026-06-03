import { describe, expect, it } from "vitest";
import { createRemindersStore } from "../src/infra/remindersStore.js";

function fakeSupabase() {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      if (fn === "sara_create_reminder") {
        if (!params.p_title || String(params.p_title).trim() === "") {
          return { data: null, error: new Error("title cannot be empty") };
        }
        return {
          data: {
            reminder_id: "reminder-uuid-rpc",
            event_id: "event-uuid-rpc",
            due_at: params.p_due_at,
            title: params.p_title,
            trace_id: params.p_trace_id,
            schema_version: "reminders_create_result.v1",
          },
          error: null,
        };
      }
      if (fn === "sara_cancel_reminder") {
        if (!params.p_reminder_id && !params.p_title_match && !params.p_position) {
          return { data: null, error: new Error("no matching pending reminder found") };
        }
        return {
          data: {
            reminder_id: "reminder-uuid-c",
            event_id: "event-uuid-c",
            title: "llamar al contador",
            trace_id: params.p_trace_id,
            schema_version: "reminders_cancel_result.v1",
          },
          error: null,
        };
      }
      if (fn === "sara_claim_due_reminders") {
        return {
          data: [
            { id: "r1", title: "reminder 1", message: null, status: "processing", source: "chatwoot", due_at: "2026-01-01T00:00:00Z", sent_at: null, canceled_at: null, failed_at: null, failure_reason: null, related_entity_type: null, related_entity_id: null, account_id: 7, inbox_id: 45, conversation_id: 85, trace_id: "t1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
          ],
          error: null,
        };
      }
      if (fn === "sara_mark_reminder_sent") {
        return {
          data: {
            reminder_id: params.p_reminder_id,
            event_id: "event-sent",
            title: "reminder 1",
            trace_id: params.p_trace_id,
            schema_version: "reminders_mark_sent_result.v1",
          },
          error: null,
        };
      }
      if (fn === "sara_mark_reminder_failed") {
        return {
          data: {
            reminder_id: params.p_reminder_id,
            event_id: "event-failed",
            title: "reminder 1",
            trace_id: params.p_trace_id,
            schema_version: "reminders_mark_failed_result.v1",
          },
          error: null,
        };
      }
      return { data: null, error: new Error("unknown rpc") };
    },
    from: (table: string) => {
      if (table !== "sara_reminders") throw new Error("unknown table");
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      data: [
                        { id: "r1", title: "reminder 1", message: null, status: "pending", source: "chatwoot", due_at: "2026-06-10T10:00:00Z", sent_at: null, canceled_at: null, failed_at: null, failure_reason: null, related_entity_type: null, related_entity_id: null, account_id: 7, inbox_id: 45, conversation_id: 85, trace_id: "t1", created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" },
                        { id: "r2", title: "reminder 2", message: "msg", status: "pending", source: "manual", due_at: "2026-06-11T15:00:00Z", sent_at: null, canceled_at: null, failed_at: null, failure_reason: null, related_entity_type: null, related_entity_id: null, account_id: 7, inbox_id: 45, conversation_id: 85, trace_id: "t2", created_at: "2026-06-02T00:00:00Z", updated_at: "2026-06-02T00:00:00Z" },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    },
  } as any;
}

describe("remindersStore createReminder", () => {
  it("calls sara_create_reminder with correct parameters", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.createReminder({
      schemaVersion: "reminders_create_input.v1",
      traceId: "trace-1",
      title: "llamar al contador",
      dueAt: "2026-06-10T10:00:00Z",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("created");
    expect(result.reminderId).toBe("reminder-uuid-rpc");
    expect(result.eventId).toBe("event-uuid-rpc");
    expect(result.evidence.eventType).toBe("reminder_created");
  });

  it("returns failed on rpc error", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.createReminder({
      schemaVersion: "reminders_create_input.v1",
      traceId: "trace-2",
      title: "",
      dueAt: "2026-06-10T10:00:00Z",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
  });
});

describe("remindersStore listReminders", () => {
  it("queries sara_reminders filtered by conversation", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.listReminders({
      schemaVersion: "reminders_list_input.v1",
      traceId: "trace-list-1",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.schemaVersion).toBe("reminders_list_result.v1");
    expect(result.status).toBe("success");
    expect(result.reminders).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.reminders[0].title).toBe("reminder 1");
  });

  it("maps fields correctly", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.listReminders({
      schemaVersion: "reminders_list_input.v1",
      traceId: "trace-list-2",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.reminders[1].title).toBe("reminder 2");
    expect(result.reminders[1].message).toBe("msg");
    expect(result.reminders[1].source).toBe("manual");
    expect(result.reminders[1].dueAt).toBe("2026-06-11T15:00:00Z");
    expect(result.reminders[1].status).toBe("pending");
  });
});

describe("remindersStore cancelReminder", () => {
  it("calls sara_cancel_reminder with reminderId", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.cancelReminder({
      schemaVersion: "reminders_cancel_input.v1",
      traceId: "trace-c1",
      reminderId: "reminder-uuid-1",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("canceled");
    expect(result.reminderId).toBe("reminder-uuid-c");
    expect(result.eventId).toBe("event-uuid-c");
    expect(result.evidence.eventType).toBe("reminder_canceled");
    expect(result.title).toBe("llamar al contador");
  });

  it("returns failed on rpc error for cancel", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.cancelReminder({
      schemaVersion: "reminders_cancel_input.v1",
      traceId: "trace-c2",
      source: "chatwoot",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
  });
});

describe("remindersStore claimDueReminders", () => {
  it("calls sara_claim_due_reminders and returns reminders", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.claimDueReminders({
      schemaVersion: "reminders_claim_due_input.v1",
      traceId: "trace-claim-1",
      limit: 10,
    });

    expect(result.status).toBe("success");
    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0].status).toBe("processing");
    expect(result.reminders[0].accountId).toBe(7);
  });
});

describe("remindersStore markReminderSent", () => {
  it("calls sara_mark_reminder_sent", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.markReminderSent({
      schemaVersion: "reminders_mark_sent_input.v1",
      traceId: "trace-ms-1",
      reminderId: "r1",
      source: "system",
    });

    expect(result.status).toBe("sent");
    expect(result.reminderId).toBe("r1");
    expect(result.eventId).toBe("event-sent");
  });
});

describe("remindersStore markReminderFailed", () => {
  it("calls sara_mark_reminder_failed", async () => {
    const sb = fakeSupabase();
    const store = createRemindersStore(sb);
    const result = await store.markReminderFailed({
      schemaVersion: "reminders_mark_failed_input.v1",
      traceId: "trace-mf-1",
      reminderId: "r1",
      source: "system",
      failureReason: "Chatwoot error",
    });

    expect(result.status).toBe("failed_marked");
    expect(result.reminderId).toBe("r1");
    expect(result.eventId).toBe("event-failed");
  });
});
