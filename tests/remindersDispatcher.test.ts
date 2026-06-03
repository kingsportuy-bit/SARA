import { describe, expect, it } from "vitest";
import { createRemindersDispatcher } from "../src/modules/reminders/remindersDispatcher.js";
import type { OutboundChatwoot } from "../src/contracts.js";
import type { RemindersRepository, ClaimDueRemindersInput } from "../src/contracts/reminders.js";

function baseRepo(overrides: Partial<RemindersRepository> = {}): RemindersRepository {
  return {
    async createReminder() {
      throw new Error("not used");
    },
    async listReminders() {
      throw new Error("not used");
    },
    async cancelReminder() {
      throw new Error("not used");
    },
    async claimDueReminders(input: ClaimDueRemindersInput) {
      return {
        schemaVersion: "reminders_claim_due_result.v1",
        traceId: input.traceId,
        status: "success",
        reminders: [],
        count: 0,
      };
    },
    async markReminderSent(input) {
      return {
        schemaVersion: "reminders_mark_sent_result.v1",
        traceId: input.traceId,
        status: "sent",
        reminderId: input.reminderId,
        eventId: "event-sent",
      };
    },
    async markReminderFailed(input) {
      return {
        schemaVersion: "reminders_mark_failed_result.v1",
        traceId: input.traceId,
        status: "failed_marked",
        reminderId: input.reminderId,
        eventId: "event-failed",
      };
    },
    ...overrides,
  };
}

const logger = {
  info() {},
  error() {},
};

describe("remindersDispatcher", () => {
  it("claims due reminders only for Chatwoot scope 7/45/85", async () => {
    let capturedInput: ClaimDueRemindersInput | undefined;
    const repo = baseRepo({
      async claimDueReminders(input) {
        capturedInput = input;
        return {
          schemaVersion: "reminders_claim_due_result.v1",
          traceId: input.traceId,
          status: "success",
          reminders: [],
          count: 0,
        };
      },
    });

    const outbound: OutboundChatwoot = {
      async send() {
        throw new Error("should not send");
      },
    };

    const dispatcher = createRemindersDispatcher(repo, outbound, logger);
    await dispatcher.processDue();

    expect(capturedInput?.accountId).toBe(7);
    expect(capturedInput?.inboxId).toBe(45);
    expect(capturedInput?.conversationId).toBe(85);
  });

  it("sends and marks sent for claimed in-scope reminders", async () => {
    let sendCount = 0;
    let sentReminderId: string | undefined;
    const repo = baseRepo({
      async claimDueReminders(input) {
        return {
          schemaVersion: "reminders_claim_due_result.v1",
          traceId: input.traceId,
          status: "success",
          reminders: [
            {
              id: "reminder-1",
              title: "llamar al contador",
              status: "processing",
              source: "chatwoot",
              dueAt: "2026-06-03T18:00:00Z",
              accountId: 7,
              inboxId: 45,
              conversationId: 85,
              createdAt: "2026-06-03T17:00:00Z",
              updatedAt: "2026-06-03T17:00:00Z",
            },
          ],
          count: 1,
        };
      },
      async markReminderSent(input) {
        sentReminderId = input.reminderId;
        return {
          schemaVersion: "reminders_mark_sent_result.v1",
          traceId: input.traceId,
          status: "sent",
          reminderId: input.reminderId,
          eventId: "event-sent",
        };
      },
    });

    const outbound: OutboundChatwoot = {
      async send(conversationId, content) {
        sendCount += 1;
        expect(conversationId).toBe(85);
        expect(content).toBe("Recordatorio: llamar al contador");
        return { id: 123 };
      },
    };

    const dispatcher = createRemindersDispatcher(repo, outbound, logger);
    await dispatcher.processDue();

    expect(sendCount).toBe(1);
    expect(sentReminderId).toBe("reminder-1");
  });

  it("marks failed when Chatwoot send fails", async () => {
    let failedReminderId: string | undefined;
    const repo = baseRepo({
      async claimDueReminders(input) {
        return {
          schemaVersion: "reminders_claim_due_result.v1",
          traceId: input.traceId,
          status: "success",
          reminders: [
            {
              id: "reminder-1",
              title: "llamar al contador",
              status: "processing",
              source: "chatwoot",
              dueAt: "2026-06-03T18:00:00Z",
              accountId: 7,
              inboxId: 45,
              conversationId: 85,
              createdAt: "2026-06-03T17:00:00Z",
              updatedAt: "2026-06-03T17:00:00Z",
            },
          ],
          count: 1,
        };
      },
      async markReminderFailed(input) {
        failedReminderId = input.reminderId;
        expect(input.failureReason).toContain("Chatwoot down");
        return {
          schemaVersion: "reminders_mark_failed_result.v1",
          traceId: input.traceId,
          status: "failed_marked",
          reminderId: input.reminderId,
          eventId: "event-failed",
        };
      },
    });

    const outbound: OutboundChatwoot = {
      async send() {
        throw new Error("Chatwoot down");
      },
    };

    const dispatcher = createRemindersDispatcher(repo, outbound, logger);
    await dispatcher.processDue();

    expect(failedReminderId).toBe("reminder-1");
  });
});
