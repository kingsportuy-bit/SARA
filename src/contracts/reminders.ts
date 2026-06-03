export type ReminderStatus = "pending" | "processing" | "sent" | "canceled" | "failed";

export interface ReminderRecord {
  id: string;
  title: string;
  message?: string;
  status: ReminderStatus;
  source: string;
  dueAt: string;
  sentAt?: string;
  canceledAt?: string;
  failedAt?: string;
  failureReason?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  schemaVersion: "reminders_create_input.v1";
  traceId: string;
  title: string;
  message?: string;
  dueAt: string;
  source: "chatwoot" | "manual" | "system";
  accountId: number;
  inboxId: number;
  conversationId: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface CreateReminderResult {
  schemaVersion: "reminders_create_result.v1";
  traceId: string;
  status: "created" | "failed";
  reminderId?: string;
  eventId?: string;
  dueAt?: string;
  title?: string;
  evidence: {
    reminderId?: string;
    eventId?: string;
    eventType?: "reminder_created";
  };
  error?: string;
}

export interface ListRemindersInput {
  schemaVersion: "reminders_list_input.v1";
  traceId: string;
  status?: ReminderStatus;
  limit?: number;
  accountId: number;
  inboxId: number;
  conversationId: number;
}

export interface ListRemindersResult {
  schemaVersion: "reminders_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  reminders: ReminderRecord[];
  count: number;
  error?: string;
}

export interface CancelReminderInput {
  schemaVersion: "reminders_cancel_input.v1";
  traceId: string;
  reminderId?: string;
  titleMatch?: string;
  position?: number;
  source: "chatwoot" | "manual" | "system";
  accountId: number;
  inboxId: number;
  conversationId: number;
}

export interface CancelReminderResult {
  schemaVersion: "reminders_cancel_result.v1";
  traceId: string;
  status: "canceled" | "failed";
  reminderId?: string;
  eventId?: string;
  title?: string;
  evidence: {
    reminderId?: string;
    eventId?: string;
    eventType?: "reminder_canceled";
    title?: string;
  };
  error?: string;
}

export interface ClaimDueRemindersInput {
  schemaVersion: "reminders_claim_due_input.v1";
  traceId: string;
  limit?: number;
  accountId: number;
  inboxId: number;
  conversationId: number;
}

export interface ClaimDueRemindersResult {
  schemaVersion: "reminders_claim_due_result.v1";
  traceId: string;
  status: "success" | "failed";
  reminders: ReminderRecord[];
  count: number;
  error?: string;
}

export interface MarkReminderSentInput {
  schemaVersion: "reminders_mark_sent_input.v1";
  traceId: string;
  reminderId: string;
  source: "system";
}

export interface MarkReminderSentResult {
  schemaVersion: "reminders_mark_sent_result.v1";
  traceId: string;
  status: "sent" | "failed";
  reminderId?: string;
  eventId?: string;
  title?: string;
  error?: string;
}

export interface MarkReminderFailedInput {
  schemaVersion: "reminders_mark_failed_input.v1";
  traceId: string;
  reminderId: string;
  source: "system";
  failureReason?: string;
}

export interface MarkReminderFailedResult {
  schemaVersion: "reminders_mark_failed_result.v1";
  traceId: string;
  status: "failed_marked" | "failed";
  reminderId?: string;
  eventId?: string;
  title?: string;
  error?: string;
}

export interface RemindersRepository {
  createReminder(input: CreateReminderInput): Promise<CreateReminderResult>;
  listReminders(input: ListRemindersInput): Promise<ListRemindersResult>;
  cancelReminder(input: CancelReminderInput): Promise<CancelReminderResult>;
  claimDueReminders(input: ClaimDueRemindersInput): Promise<ClaimDueRemindersResult>;
  markReminderSent(input: MarkReminderSentInput): Promise<MarkReminderSentResult>;
  markReminderFailed(input: MarkReminderFailedInput): Promise<MarkReminderFailedResult>;
}
