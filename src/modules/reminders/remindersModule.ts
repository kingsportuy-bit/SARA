import type {
  CreateReminderInput,
  CreateReminderResult,
  ListRemindersInput,
  ListRemindersResult,
  CancelReminderInput,
  CancelReminderResult,
  RemindersRepository,
} from "../../contracts/reminders.js";

export interface RemindersModule {
  create(input: CreateReminderInput): Promise<CreateReminderResult>;
  list(input: ListRemindersInput): Promise<ListRemindersResult>;
  cancel(input: CancelReminderInput): Promise<CancelReminderResult>;
}

export function createRemindersModule(repository: RemindersRepository): RemindersModule {
  return {
    async create(input) {
      if (!input.title || input.title.trim().length === 0) {
        return {
          schemaVersion: "reminders_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "title cannot be empty",
        };
      }
      if (!input.dueAt) {
        return {
          schemaVersion: "reminders_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "dueAt is required",
        };
      }
      const dueDate = new Date(input.dueAt);
      if (isNaN(dueDate.getTime()) || dueDate <= new Date()) {
        return {
          schemaVersion: "reminders_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "dueAt must be in the future",
        };
      }
      return repository.createReminder(input);
    },

    async list(input) {
      return repository.listReminders(input);
    },

    async cancel(input) {
      if (!input.reminderId && !input.titleMatch && (!input.position || input.position < 1)) {
        return {
          schemaVersion: "reminders_cancel_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "reminderId, titleMatch, or positive position required to cancel a reminder",
        };
      }
      return repository.cancelReminder(input);
    },
  };
}
