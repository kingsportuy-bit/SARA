import type { RemindersRepository } from "../../contracts/reminders.js";
import type { OutboundChatwoot } from "../../contracts.js";

export interface RemindersDispatcher {
  processDue(): Promise<void>;
}

const SCOPE_ACCOUNT = 7;
const SCOPE_INBOX = 45;
const SCOPE_CONVERSATION = 85;

export function createRemindersDispatcher(
  store: RemindersRepository,
  outbound: OutboundChatwoot,
  logger: { info: (data: object, message: string) => void; error: (data: object, message: string) => void },
): RemindersDispatcher {
  let running = false;

  async function processDue(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const result = await store.claimDueReminders({
        schemaVersion: "reminders_claim_due_input.v1",
        traceId: crypto.randomUUID(),
        limit: 10,
        accountId: SCOPE_ACCOUNT,
        inboxId: SCOPE_INBOX,
        conversationId: SCOPE_CONVERSATION,
      });

      if (result.status !== "success" || result.count === 0) return;

      for (const reminder of result.reminders) {
        if (
          reminder.accountId !== SCOPE_ACCOUNT ||
          reminder.inboxId !== SCOPE_INBOX ||
          reminder.conversationId !== SCOPE_CONVERSATION
        ) {
          logger.info({ reminderId: reminder.id, accountId: reminder.accountId, inboxId: reminder.inboxId, conversationId: reminder.conversationId }, "reminder outside scope, skipping");
          continue;
        }

        try {
          const content = `Recordatorio: ${reminder.title}`;
          const sent = await outbound.send(reminder.conversationId, content);

          await store.markReminderSent({
            schemaVersion: "reminders_mark_sent_input.v1",
            traceId: crypto.randomUUID(),
            reminderId: reminder.id,
            source: "system",
          });

          logger.info({ reminderId: reminder.id, outboundMessageId: sent.id }, "reminder sent successfully");
        } catch (err) {
          const failureReason = err instanceof Error ? err.message : String(err);
          await store.markReminderFailed({
            schemaVersion: "reminders_mark_failed_input.v1",
            traceId: crypto.randomUUID(),
            reminderId: reminder.id,
            source: "system",
            failureReason,
          });

          logger.error({ reminderId: reminder.id, error: failureReason }, "failed to send reminder");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "reminders dispatcher claim failed");
    } finally {
      running = false;
    }
  }

  return { processDue };
}
