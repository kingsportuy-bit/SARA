import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createChatwootClient } from "./infra/chatwootClient.js";
import { createDeepseekClient } from "./infra/deepseekClient.js";
import { createSupabaseClient, createSupabaseStore } from "./infra/supabaseStore.js";
import { createNotesStore } from "./infra/notesStore.js";
import { createTasksStore } from "./infra/tasksStore.js";
import { createSessionContextStore } from "./infra/sessionContextStore.js";
import { createRemindersStore } from "./infra/remindersStore.js";
import { createDailyLogStore } from "./infra/dailyLogStore.js";
import { createNotesModule } from "./modules/notes/notesModule.js";
import { createTasksModule } from "./modules/tasks/tasksModule.js";
import { createSessionContextModule } from "./modules/sessionContext/sessionContextModule.js";
import { createRemindersModule } from "./modules/reminders/remindersModule.js";
import { createDailyLogModule } from "./modules/dailyLog/dailyLogModule.js";
import { createRemindersDispatcher } from "./modules/reminders/remindersDispatcher.js";
import { createCoarseClassifier } from "./modules/coarseClassifier.js";
import { createModuleIntentClassifier } from "./modules/moduleIntentClassifier.js";
import { createModuleRouter, registerModule } from "./modules/moduleRouter.js";
import { createActionExecutor } from "./modules/actionExecutor.js";
import { createResponseComposer } from "./modules/responseComposer.js";
import { createBufferProcessor } from "./modules/bufferProcessor.js";
import { createMessageNormalizer } from "./modules/messageNormalizer.js";
import type { CreateNoteInput, ListNotesInput, SearchNotesInput } from "./contracts/notes.js";
import type { CreateTaskInput, ListTasksInput, CompleteTaskInput } from "./contracts/tasks.js";
import type { CreateReminderInput, ListRemindersInput, CancelReminderInput } from "./contracts/reminders.js";
import type { DailyLogMorningInput, DailyLogEveningInput, DailyLogSummaryInput } from "./contracts/dailyLog.js";
import type { ActionExecutionInput, ActionExecutionResult } from "./contracts/pipeline.js";

const config = loadConfig();
const supabase = createSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey);
const store = createSupabaseStore(supabase);
const app = buildApp(config, store);

const notesStore = createNotesStore(supabase);
const notesModule = createNotesModule(notesStore);

const tasksStore = createTasksStore(supabase);
const tasksModule = createTasksModule(tasksStore);

const sessionContextStore = createSessionContextStore(supabase);
const sessionContextModule = createSessionContextModule(sessionContextStore);

const remindersStore = createRemindersStore(supabase);
const remindersModule = createRemindersModule(remindersStore);

const dailyLogStore = createDailyLogStore(supabase);
const dailyLogModule = createDailyLogModule(dailyLogStore);

registerModule("notes", ["create", "list", "search"]);
registerModule("tasks", ["create", "list", "complete"]);
registerModule("reminders", ["create", "list", "cancel"]);
registerModule("daily-log", ["morning", "evening", "summary"]);

function notesCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreateNoteInput = {
    schemaVersion: "notes_create_input.v1",
    traceId: input.traceId,
    content: String(input.entities.content ?? ""),
    noteType: (input.entities.noteType as CreateNoteInput["noteType"]) || "observacion",
    source: "chatwoot",
    tags: Array.isArray(input.entities.tags) ? (input.entities.tags as string[]) : [],
  };
  return notesModule.create(createInput).then((noteResult) => {
    if (noteResult.status === "created") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          noteId: noteResult.noteId,
          eventId: noteResult.eventId,
        },
        stateChanges: [
          {
            entityType: "note",
            entityId: noteResult.noteId,
            eventType: "note_created",
            payload: {},
          },
        ],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: noteResult.error,
    };
  });
}

function notesListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListNotesInput = {
    schemaVersion: "notes_list_input.v1",
    traceId: input.traceId,
    limit: typeof input.entities.limit === "number" ? input.entities.limit : 5,
  };
  return notesModule.list(listInput).then((listResult) => {
    if (listResult.status === "success") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          notes: listResult.notes,
          count: listResult.count,
        },
        stateChanges: [],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: listResult.error,
    };
  });
}

function notesSearchHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const searchInput: SearchNotesInput = {
    schemaVersion: "notes_search_input.v1",
    traceId: input.traceId,
    query: String(input.entities.query ?? ""),
    limit: typeof input.entities.limit === "number" ? input.entities.limit : 5,
  };
  return notesModule.search(searchInput).then((searchResult) => {
    if (searchResult.status === "success") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          notes: searchResult.notes,
          count: searchResult.count,
          query: searchResult.query,
        },
        stateChanges: [],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: searchResult.error,
    };
  });
}

function tasksCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreateTaskInput = {
    schemaVersion: "tasks_create_input.v1",
    traceId: input.traceId,
    title: String(input.entities.title ?? ""),
    source: "chatwoot",
  };
  return tasksModule.create(createInput).then((taskResult) => {
    if (taskResult.status === "created") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          taskId: taskResult.taskId,
          eventId: taskResult.eventId,
          title: createInput.title,
        },
        stateChanges: [
          {
            entityType: "task",
            entityId: taskResult.taskId,
            eventType: "task_created",
            payload: {},
          },
        ],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: taskResult.error,
    };
  });
}

function tasksListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListTasksInput = {
    schemaVersion: "tasks_list_input.v1",
    traceId: input.traceId,
    limit: typeof input.entities.limit === "number" ? input.entities.limit : 5,
  };
  return tasksModule.list(listInput).then((listResult) => {
    if (listResult.status === "success") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          tasks: listResult.tasks,
          count: listResult.count,
        },
        stateChanges: [],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: listResult.error,
    };
  });
}

function tasksCompleteHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const completeInput: CompleteTaskInput = {
    schemaVersion: "tasks_complete_input.v1",
    traceId: input.traceId,
    taskId: input.entities.taskId as string | undefined,
    titleMatch: input.entities.titleMatch as string | undefined,
    position: typeof input.entities.position === "number" ? input.entities.position : undefined,
    source: "chatwoot",
  };
  return tasksModule.complete(completeInput).then((taskResult) => {
    if (taskResult.status === "completed") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          taskId: taskResult.taskId,
          eventId: taskResult.eventId,
          title: taskResult.title,
        },
        stateChanges: [
          {
            entityType: "task",
            entityId: taskResult.taskId,
            eventType: "task_completed",
            payload: {},
          },
        ],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: taskResult.error,
    };
  });
}

function remindersCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreateReminderInput = {
    schemaVersion: "reminders_create_input.v1",
    traceId: input.traceId,
    title: String(input.entities.title ?? ""),
    dueAt: String(input.entities.dueAt ?? ""),
    source: "chatwoot",
    accountId: 7,
    inboxId: 45,
    conversationId: 85,
  };
  return remindersModule.create(createInput).then((result) => {
    if (result.status === "created") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          reminderId: result.reminderId,
          eventId: result.eventId,
          title: result.title,
          dueAt: result.dueAt,
        },
        stateChanges: [
          {
            entityType: "reminder",
            entityId: result.reminderId,
            eventType: "reminder_created",
            payload: {},
          },
        ],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: result.error,
    };
  });
}

function remindersListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListRemindersInput = {
    schemaVersion: "reminders_list_input.v1",
    traceId: input.traceId,
    limit: typeof input.entities.limit === "number" ? input.entities.limit : 5,
    accountId: 7,
    inboxId: 45,
    conversationId: 85,
  };
  return remindersModule.list(listInput).then((listResult) => {
    if (listResult.status === "success") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          reminders: listResult.reminders,
          count: listResult.count,
        },
        stateChanges: [],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: listResult.error,
    };
  });
}

function remindersCancelHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const cancelInput: CancelReminderInput = {
    schemaVersion: "reminders_cancel_input.v1",
    traceId: input.traceId,
    reminderId: input.entities.reminderId as string | undefined,
    titleMatch: input.entities.titleMatch as string | undefined,
    position: typeof input.entities.position === "number" ? input.entities.position : undefined,
    source: "chatwoot",
    accountId: 7,
    inboxId: 45,
    conversationId: 85,
  };
  return remindersModule.cancel(cancelInput).then((result) => {
    if (result.status === "canceled") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          reminderId: result.reminderId,
          eventId: result.eventId,
          title: result.title,
        },
        stateChanges: [
          {
            entityType: "reminder",
            entityId: result.reminderId,
            eventType: "reminder_canceled",
            payload: {},
          },
        ],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: result.error,
    };
  });
}

function dailyLogMorningHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const morningInput: DailyLogMorningInput = {
    schemaVersion: "daily_log_morning_input.v1",
    traceId: input.traceId,
    date: String(input.entities.date ?? ""),
    wakeEnergy: input.entities.wakeEnergy != null ? Number(input.entities.wakeEnergy) : undefined,
    sleepHours: input.entities.sleepHours != null ? Number(input.entities.sleepHours) : undefined,
    morningIntention: input.entities.morningIntention as string | undefined,
    mood: input.entities.mood as string | undefined,
    notes: Array.isArray(input.entities.notes) ? (input.entities.notes as string[]) : undefined,
    source: "chatwoot",
  };
  return dailyLogModule.morning(morningInput).then((result) => {
    if (result.status === "updated") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          dailyLogId: result.dailyLogId,
          eventId: result.eventId,
          date: result.date,
          eventType: result.evidence.eventType,
        },
        stateChanges: [
          {
            entityType: "daily_log",
            entityId: result.dailyLogId,
            eventType: result.evidence.eventType ?? "daily_log_morning_updated",
            payload: {},
          },
        ],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: result.error,
    };
  });
}

function dailyLogEveningHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const eveningInput: DailyLogEveningInput = {
    schemaVersion: "daily_log_evening_input.v1",
    traceId: input.traceId,
    date: String(input.entities.date ?? ""),
    eveningReview: input.entities.eveningReview as string | undefined,
    mood: input.entities.mood as string | undefined,
    notes: Array.isArray(input.entities.notes) ? (input.entities.notes as string[]) : undefined,
    source: "chatwoot",
  };
  return dailyLogModule.evening(eveningInput).then((result) => {
    if (result.status === "updated") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          dailyLogId: result.dailyLogId,
          eventId: result.eventId,
          date: result.date,
          eventType: result.evidence.eventType,
        },
        stateChanges: [
          {
            entityType: "daily_log",
            entityId: result.dailyLogId,
            eventType: result.evidence.eventType ?? "daily_log_evening_updated",
            payload: {},
          },
        ],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: result.error,
    };
  });
}

function dailyLogSummaryHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const summaryInput: DailyLogSummaryInput = {
    schemaVersion: "daily_log_summary_input.v1",
    traceId: input.traceId,
    date: String(input.entities.date ?? ""),
  };
  return dailyLogModule.summary(summaryInput).then((result) => {
    if (result.status === "success") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: result.dailyLog
          ? {
              dailyLog: result.dailyLog,
              dailyLogId: result.dailyLog.id,
              date: result.dailyLog.date,
            }
          : {
              date: summaryInput.date,
            },
        stateChanges: [],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: result.error,
    };
  });
}

const outboundClient = createChatwootClient(config.chatwoot.url, config.chatwoot.accountId, config.chatwoot.userToken);

const processor = createBufferProcessor({
  store,
  normalizer: createMessageNormalizer(),
  coarseClassifier: createCoarseClassifier(),
  intentClassifier: createModuleIntentClassifier(),
  router: createModuleRouter(),
  executor: createActionExecutor({
    notes: {
      create: notesCreateHandler,
      list: notesListHandler,
      search: notesSearchHandler,
    },
    tasks: {
      create: tasksCreateHandler,
      list: tasksListHandler,
      complete: tasksCompleteHandler,
    },
    reminders: {
      create: remindersCreateHandler,
      list: remindersListHandler,
      cancel: remindersCancelHandler,
    },
    "daily-log": {
      morning: dailyLogMorningHandler,
      evening: dailyLogEveningHandler,
      summary: dailyLogSummaryHandler,
    },
  }),
  composer: createResponseComposer(),
  fallbackGenerator: createDeepseekClient(config.deepseek.apiKey, config.deepseek.model),
  outbound: outboundClient,
  logger: app.log,
  sessionContextModule,
});

setInterval(() => void processor.processDue(), config.workerIntervalMs).unref();

const dispatcher = createRemindersDispatcher(remindersStore, outboundClient, app.log);
setInterval(() => void dispatcher.processDue(), config.remindersDispatcherIntervalMs).unref();

await app.listen({ host: "0.0.0.0", port: config.port });
