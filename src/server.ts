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
import { createAreasStore } from "./infra/areasStore.js";
import { createObjectivesStore } from "./infra/objectivesStore.js";
import { createRoutinesStore } from "./infra/routinesStore.js";
import { createWorkoutsStore } from "./infra/workoutsStore.js";
import { createTimersStore } from "./infra/timersStore.js";
import { createProgressStore } from "./infra/progressStore.js";
import { createPlansStore } from "./infra/plansStore.js";
import { createProtocolsStore } from "./infra/protocolsStore.js";
import { createNotesModule } from "./modules/notes/notesModule.js";
import { createTasksModule } from "./modules/tasks/tasksModule.js";
import { createSessionContextModule } from "./modules/sessionContext/sessionContextModule.js";
import { createRemindersModule } from "./modules/reminders/remindersModule.js";
import { createDailyLogModule } from "./modules/dailyLog/dailyLogModule.js";
import { createAreasModule } from "./modules/areas/areasModule.js";
import { createObjectivesModule } from "./modules/objectives/objectivesModule.js";
import { createRoutinesModule } from "./modules/routines/routinesModule.js";
import { createWorkoutsModule } from "./modules/workouts/workoutsModule.js";
import { createTimersModule } from "./modules/timers/timersModule.js";
import { createProgressModule } from "./modules/progress/progressModule.js";
import { createPlansModule } from "./modules/plans/plansModule.js";
import { createProtocolsModule } from "./modules/protocols/protocolsModule.js";
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
import type { CreateAreaInput, ListAreasInput, ArchiveAreaInput, AssignNoteAreaInput, AssignTaskAreaInput } from "./contracts/areas.js";
import type { CreateObjectiveInput, ListObjectivesInput, AchieveObjectiveInput, ArchiveObjectiveInput, AssignTaskObjectiveInput } from "./contracts/objectives.js";
import type { CreateRoutineInput, ListRoutinesInput, ActivateRoutineInput, PauseRoutineInput, ArchiveRoutineInput } from "./contracts/routines.js";
import type { StartWorkoutSessionInput, LogWorkoutSetInput, FinishWorkoutSessionInput, CancelWorkoutSessionInput, ListWorkoutSessionsInput } from "./contracts/workouts.js";
import type { StartTimerInput, CancelTimerInput } from "./contracts/timers.js";
import type { GetWorkoutProgressInput, GetObjectiveProgressInput, GetDailyConsistencyInput } from "./contracts/progress.js";
import type { CreatePlanInput, ListPlansInput, ArchivePlanInput, CompletePlanStepInput } from "./contracts/plans.js";
import type { CreateProtocolInput, ListProtocolsInput, ActivateProtocolInput, ArchiveProtocolInput, EvaluateProtocolInput } from "./contracts/protocols.js";
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

const areasStore = createAreasStore(supabase);
const areasModule = createAreasModule(areasStore);

const objectivesStore = createObjectivesStore(supabase);
const objectivesModule = createObjectivesModule(objectivesStore);

const routinesStore = createRoutinesStore(supabase);
const routinesModule = createRoutinesModule(routinesStore);

const workoutsStore = createWorkoutsStore(supabase);
const workoutsModule = createWorkoutsModule(workoutsStore);

const timersStore = createTimersStore(supabase);
const timersModule = createTimersModule(timersStore);

const progressStore = createProgressStore(supabase);
const progressModule = createProgressModule(progressStore);

const plansStore = createPlansStore(supabase);
const plansModule = createPlansModule(plansStore);

const protocolsStore = createProtocolsStore(supabase);
const protocolsModule = createProtocolsModule(protocolsStore);

registerModule("notes", ["create", "list", "search"]);
registerModule("tasks", ["create", "list", "complete"]);
registerModule("reminders", ["create", "list", "cancel"]);
registerModule("daily-log", ["morning", "evening", "summary"]);
registerModule("areas", ["create", "list", "archive", "assign-note", "assign-task"]);
registerModule("objectives", ["create", "list", "achieve", "archive", "assign-task"]);
registerModule("routines", ["create", "list", "activate", "pause", "archive"]);
registerModule("workouts", ["start", "log-set", "finish", "cancel", "list"]);
registerModule("timers", ["start", "cancel"]);
registerModule("progress", ["workout", "objective", "summary"]);
registerModule("plans", ["create", "list", "archive", "complete-step"]);
registerModule("protocols", ["create", "list", "activate", "archive", "evaluate"]);

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

function areasCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreateAreaInput = {
    schemaVersion: "areas_create_input.v1",
    traceId: input.traceId,
    name: String(input.entities.name ?? ""),
    slug: String(input.entities.slug ?? ""),
    description: input.entities.description as string | undefined,
    source: "chatwoot",
  };
  return areasModule.create(createInput).then((result) => {
    if (result.status === "created") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          areaId: result.areaId,
          eventId: result.eventId,
          name: result.name,
          slug: result.slug,
        },
        stateChanges: [
          {
            entityType: "area",
            entityId: result.areaId,
            eventType: "area_created",
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

function areasListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListAreasInput = {
    schemaVersion: "areas_list_input.v1",
    traceId: input.traceId,
    limit: typeof input.entities.limit === "number" ? input.entities.limit : 10,
  };
  return areasModule.list(listInput).then((listResult) => {
    if (listResult.status === "success") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          areas: listResult.areas,
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

function areasArchiveHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const archiveInput: ArchiveAreaInput = {
    schemaVersion: "areas_archive_input.v1",
    traceId: input.traceId,
    areaId: input.entities.areaId as string | undefined,
    slug: input.entities.areaSlug as string | undefined,
    source: "chatwoot",
  };
  return areasModule.archive(archiveInput).then((result) => {
    if (result.status === "archived") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          areaId: result.areaId,
          eventId: result.eventId,
          name: result.name,
          slug: result.slug,
        },
        stateChanges: [
          {
            entityType: "area",
            entityId: result.areaId,
            eventType: "area_archived",
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

function areasAssignNoteHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const assignInput: AssignNoteAreaInput = {
    schemaVersion: "areas_assign_note_input.v1",
    traceId: input.traceId,
    noteId: String(input.entities.noteId ?? ""),
    areaId: input.entities.areaId as string | undefined,
    areaSlug: input.entities.areaSlug as string | undefined,
    source: "chatwoot",
  };
  return areasModule.assignNote(assignInput).then((result) => {
    if (result.status === "assigned") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          noteId: result.noteId,
          areaId: result.areaId,
          areaName: result.areaName,
          areaSlug: result.areaSlug,
          eventId: result.eventId,
        },
        stateChanges: [
          {
            entityType: "note",
            entityId: result.noteId,
            eventType: "note_area_assigned",
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

function areasAssignTaskHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const assignInput: AssignTaskAreaInput = {
    schemaVersion: "areas_assign_task_input.v1",
    traceId: input.traceId,
    taskId: String(input.entities.taskId ?? ""),
    areaId: input.entities.areaId as string | undefined,
    areaSlug: input.entities.areaSlug as string | undefined,
    source: "chatwoot",
  };
  return areasModule.assignTask(assignInput).then((result) => {
    if (result.status === "assigned") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          taskId: result.taskId,
          title: result.title,
          areaId: result.areaId,
          areaName: result.areaName,
          areaSlug: result.areaSlug,
          eventId: result.eventId,
        },
        stateChanges: [
          {
            entityType: "task",
            entityId: result.taskId,
            eventType: "task_area_assigned",
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

function objectivesCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreateObjectiveInput = {
    schemaVersion: "objectives_create_input.v1",
    traceId: input.traceId,
    title: String(input.entities.title ?? ""),
    slug: String(input.entities.slug ?? ""),
    description: input.entities.description as string | undefined,
    areaId: input.entities.areaId as string | undefined,
    areaSlug: input.entities.areaSlug as string | undefined,
    targetDate: input.entities.targetDate as string | undefined,
    successCriteria: Array.isArray(input.entities.successCriteria) ? (input.entities.successCriteria as string[]) : [],
    source: "chatwoot",
  };
  return objectivesModule.create(createInput).then((result) => {
    if (result.status === "created") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          objectiveId: result.objectiveId,
          eventId: result.eventId,
          title: result.title,
          slug: result.slug,
          areaId: result.areaId,
          areaName: result.areaName,
        },
        stateChanges: [
          {
            entityType: "objective",
            entityId: result.objectiveId,
            eventType: "objective_created",
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

function objectivesListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListObjectivesInput = {
    schemaVersion: "objectives_list_input.v1",
    traceId: input.traceId,
    limit: typeof input.entities.limit === "number" ? input.entities.limit : 10,
  };
  return objectivesModule.list(listInput).then((listResult) => {
    if (listResult.status === "success") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          objectives: listResult.objectives,
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

function objectivesAchieveHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const achieveInput: AchieveObjectiveInput = {
    schemaVersion: "objectives_achieve_input.v1",
    traceId: input.traceId,
    objectiveId: input.entities.objectiveId as string | undefined,
    slug: input.entities.objectiveSlug as string | undefined,
    source: "chatwoot",
  };
  return objectivesModule.achieve(achieveInput).then((result) => {
    if (result.status === "achieved") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          objectiveId: result.objectiveId,
          eventId: result.eventId,
          title: result.title,
          slug: result.slug,
        },
        stateChanges: [
          {
            entityType: "objective",
            entityId: result.objectiveId,
            eventType: "objective_achieved",
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

function objectivesArchiveHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const archiveInput: ArchiveObjectiveInput = {
    schemaVersion: "objectives_archive_input.v1",
    traceId: input.traceId,
    objectiveId: input.entities.objectiveId as string | undefined,
    slug: input.entities.objectiveSlug as string | undefined,
    source: "chatwoot",
  };
  return objectivesModule.archive(archiveInput).then((result) => {
    if (result.status === "archived") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          objectiveId: result.objectiveId,
          eventId: result.eventId,
          title: result.title,
          slug: result.slug,
        },
        stateChanges: [
          {
            entityType: "objective",
            entityId: result.objectiveId,
            eventType: "objective_archived",
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

function objectivesAssignTaskHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const assignInput: AssignTaskObjectiveInput = {
    schemaVersion: "objectives_assign_task_input.v1",
    traceId: input.traceId,
    taskId: String(input.entities.taskId ?? ""),
    objectiveId: input.entities.objectiveId as string | undefined,
    objectiveSlug: input.entities.objectiveSlug as string | undefined,
    source: "chatwoot",
  };
  return objectivesModule.assignTask(assignInput).then((result) => {
    if (result.status === "assigned") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          taskId: result.taskId,
          taskTitle: result.taskTitle,
          objectiveId: result.objectiveId,
          objectiveTitle: result.objectiveTitle,
          objectiveSlug: result.objectiveSlug,
          eventId: result.eventId,
        },
        stateChanges: [
          {
            entityType: "task",
            entityId: result.taskId,
            eventType: "task_objective_assigned",
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

function routinesCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreateRoutineInput = {
    schemaVersion: "routines_create_input.v1",
    traceId: input.traceId,
    name: String(input.entities.name ?? ""),
    slug: String(input.entities.slug ?? ""),
    description: input.entities.description as string | undefined,
    steps: Array.isArray(input.entities.steps) ? createRoutineSteps(input.entities.steps) : undefined,
    source: "chatwoot",
  };
  return routinesModule.create(createInput).then((result) => result.status === "created" ? {
    schemaVersion: "action_execution_result.v1",
    traceId: input.traceId,
    status: "executed",
    evidence: { routineId: result.routineId, eventId: result.eventId, name: result.name ?? createInput.name, slug: result.slug ?? createInput.slug },
    stateChanges: [{ entityType: "routine", entityId: result.routineId, eventType: "routine_created", payload: {} }],
  } : failed(input, result.error));
}

function createRoutineSteps(value: unknown[]): CreateRoutineInput["steps"] {
  return value.map((step) => {
    const s = step as Record<string, unknown>;
    return {
      position: Number(s.position),
      timeOfDay: s.timeOfDay as string | undefined,
      title: String(s.title ?? ""),
      description: s.description as string | undefined,
      durationMinutes: typeof s.durationMinutes === "number" ? s.durationMinutes : undefined,
    };
  });
}

function routinesListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListRoutinesInput = { schemaVersion: "routines_list_input.v1", traceId: input.traceId, limit: typeof input.entities.limit === "number" ? input.entities.limit : 10 };
  return routinesModule.list(listInput).then((result) => result.status === "success" ? {
    schemaVersion: "action_execution_result.v1",
    traceId: input.traceId,
    status: "executed",
    evidence: { routines: result.routines, count: result.count },
    stateChanges: [],
  } : failed(input, result.error));
}

function routinesActivateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const activateInput: ActivateRoutineInput = { schemaVersion: "routines_activate_input.v1", traceId: input.traceId, routineId: input.entities.routineId as string | undefined, slug: input.entities.slug as string | undefined, source: "chatwoot" };
  return routinesModule.activate(activateInput).then((result) => result.status === "activated" ? executedRoutine(input, result.routineId, result.eventId, result.name, result.slug, "routine_activated") : failed(input, result.error));
}

function routinesPauseHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const pauseInput: PauseRoutineInput = { schemaVersion: "routines_pause_input.v1", traceId: input.traceId, routineId: input.entities.routineId as string | undefined, slug: input.entities.slug as string | undefined, source: "chatwoot" };
  return routinesModule.pause(pauseInput).then((result) => result.status === "paused" ? executedRoutine(input, result.routineId, result.eventId, result.name, result.slug, "routine_paused") : failed(input, result.error));
}

function routinesArchiveHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const archiveInput: ArchiveRoutineInput = { schemaVersion: "routines_archive_input.v1", traceId: input.traceId, routineId: input.entities.routineId as string | undefined, slug: input.entities.slug as string | undefined, source: "chatwoot" };
  return routinesModule.archive(archiveInput).then((result) => result.status === "archived" ? executedRoutine(input, result.routineId, result.eventId, result.name, result.slug, "routine_archived") : failed(input, result.error));
}

function executedRoutine(input: ActionExecutionInput, routineId: string | undefined, eventId: string | undefined, name: string | undefined, slug: string | undefined, eventType: string): ActionExecutionResult {
  return { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { routineId, eventId, name, slug }, stateChanges: [{ entityType: "routine", entityId: routineId, eventType, payload: {} }] };
}

function workoutsStartHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const startInput: StartWorkoutSessionInput = { schemaVersion: "workouts_start_input.v1", traceId: input.traceId, title: input.entities.title as string | undefined, source: "chatwoot" };
  return workoutsModule.start(startInput).then((result) => result.status === "started" ? {
    schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed",
    evidence: { sessionId: result.sessionId, eventId: result.eventId, title: result.title },
    stateChanges: [{ entityType: "workout_session", entityId: result.sessionId, eventType: "workout_session_started", payload: {} }],
  } : failed(input, result.error));
}

function workoutsLogSetHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const setInput: LogWorkoutSetInput = {
    schemaVersion: "workouts_set_input.v1",
    traceId: input.traceId,
    sessionId: String(input.entities.sessionId ?? ""),
    exerciseName: String(input.entities.exerciseName ?? ""),
    setNumber: typeof input.entities.setNumber === "number" ? input.entities.setNumber : 1,
    actualReps: typeof input.entities.actualReps === "number" ? input.entities.actualReps : undefined,
    weightKg: typeof input.entities.weightKg === "number" ? input.entities.weightKg : undefined,
    durationSeconds: typeof input.entities.durationSeconds === "number" ? input.entities.durationSeconds : undefined,
    source: "chatwoot",
  };
  return workoutsModule.logSet(setInput).then((result) => result.status === "logged" ? {
    schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed",
    evidence: { setId: result.setId, eventId: result.eventId, sessionId: result.sessionId, exerciseName: result.exerciseName, setNumber: result.setNumber },
    stateChanges: [{ entityType: "workout_set", entityId: result.setId, eventType: "workout_set_logged", payload: {} }],
  } : failed(input, result.error));
}

function workoutsFinishHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const finishInput: FinishWorkoutSessionInput = { schemaVersion: "workouts_finish_input.v1", traceId: input.traceId, sessionId: input.entities.sessionId as string | undefined, source: "chatwoot" };
  return workoutsModule.finish(finishInput).then((result) => result.status === "finished" ? {
    schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed",
    evidence: { sessionId: result.sessionId, eventId: result.eventId, title: result.title, setCount: result.setCount },
    stateChanges: [{ entityType: "workout_session", entityId: result.sessionId, eventType: "workout_session_finished", payload: {} }],
  } : failed(input, result.error));
}

function workoutsCancelHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const cancelInput: CancelWorkoutSessionInput = { schemaVersion: "workouts_cancel_input.v1", traceId: input.traceId, sessionId: input.entities.sessionId as string | undefined, source: "chatwoot" };
  return workoutsModule.cancel(cancelInput).then((result) => result.status === "canceled" ? {
    schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed",
    evidence: { sessionId: result.sessionId, eventId: result.eventId, title: result.title },
    stateChanges: [{ entityType: "workout_session", entityId: result.sessionId, eventType: "workout_session_canceled", payload: {} }],
  } : failed(input, result.error));
}

function workoutsListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListWorkoutSessionsInput = { schemaVersion: "workouts_list_input.v1", traceId: input.traceId, limit: typeof input.entities.limit === "number" ? input.entities.limit : 5 };
  return workoutsModule.list(listInput).then((result) => result.status === "success" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { sessions: result.sessions, count: result.count }, stateChanges: [] } : failed(input, result.error));
}

function timersStartHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const startInput: StartTimerInput = {
    schemaVersion: "timers_start_input.v1",
    traceId: input.traceId,
    kind: input.entities.kind as StartTimerInput["kind"],
    title: String(input.entities.title ?? ""),
    durationSeconds: Number(input.entities.durationSeconds),
    accountId: Number(input.entities.accountId),
    inboxId: Number(input.entities.inboxId),
    conversationId: Number(input.entities.conversationId),
    source: "chatwoot",
  };
  return timersModule.start(startInput).then((result) => result.status === "started" ? {
    schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed",
    evidence: { timerId: result.timerId, eventId: result.eventId, title: result.title, kind: result.kind, durationSeconds: result.durationSeconds, dueAt: result.dueAt },
    stateChanges: [{ entityType: "timer", entityId: result.timerId, eventType: "timer_started", payload: {} }],
  } : failed(input, result.error));
}

function timersCancelHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const cancelInput: CancelTimerInput = { schemaVersion: "timers_cancel_input.v1", traceId: input.traceId, timerId: String(input.entities.timerId ?? ""), accountId: Number(input.entities.accountId), inboxId: Number(input.entities.inboxId), conversationId: Number(input.entities.conversationId), source: "chatwoot" };
  return timersModule.cancel(cancelInput).then((result) => result.status === "canceled" ? {
    schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed",
    evidence: { timerId: result.timerId, eventId: result.eventId, title: result.title, kind: result.kind },
    stateChanges: [{ entityType: "timer", entityId: result.timerId, eventType: "timer_canceled", payload: {} }],
  } : failed(input, result.error));
}

function progressWorkoutHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const progressInput: GetWorkoutProgressInput = { schemaVersion: "progress_workout_input.v1", traceId: input.traceId, exerciseName: input.entities.exerciseName as string | undefined, limit: 5 };
  return progressModule.workout(progressInput).then((result) => result.status === "success" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { progress: result.progress }, stateChanges: [] } : result.status === "empty" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: {}, stateChanges: [] } : failed(input, result.error));
}

function progressObjectiveHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const progressInput: GetObjectiveProgressInput = { schemaVersion: "progress_objective_input.v1", traceId: input.traceId, objectiveSlug: input.entities.objectiveSlug as string | undefined };
  return progressModule.objective(progressInput).then((result) => result.status === "success" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { progress: result.progress }, stateChanges: [] } : result.status === "empty" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: {}, stateChanges: [] } : failed(input, result.error));
}

function progressSummaryHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const progressInput: GetDailyConsistencyInput = { schemaVersion: "progress_consistency_input.v1", traceId: input.traceId, days: 30 };
  return progressModule.summary(progressInput).then((result) => result.status === "success" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { summary: result.summary }, stateChanges: [] } : result.status === "empty" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: {}, stateChanges: [] } : failed(input, result.error));
}

function plansCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreatePlanInput = { schemaVersion: "plans_create_input.v1", traceId: input.traceId, title: String(input.entities.title ?? ""), slug: String(input.entities.slug ?? ""), steps: Array.isArray(input.entities.steps) ? (input.entities.steps as string[]).map((title) => ({ title })) : [], source: "chatwoot" };
  return plansModule.create(createInput).then((result) => result.status === "created" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { planId: result.planId, eventId: result.eventId, title: result.title ?? createInput.title, slug: result.slug ?? createInput.slug, stepTitles: result.stepTitles }, stateChanges: [{ entityType: "plan", entityId: result.planId, eventType: "plan_created", payload: {} }] } : failed(input, result.error));
}

function plansListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListPlansInput = { schemaVersion: "plans_list_input.v1", traceId: input.traceId, limit: typeof input.entities.limit === "number" ? input.entities.limit : 5 };
  return plansModule.list(listInput).then((result) => result.status === "success" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { plans: result.plans, count: result.count }, stateChanges: [] } : failed(input, result.error));
}

function plansArchiveHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const archiveInput: ArchivePlanInput = { schemaVersion: "plans_archive_input.v1", traceId: input.traceId, planId: input.entities.planId as string | undefined, slug: input.entities.planSlug as string | undefined, source: "chatwoot" };
  return plansModule.archive(archiveInput).then((result) => result.status === "archived" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { planId: result.planId, eventId: result.eventId, title: result.title, slug: result.slug }, stateChanges: [{ entityType: "plan", entityId: result.planId, eventType: "plan_archived", payload: {} }] } : failed(input, result.error));
}

function plansCompleteStepHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const completeInput: CompletePlanStepInput = { schemaVersion: "plans_complete_step_input.v1", traceId: input.traceId, stepId: input.entities.stepId as string | undefined, planSlug: input.entities.planSlug as string | undefined, stepPosition: typeof input.entities.stepPosition === "number" ? input.entities.stepPosition : undefined, source: "chatwoot" };
  return plansModule.completeStep(completeInput).then((result) => result.status === "completed" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { stepId: result.stepId, eventId: result.eventId, planId: result.planId, title: result.title, position: result.position }, stateChanges: [{ entityType: "plan_step", entityId: result.stepId, eventType: "plan_step_completed", payload: {} }] } : failed(input, result.error));
}

function protocolsCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreateProtocolInput = { schemaVersion: "protocols_create_input.v1", traceId: input.traceId, name: String(input.entities.name ?? ""), slug: String(input.entities.slug ?? ""), scope: (input.entities.scope as CreateProtocolInput["scope"]) ?? "general", rules: Array.isArray(input.entities.rules) ? input.entities.rules as CreateProtocolInput["rules"] : [], description: input.entities.description as string | undefined, source: "chatwoot" };
  return protocolsModule.create(createInput).then((result) => result.status === "created" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { protocolId: result.protocolId, eventId: result.eventId, name: result.name ?? createInput.name, slug: result.slug ?? createInput.slug, scope: result.scope }, stateChanges: [{ entityType: "protocol", entityId: result.protocolId, eventType: "protocol_created", payload: {} }] } : failed(input, result.error));
}

function protocolsListHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const listInput: ListProtocolsInput = { schemaVersion: "protocols_list_input.v1", traceId: input.traceId, limit: typeof input.entities.limit === "number" ? input.entities.limit : 5 };
  return protocolsModule.list(listInput).then((result) => result.status === "success" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { protocols: result.protocols, count: result.count }, stateChanges: [] } : failed(input, result.error));
}

function protocolsActivateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const activateInput: ActivateProtocolInput = { schemaVersion: "protocols_activate_input.v1", traceId: input.traceId, protocolId: input.entities.protocolId as string | undefined, slug: input.entities.slug as string | undefined, source: "chatwoot" };
  return protocolsModule.activate(activateInput).then((result) => result.status === "activated" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { protocolId: result.protocolId, eventId: result.eventId, name: result.name, slug: result.slug, scope: result.scope }, stateChanges: [{ entityType: "protocol", entityId: result.protocolId, eventType: "protocol_activated", payload: {} }] } : failed(input, result.error));
}

function protocolsArchiveHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const archiveInput: ArchiveProtocolInput = { schemaVersion: "protocols_archive_input.v1", traceId: input.traceId, protocolId: input.entities.protocolId as string | undefined, slug: input.entities.slug as string | undefined, source: "chatwoot" };
  return protocolsModule.archive(archiveInput).then((result) => result.status === "archived" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { protocolId: result.protocolId, eventId: result.eventId, name: result.name, slug: result.slug, scope: result.scope }, stateChanges: [{ entityType: "protocol", entityId: result.protocolId, eventType: "protocol_archived", payload: {} }] } : failed(input, result.error));
}

function protocolsEvaluateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const evaluateInput: EvaluateProtocolInput = { schemaVersion: "protocols_evaluate_input.v1", traceId: input.traceId, protocolId: input.entities.protocolId as string | undefined, slug: input.entities.slug as string | undefined, context: (input.entities.context as Record<string, unknown>) ?? {}, source: "chatwoot" };
  return protocolsModule.evaluate(evaluateInput).then((result) => result.status === "evaluated" ? { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "executed", evidence: { protocolId: result.protocolId, eventId: result.eventId, name: result.name, slug: result.slug, scope: result.scope, suggestions: result.suggestions, rulesCount: result.evidence.rulesCount, rulesMatched: result.evidence.rulesMatched }, stateChanges: [{ entityType: "protocol", entityId: result.protocolId, eventType: "protocol_evaluated", payload: {} }] } : failed(input, result.error));
}

function failed(input: ActionExecutionInput, error?: string): ActionExecutionResult {
  return { schemaVersion: "action_execution_result.v1", traceId: input.traceId, status: "failed", evidence: {}, stateChanges: [], error };
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
    areas: {
      create: areasCreateHandler,
      list: areasListHandler,
      archive: areasArchiveHandler,
      "assign-note": areasAssignNoteHandler,
      "assign-task": areasAssignTaskHandler,
    },
    objectives: {
      create: objectivesCreateHandler,
      list: objectivesListHandler,
      achieve: objectivesAchieveHandler,
      archive: objectivesArchiveHandler,
      "assign-task": objectivesAssignTaskHandler,
    },
    routines: {
      create: routinesCreateHandler,
      list: routinesListHandler,
      activate: routinesActivateHandler,
      pause: routinesPauseHandler,
      archive: routinesArchiveHandler,
    },
    workouts: {
      start: workoutsStartHandler,
      "log-set": workoutsLogSetHandler,
      finish: workoutsFinishHandler,
      cancel: workoutsCancelHandler,
      list: workoutsListHandler,
    },
    timers: {
      start: timersStartHandler,
      cancel: timersCancelHandler,
    },
    progress: {
      workout: progressWorkoutHandler,
      objective: progressObjectiveHandler,
      summary: progressSummaryHandler,
    },
    plans: {
      create: plansCreateHandler,
      list: plansListHandler,
      archive: plansArchiveHandler,
      "complete-step": plansCompleteStepHandler,
    },
    protocols: {
      create: protocolsCreateHandler,
      list: protocolsListHandler,
      activate: protocolsActivateHandler,
      archive: protocolsArchiveHandler,
      evaluate: protocolsEvaluateHandler,
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
