import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateReminderInput,
  CreateReminderResult,
  ListRemindersInput,
  ListRemindersResult,
  CancelReminderInput,
  CancelReminderResult,
  ClaimDueRemindersInput,
  ClaimDueRemindersResult,
  MarkReminderSentInput,
  MarkReminderSentResult,
  MarkReminderFailedInput,
  MarkReminderFailedResult,
  RemindersRepository,
  ReminderRecord,
} from "../contracts/reminders.js";

interface CreateRpcResult {
  reminder_id: string;
  event_id: string;
  due_at: string;
  title: string;
  trace_id: string;
  schema_version: string;
}

interface CancelRpcResult {
  reminder_id: string;
  event_id: string;
  title: string;
  trace_id: string;
  schema_version: string;
}

interface MarkSentRpcResult {
  reminder_id: string;
  event_id: string;
  title: string;
  trace_id: string;
  schema_version: string;
}

interface MarkFailedRpcResult {
  reminder_id: string;
  event_id: string;
  title: string;
  trace_id: string;
  schema_version: string;
}

function toReminderRecord(row: Record<string, unknown>): ReminderRecord {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    message: row.message != null ? String(row.message) : undefined,
    status: String(row.status ?? "") as ReminderRecord["status"],
    source: String(row.source ?? ""),
    dueAt: String(row.due_at ?? ""),
    sentAt: row.sent_at != null ? String(row.sent_at) : undefined,
    canceledAt: row.canceled_at != null ? String(row.canceled_at) : undefined,
    failedAt: row.failed_at != null ? String(row.failed_at) : undefined,
    failureReason: row.failure_reason != null ? String(row.failure_reason) : undefined,
    relatedEntityType: row.related_entity_type != null ? String(row.related_entity_type) : undefined,
    relatedEntityId: row.related_entity_id != null ? String(row.related_entity_id) : undefined,
    accountId: Number(row.account_id),
    inboxId: Number(row.inbox_id),
    conversationId: Number(row.conversation_id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function createRemindersStore(supabase: SupabaseClient): RemindersRepository {
  return {
    async createReminder(input: CreateReminderInput): Promise<CreateReminderResult> {
      const { data, error } = await supabase.rpc("sara_create_reminder", {
        p_trace_id: input.traceId,
        p_title: input.title,
        p_message: input.message ?? null,
        p_due_at: input.dueAt,
        p_source: input.source,
        p_account_id: input.accountId,
        p_inbox_id: input.inboxId,
        p_conversation_id: input.conversationId,
        p_related_entity_type: input.relatedEntityType ?? null,
        p_related_entity_id: input.relatedEntityId ?? null,
      });

      if (error) {
        return {
          schemaVersion: "reminders_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CreateRpcResult;

      return {
        schemaVersion: "reminders_create_result.v1",
        traceId: input.traceId,
        status: "created",
        reminderId: result.reminder_id,
        eventId: result.event_id,
        dueAt: result.due_at,
        title: result.title,
        evidence: {
          reminderId: result.reminder_id,
          eventId: result.event_id,
          eventType: "reminder_created",
        },
      };
    },

    async listReminders(input: ListRemindersInput): Promise<ListRemindersResult> {
      try {
        let query = supabase
          .from("sara_reminders")
          .select("*")
          .eq("account_id", input.accountId)
          .eq("inbox_id", input.inboxId)
          .eq("conversation_id", input.conversationId)
          .eq("status", input.status ?? "pending")
          .order("due_at", { ascending: true })
          .limit(input.limit ?? 5);

        const { data, error } = await query;

        if (error) {
          return {
            schemaVersion: "reminders_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            reminders: [],
            count: 0,
            error: error.message,
          };
        }

        const reminders = (data as Record<string, unknown>[]).map(toReminderRecord);
        return {
          schemaVersion: "reminders_list_result.v1",
          traceId: input.traceId,
          status: "success",
          reminders,
          count: reminders.length,
        };
      } catch (err) {
        return {
          schemaVersion: "reminders_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          reminders: [],
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async cancelReminder(input: CancelReminderInput): Promise<CancelReminderResult> {
      const { data, error } = await supabase.rpc("sara_cancel_reminder", {
        p_trace_id: input.traceId,
        p_reminder_id: input.reminderId ?? null,
        p_title_match: input.titleMatch ?? null,
        p_position: input.position ?? null,
        p_source: input.source,
        p_account_id: input.accountId,
        p_inbox_id: input.inboxId,
        p_conversation_id: input.conversationId,
      });

      if (error) {
        return {
          schemaVersion: "reminders_cancel_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CancelRpcResult;

      return {
        schemaVersion: "reminders_cancel_result.v1",
        traceId: input.traceId,
        status: "canceled",
        reminderId: result.reminder_id,
        eventId: result.event_id,
        title: result.title,
        evidence: {
          reminderId: result.reminder_id,
          eventId: result.event_id,
          eventType: "reminder_canceled",
          title: result.title,
        },
      };
    },

    async claimDueReminders(input: ClaimDueRemindersInput): Promise<ClaimDueRemindersResult> {
      try {
        const { data, error } = await supabase.rpc("sara_claim_due_reminders", {
          p_limit: input.limit ?? 10,
        });

        if (error) {
          return {
            schemaVersion: "reminders_claim_due_result.v1",
            traceId: input.traceId,
            status: "failed",
            reminders: [],
            count: 0,
            error: error.message,
          };
        }

        const reminders = ((data as Record<string, unknown>[]) ?? []).map(toReminderRecord);
        return {
          schemaVersion: "reminders_claim_due_result.v1",
          traceId: input.traceId,
          status: "success",
          reminders,
          count: reminders.length,
        };
      } catch (err) {
        return {
          schemaVersion: "reminders_claim_due_result.v1",
          traceId: input.traceId,
          status: "failed",
          reminders: [],
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async markReminderSent(input: MarkReminderSentInput): Promise<MarkReminderSentResult> {
      const { data, error } = await supabase.rpc("sara_mark_reminder_sent", {
        p_trace_id: input.traceId,
        p_reminder_id: input.reminderId,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "reminders_mark_sent_result.v1",
          traceId: input.traceId,
          status: "failed",
          error: error.message,
        };
      }

      const result = data as MarkSentRpcResult;

      return {
        schemaVersion: "reminders_mark_sent_result.v1",
        traceId: input.traceId,
        status: "sent",
        reminderId: result.reminder_id,
        eventId: result.event_id,
        title: result.title,
      };
    },

    async markReminderFailed(input: MarkReminderFailedInput): Promise<MarkReminderFailedResult> {
      const { data, error } = await supabase.rpc("sara_mark_reminder_failed", {
        p_trace_id: input.traceId,
        p_reminder_id: input.reminderId,
        p_source: input.source,
        p_failure_reason: input.failureReason ?? null,
      });

      if (error) {
        return {
          schemaVersion: "reminders_mark_failed_result.v1",
          traceId: input.traceId,
          status: "failed",
          error: error.message,
        };
      }

      const result = data as MarkFailedRpcResult;

      return {
        schemaVersion: "reminders_mark_failed_result.v1",
        traceId: input.traceId,
        status: "failed_marked",
        reminderId: result.reminder_id,
        eventId: result.event_id,
        title: result.title,
      };
    },
  };
}
