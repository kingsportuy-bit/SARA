import type { ClaimedBuffer, MessageStore, OutboundChatwoot, ResponseGenerator } from "../contracts.js";
import type { CoarseClassifier } from "./coarseClassifier.js";
import type { ModuleIntentClassifier } from "./moduleIntentClassifier.js";
import type { ModuleRouter } from "./moduleRouter.js";
import type { ActionExecutor } from "./actionExecutor.js";
import type { ResponseComposer } from "./responseComposer.js";
import type { MessageNormalizer } from "./messageNormalizer.js";
import type { SessionContextModule } from "./sessionContext/sessionContextModule.js";

interface PipelineContext {
  store: MessageStore;
  normalizer: MessageNormalizer;
  coarseClassifier: CoarseClassifier;
  intentClassifier: ModuleIntentClassifier;
  router: ModuleRouter;
  executor: ActionExecutor;
  composer: ResponseComposer;
  fallbackGenerator: ResponseGenerator;
  outbound: OutboundChatwoot;
  logger: { info: (data: object, message: string) => void; error: (data: object, message: string) => void };
  sessionContextModule?: SessionContextModule;
}

export function createBufferProcessor(ctx: PipelineContext) {
  let running = false;

  async function processDue(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const buffers = await ctx.store.claimDue(10);
      for (const buffer of buffers) {
        await processBuffer(buffer);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.logger.error({ error: message }, "buffer claim failed");
    } finally {
      running = false;
    }
  }

  async function loadSessionContext(buffer: ClaimedBuffer) {
    if (!ctx.sessionContextModule) return undefined;

    try {
      const result = await ctx.sessionContextModule.get({
        accountId: buffer.account_id,
        inboxId: buffer.inbox_id,
        conversationId: buffer.conversation_id,
      });

      if (!result.context) return undefined;

      return {
        contextId: result.context.id,
        activeModule: result.context.activeModule,
        activeFlow: result.context.activeFlow,
        focusedEntityType: result.context.focusedEntityType,
        focusedEntityId: result.context.focusedEntityId,
        awaitingConfirmation: result.context.awaitingConfirmation,
        context: result.context.context,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.logger.error({ error: message, bufferId: buffer.buffer_id }, "failed to load session context");
      return undefined;
    }
  }

  async function updateSessionContext(
    buffer: ClaimedBuffer,
    actionResult: { status: string; evidence: Record<string, unknown>; stateChanges: Array<{ entityType: string; entityId?: string; eventType: string; payload: Record<string, unknown> }> },
    module: string,
    action: string,
  ): Promise<void> {
    if (!ctx.sessionContextModule) return;

    try {
      const base = {
        traceId: buffer.trace_id,
        accountId: buffer.account_id,
        inboxId: buffer.inbox_id,
        conversationId: buffer.conversation_id,
      };

      if (module === "tasks") {
        if (action === "create" && actionResult.status === "executed") {
          const taskId = actionResult.evidence?.taskId as string | undefined;
          const title = actionResult.evidence?.title as string | undefined;
          if (taskId) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "tasks",
              activeFlow: "task_created",
              focusedEntityType: "task",
              focusedEntityId: taskId,
              context: title ? { lastTaskTitle: title } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, taskId }, "session context updated for tasks.create");
          }
        } else if (action === "list" && actionResult.status === "executed") {
          const tasks = actionResult.evidence?.tasks as Array<{ id: string; title: string }> | undefined;
          const count = actionResult.evidence?.count as number | undefined;

          if (tasks && count === 1 && tasks.length === 1) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "tasks",
              activeFlow: "task_listed",
              focusedEntityType: "task",
              focusedEntityId: tasks[0].id,
              context: { lastTaskTitle: tasks[0].title, lastTaskList: [{ position: 1, id: tasks[0].id, title: tasks[0].title }] },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id }, "session context focused on single pending task");
          } else if (tasks && count && count > 1) {
            const taskList = tasks.map((t, i) => ({ position: i + 1, id: t.id, title: t.title }));
            ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "tasks",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: { lastTaskList: taskList },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, count }, "session context saved lastTaskList");
          }
        } else if (action === "complete" && actionResult.status === "executed") {
          const completedTaskId = actionResult.evidence?.taskId as string | undefined;
          const completedTitle = actionResult.evidence?.title as string | undefined;

          const existingCtx = await ctx.sessionContextModule.get({
            accountId: buffer.account_id,
            inboxId: buffer.inbox_id,
            conversationId: buffer.conversation_id,
          });

          const focusedId = existingCtx.context?.focusedEntityId;
          const shouldClearFocus = completedTaskId && focusedId === completedTaskId;

          if (shouldClearFocus) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "tasks",
              activeFlow: "task_completed",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: completedTitle ? { lastCompletedTitle: completedTitle } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, taskId: completedTaskId }, "session context cleared focus after tasks.complete of focused task");
          } else {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "tasks",
              activeFlow: "task_completed",
              context: completedTitle ? { lastCompletedTitle: completedTitle } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, taskId: completedTaskId }, "session context updated for tasks.complete");
          }
        }
      } else if (module === "notes") {
        const noteId = actionResult.evidence?.noteId as string | undefined;
        if (action === "create" && actionResult.status === "executed" && noteId) {
          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "notes",
            activeFlow: "note_created",
            focusedEntityType: "note",
            focusedEntityId: noteId,
          });
          ctx.logger.info({ bufferId: buffer.buffer_id, noteId }, "session context updated for notes.create");
        } else if ((action === "list" || action === "search") && actionResult.status === "executed") {
          const notes = actionResult.evidence?.notes as Array<{ id: string }> | undefined;
          const count = actionResult.evidence?.count as number | undefined;
          if (notes && count === 1 && notes.length === 1) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "notes",
              focusedEntityType: "note",
              focusedEntityId: notes[0].id,
            });
            ctx.logger.info({ bufferId: buffer.buffer_id }, "session context focused on single note result");
          }
        }
      } else if (module === "daily-log") {
        if (action === "morning" && actionResult.status === "executed") {
          const dailyLogId = actionResult.evidence?.dailyLogId as string | undefined;
          const date = actionResult.evidence?.date as string | undefined;
          if (dailyLogId) {
            const ctxPayload: Record<string, unknown> = {};
            if (date) ctxPayload.lastDailyLogDate = date;
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "daily-log",
              activeFlow: "daily_log_morning_updated",
              focusedEntityType: "daily_log",
              focusedEntityId: dailyLogId,
              context: ctxPayload,
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, dailyLogId }, "session context updated for daily-log.morning");
          }
        } else if (action === "evening" && actionResult.status === "executed") {
          const dailyLogId = actionResult.evidence?.dailyLogId as string | undefined;
          const date = actionResult.evidence?.date as string | undefined;
          if (dailyLogId) {
            const ctxPayload: Record<string, unknown> = {};
            if (date) ctxPayload.lastDailyLogDate = date;
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "daily-log",
              activeFlow: "daily_log_evening_updated",
              focusedEntityType: "daily_log",
              focusedEntityId: dailyLogId,
              context: ctxPayload,
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, dailyLogId }, "session context updated for daily-log.evening");
          }
        } else if (action === "summary" && actionResult.status === "executed") {
          const dailyLogId = actionResult.evidence?.dailyLogId as string | undefined;
          if (dailyLogId) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "daily-log",
              focusedEntityType: "daily_log",
              focusedEntityId: dailyLogId,
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, dailyLogId }, "session context updated for daily-log.summary");
          }
        }
      } else if (module === "reminders") {
        if (action === "create" && actionResult.status === "executed") {
          const reminderId = actionResult.evidence?.reminderId as string | undefined;
          const title = actionResult.evidence?.title as string | undefined;
          const dueAt = actionResult.evidence?.dueAt as string | undefined;
          if (reminderId) {
            const ctxPayload: Record<string, unknown> = {};
            if (title) ctxPayload.lastReminderTitle = title;
            if (dueAt) ctxPayload.lastReminderDueAt = dueAt;
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "reminders",
              activeFlow: "reminder_created",
              focusedEntityType: "reminder",
              focusedEntityId: reminderId,
              context: ctxPayload,
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, reminderId }, "session context updated for reminders.create");
          }
        } else if (action === "list" && actionResult.status === "executed") {
          const reminders = actionResult.evidence?.reminders as Array<{ id: string; title: string; dueAt: string }> | undefined;
          const count = actionResult.evidence?.count as number | undefined;

          if (reminders && count === 1 && reminders.length === 1) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "reminders",
              activeFlow: "reminder_listed",
              focusedEntityType: "reminder",
              focusedEntityId: reminders[0].id,
              context: {
                lastReminderTitle: reminders[0].title,
                lastReminderDueAt: reminders[0].dueAt,
                lastReminderList: [{ position: 1, id: reminders[0].id, title: reminders[0].title, dueAt: reminders[0].dueAt }],
              },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id }, "session context focused on single pending reminder");
          } else if (reminders && count && count > 1) {
            const reminderList = reminders.map((r, i) => ({ position: i + 1, id: r.id, title: r.title, dueAt: r.dueAt }));
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "reminders",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: { lastReminderList: reminderList },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, count }, "session context saved lastReminderList");
          }
        } else if (action === "cancel" && actionResult.status === "executed") {
          const canceledReminderId = actionResult.evidence?.reminderId as string | undefined;
          const canceledTitle = actionResult.evidence?.title as string | undefined;

          const existingCtx = await ctx.sessionContextModule.get({
            accountId: buffer.account_id,
            inboxId: buffer.inbox_id,
            conversationId: buffer.conversation_id,
          });

          const focusedId = existingCtx.context?.focusedEntityId;
          const shouldClearFocus = canceledReminderId && focusedId === canceledReminderId;

          if (shouldClearFocus) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "reminders",
              activeFlow: "reminder_canceled",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: canceledTitle ? { lastCanceledTitle: canceledTitle } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, reminderId: canceledReminderId }, "session context cleared focus after reminders.cancel of focused reminder");
          } else {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "reminders",
              activeFlow: "reminder_canceled",
              context: canceledTitle ? { lastCanceledTitle: canceledTitle } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, reminderId: canceledReminderId }, "session context updated for reminders.cancel");
          }
        }
      } else if (module === "areas") {
        if (action === "create" && actionResult.status === "executed") {
          const areaId = actionResult.evidence?.areaId as string | undefined;
          const name = actionResult.evidence?.name as string | undefined;
          const slug = actionResult.evidence?.slug as string | undefined;
          if (areaId) {
            const ctxPayload: Record<string, unknown> = {};
            if (name) ctxPayload.lastAreaName = name;
            if (slug) ctxPayload.lastAreaSlug = slug;
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "areas",
              activeFlow: "area_created",
              focusedEntityType: "area",
              focusedEntityId: areaId,
              context: ctxPayload,
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, areaId }, "session context updated for areas.create");
          }
        } else if (action === "list" && actionResult.status === "executed") {
          const areas = actionResult.evidence?.areas as Array<{ id: string; name: string; slug: string }> | undefined;
          const count = actionResult.evidence?.count as number | undefined;

          if (areas && count === 1 && areas.length === 1) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "areas",
              focusedEntityType: "area",
              focusedEntityId: areas[0].id,
              context: {
                lastAreaName: areas[0].name,
                lastAreaSlug: areas[0].slug,
                lastAreaList: [{ position: 1, id: areas[0].id, name: areas[0].name, slug: areas[0].slug }],
              },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id }, "session context focused on single active area");
          } else if (areas && count && count > 1) {
            const areaList = areas.map((a, i) => ({ position: i + 1, id: a.id, name: a.name, slug: a.slug }));
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "areas",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: { lastAreaList: areaList },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, count }, "session context saved lastAreaList");
          }
        } else if (action === "archive" && actionResult.status === "executed") {
          const archivedAreaId = actionResult.evidence?.areaId as string | undefined;
          const archivedName = actionResult.evidence?.name as string | undefined;

          const existingCtx = await ctx.sessionContextModule.get({
            accountId: buffer.account_id,
            inboxId: buffer.inbox_id,
            conversationId: buffer.conversation_id,
          });

          const focusedId = existingCtx.context?.focusedEntityId;
          const shouldClearFocus = archivedAreaId && focusedId === archivedAreaId;

          if (shouldClearFocus) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "areas",
              activeFlow: "area_archived",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: archivedName ? { lastArchivedAreaName: archivedName } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, areaId: archivedAreaId }, "session context cleared focus after areas.archive of focused area");
          } else {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "areas",
              activeFlow: "area_archived",
              context: archivedName ? { lastArchivedAreaName: archivedName } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, areaId: archivedAreaId }, "session context updated for areas.archive");
          }
        } else if ((action === "assign-note" || action === "assign-task") && actionResult.status === "executed") {
          const areaId = actionResult.evidence?.areaId as string | undefined;
          const areaName = actionResult.evidence?.areaName as string | undefined;
          const areaSlug = actionResult.evidence?.areaSlug as string | undefined;
          const entityType = action === "assign-note" ? "note" : "task";
          const entityId = actionResult.evidence?.noteId as string | undefined ?? actionResult.evidence?.taskId as string | undefined;
          const entityTitle = actionResult.evidence?.title as string | undefined;

          const ctxPayload: Record<string, unknown> = {};
          if (areaName) ctxPayload.lastAreaName = areaName;
          if (areaSlug) ctxPayload.lastAreaSlug = areaSlug;
          if (entityTitle) ctxPayload.lastAssignedTitle = entityTitle;

          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "areas",
            activeFlow: action === "assign-note" ? "note_area_assigned" : "task_area_assigned",
            focusedEntityType: entityType,
            focusedEntityId: entityId,
            context: ctxPayload,
          });
          ctx.logger.info({ bufferId: buffer.buffer_id, areaId, entityId }, `session context updated for areas.${action}`);
        }
      } else if (module === "objectives") {
        if (action === "create" && actionResult.status === "executed") {
          const objectiveId = actionResult.evidence?.objectiveId as string | undefined;
          const title = actionResult.evidence?.title as string | undefined;
          const slug = actionResult.evidence?.slug as string | undefined;
          if (objectiveId) {
            const ctxPayload: Record<string, unknown> = {};
            if (title) ctxPayload.lastObjectiveTitle = title;
            if (slug) ctxPayload.lastObjectiveSlug = slug;
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "objectives",
              activeFlow: "objective_created",
              focusedEntityType: "objective",
              focusedEntityId: objectiveId,
              context: ctxPayload,
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, objectiveId }, "session context updated for objectives.create");
          }
        } else if (action === "list" && actionResult.status === "executed") {
          const objectives = actionResult.evidence?.objectives as Array<{ id: string; title: string; slug: string }> | undefined;
          const count = actionResult.evidence?.count as number | undefined;

          if (objectives && count === 1 && objectives.length === 1) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "objectives",
              focusedEntityType: "objective",
              focusedEntityId: objectives[0].id,
              context: {
                lastObjectiveTitle: objectives[0].title,
                lastObjectiveSlug: objectives[0].slug,
                lastObjectiveList: [{ position: 1, id: objectives[0].id, title: objectives[0].title, slug: objectives[0].slug }],
              },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id }, "session context focused on single active objective");
          } else if (objectives && count && count > 1) {
            const objectiveList = objectives.map((o, i) => ({ position: i + 1, id: o.id, title: o.title, slug: o.slug }));
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "objectives",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: { lastObjectiveList: objectiveList },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, count }, "session context saved lastObjectiveList");
          }
        } else if (action === "achieve" && actionResult.status === "executed") {
          const achievedObjectiveId = actionResult.evidence?.objectiveId as string | undefined;
          const achievedTitle = actionResult.evidence?.title as string | undefined;

          const existingCtx = await ctx.sessionContextModule.get({
            accountId: buffer.account_id,
            inboxId: buffer.inbox_id,
            conversationId: buffer.conversation_id,
          });

          const focusedId = existingCtx.context?.focusedEntityId;
          const shouldClearFocus = achievedObjectiveId && focusedId === achievedObjectiveId;

          if (shouldClearFocus) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "objectives",
              activeFlow: "objective_achieved",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: achievedTitle ? { lastAchievedObjectiveTitle: achievedTitle } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, objectiveId: achievedObjectiveId }, "session context cleared focus after objectives.achieve of focused objective");
          } else {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "objectives",
              activeFlow: "objective_achieved",
              context: achievedTitle ? { lastAchievedObjectiveTitle: achievedTitle } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, objectiveId: achievedObjectiveId }, "session context updated for objectives.achieve");
          }
        } else if (action === "archive" && actionResult.status === "executed") {
          const archivedObjectiveId = actionResult.evidence?.objectiveId as string | undefined;
          const archivedTitle = actionResult.evidence?.title as string | undefined;

          const existingCtx = await ctx.sessionContextModule.get({
            accountId: buffer.account_id,
            inboxId: buffer.inbox_id,
            conversationId: buffer.conversation_id,
          });

          const focusedId = existingCtx.context?.focusedEntityId;
          const shouldClearFocus = archivedObjectiveId && focusedId === archivedObjectiveId;

          if (shouldClearFocus) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "objectives",
              activeFlow: "objective_archived",
              focusedEntityType: undefined,
              focusedEntityId: undefined,
              context: archivedTitle ? { lastArchivedObjectiveTitle: archivedTitle } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, objectiveId: archivedObjectiveId }, "session context cleared focus after objectives.archive of focused objective");
          } else {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "objectives",
              activeFlow: "objective_archived",
              context: archivedTitle ? { lastArchivedObjectiveTitle: archivedTitle } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, objectiveId: archivedObjectiveId }, "session context updated for objectives.archive");
          }
        } else if (action === "assign-task" && actionResult.status === "executed") {
          const objectiveId = actionResult.evidence?.objectiveId as string | undefined;
          const objectiveTitle = actionResult.evidence?.objectiveTitle as string | undefined;
          const objectiveSlug = actionResult.evidence?.objectiveSlug as string | undefined;
          const taskId = actionResult.evidence?.taskId as string | undefined;
          const taskTitle = actionResult.evidence?.taskTitle as string | undefined;

          const ctxPayload: Record<string, unknown> = {};
          if (objectiveTitle) ctxPayload.lastObjectiveTitle = objectiveTitle;
          if (objectiveSlug) ctxPayload.lastObjectiveSlug = objectiveSlug;
          if (taskTitle) ctxPayload.lastAssignedTaskTitle = taskTitle;

          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "objectives",
            activeFlow: "task_objective_assigned",
            focusedEntityType: "task",
            focusedEntityId: taskId,
            context: ctxPayload,
          });
          ctx.logger.info({ bufferId: buffer.buffer_id, objectiveId, taskId }, `session context updated for objectives.assign-task`);
        }
      } else if (module === "routines") {
        const routineId = actionResult.evidence?.routineId as string | undefined;
        const name = actionResult.evidence?.name as string | undefined;
        const slug = actionResult.evidence?.slug as string | undefined;
        if (actionResult.status === "executed" && routineId) {
          const ctxPayload: Record<string, unknown> = {};
          if (name) ctxPayload.lastRoutineName = name;
          if (slug) ctxPayload.lastRoutineSlug = slug;
          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "routines",
            activeFlow: `routine_${action}`,
            focusedEntityType: action === "archive" ? undefined : "routine",
            focusedEntityId: action === "archive" ? undefined : routineId,
            context: ctxPayload,
          });
          ctx.logger.info({ bufferId: buffer.buffer_id, routineId }, `session context updated for routines.${action}`);
        } else if (action === "list" && actionResult.status === "executed") {
          const routines = actionResult.evidence?.routines as Array<{ id: string; name: string; slug: string }> | undefined;
          const count = actionResult.evidence?.count as number | undefined;
          if (routines && count === 1 && routines.length === 1) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "routines",
              activeFlow: "routine_listed",
              focusedEntityType: "routine",
              focusedEntityId: routines[0].id,
              context: { lastRoutineName: routines[0].name, lastRoutineSlug: routines[0].slug },
            });
          }
        }
      } else if (module === "workouts") {
        if (action === "start" && actionResult.status === "executed") {
          const sessionId = actionResult.evidence?.sessionId as string | undefined;
          const title = actionResult.evidence?.title as string | undefined;
          if (sessionId) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "workouts",
              activeFlow: "workout_active",
              focusedEntityType: "workout_session",
              focusedEntityId: sessionId,
              context: title ? { lastWorkoutTitle: title } : {},
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, sessionId }, "session context updated for workouts.start");
          }
        } else if (action === "log-set" && actionResult.status === "executed") {
          const sessionId = actionResult.evidence?.sessionId as string | undefined;
          const exerciseName = actionResult.evidence?.exerciseName as string | undefined;
          const setNumber = actionResult.evidence?.setNumber as number | undefined;
          if (sessionId) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "workouts",
              activeFlow: "workout_active",
              focusedEntityType: "workout_session",
              focusedEntityId: sessionId,
              context: { lastExerciseName: exerciseName, lastSetNumber: setNumber },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, sessionId }, "session context updated for workouts.log-set");
          }
        } else if ((action === "finish" || action === "cancel") && actionResult.status === "executed") {
          const sessionId = actionResult.evidence?.sessionId as string | undefined;
          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "workouts",
            activeFlow: action === "finish" ? "workout_finished" : "workout_canceled",
            focusedEntityType: undefined,
            focusedEntityId: undefined,
            context: sessionId ? { lastWorkoutSessionId: sessionId } : {},
          });
          ctx.logger.info({ bufferId: buffer.buffer_id, sessionId }, `session context cleared for workouts.${action}`);
        }
      } else if (module === "timers") {
        if (action === "start" && actionResult.status === "executed") {
          const timerId = actionResult.evidence?.timerId as string | undefined;
          const kind = actionResult.evidence?.kind as string | undefined;
          const dueAt = actionResult.evidence?.dueAt as string | undefined;
          if (timerId) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "timers",
              activeFlow: "timer_started",
              focusedEntityType: "timer",
              focusedEntityId: timerId,
              context: { timerKind: kind, timerDueAt: dueAt },
            });
            ctx.logger.info({ bufferId: buffer.buffer_id, timerId }, "session context updated for timers.start");
          }
        } else if (action === "cancel" && actionResult.status === "executed") {
          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "timers",
            activeFlow: "timer_canceled",
            focusedEntityType: undefined,
            focusedEntityId: undefined,
            context: {},
          });
          ctx.logger.info({ bufferId: buffer.buffer_id }, "session context cleared for timers.cancel");
        }
      } else if (module === "plans") {
        if ((action === "create" || action === "list") && actionResult.status === "executed") {
          const planId = actionResult.evidence?.planId as string | undefined;
          if (planId) {
            await ctx.sessionContextModule.upsert({
              ...base,
              activeModule: "plans",
              activeFlow: action === "create" ? "plan_created" : "plan_listed",
              focusedEntityType: "plan",
              focusedEntityId: planId,
              context: { lastPlanTitle: actionResult.evidence?.title, lastPlanSlug: actionResult.evidence?.slug },
            });
          }
        } else if ((action === "archive" || action === "complete-step") && actionResult.status === "executed") {
          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "plans",
            activeFlow: action === "archive" ? "plan_archived" : "plan_step_completed",
            context: { lastPlanTitle: actionResult.evidence?.title },
          });
        }
      } else if (module === "protocols") {
        const protocolId = actionResult.evidence?.protocolId as string | undefined;
        if ((action === "create" || action === "list" || action === "activate") && actionResult.status === "executed" && protocolId) {
          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "protocols",
            activeFlow: `protocol_${action}`,
            focusedEntityType: "protocol",
            focusedEntityId: protocolId,
            context: { lastProtocolName: actionResult.evidence?.name, lastProtocolSlug: actionResult.evidence?.slug },
          });
        } else if (action === "archive" && actionResult.status === "executed") {
          await ctx.sessionContextModule.upsert({
            ...base,
            activeModule: "protocols",
            activeFlow: "protocol_archived",
            focusedEntityType: undefined,
            focusedEntityId: undefined,
            context: { lastProtocolName: actionResult.evidence?.name },
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.logger.error({ error: message, bufferId: buffer.buffer_id }, "failed to update session context");
    }
  }

  async function processBuffer(buffer: ClaimedBuffer): Promise<void> {
    const rawMessages = buffer.messages.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.created_at,
    }));

    const normalized = ctx.normalizer.normalize(rawMessages);
    const messages = normalized.map((nm) => ({
      id: Number(nm.id),
      content: nm.content,
      createdAt: nm.createdAt,
    }));

    const sessionContext = await loadSessionContext(buffer);

    try {
      const coarse = await ctx.coarseClassifier.classify({
        schemaVersion: "coarse_classification_input.v1",
        traceId: buffer.trace_id,
        messages,
        sessionContext,
      });

      if (coarse.module === "unknown") {
        await fallbackResponse(buffer, messages);
        return;
      }

      const intent = await ctx.intentClassifier.classify({
        schemaVersion: "module_intent_input.v1",
        traceId: buffer.trace_id,
        module: coarse.module,
        messages,
        sessionContext,
      });

      if (intent.action === "none") {
        await fallbackResponse(buffer, messages);
        return;
      }

      const route = await ctx.router.route(intent);
      if (!route.executable) {
        await fallbackResponse(buffer, messages);
        return;
      }

      if (intent.confidence < 0.75 || !Array.isArray(intent.missingData) || intent.missingData.length > 0) {
        const response = await ctx.composer.compose({
          schemaVersion: "response_composition_input.v1",
          traceId: buffer.trace_id,
          messages,
          classification: { coarse, intent },
          actionResult: {
            schemaVersion: "action_execution_result.v1",
            traceId: buffer.trace_id,
            status: "failed",
            evidence: { reason: "confidence or missingData prevents execution" },
            stateChanges: [],
          },
        });
        const sent = await ctx.outbound.send(buffer.conversation_id, response.content);
        await ctx.store.complete(buffer.buffer_id, response.content, sent.id);
        ctx.logger.info({ bufferId: buffer.buffer_id, traceId: buffer.trace_id }, "buffer blocked by guards, composed response");
        return;
      }

      const execInput = {
        schemaVersion: "action_execution_input.v1" as const,
        traceId: buffer.trace_id,
        module: intent.module,
        action: intent.action,
        entities: {
          ...intent.entities,
          accountId: buffer.account_id,
          inboxId: buffer.inbox_id,
          conversationId: buffer.conversation_id,
        },
        requiresConfirmation: intent.requiresConfirmation,
        intentConfidence: intent.confidence,
        intentMissingData: intent.missingData,
      };

      const actionResult = await ctx.executor.execute(execInput);

      const response = await ctx.composer.compose({
        schemaVersion: "response_composition_input.v1",
        traceId: buffer.trace_id,
        messages,
        classification: { coarse, intent },
        actionResult,
      });

      const sent = await ctx.outbound.send(buffer.conversation_id, response.content);
      await ctx.store.complete(buffer.buffer_id, response.content, sent.id);

      await updateSessionContext(buffer, actionResult, intent.module, intent.action);

      ctx.logger.info({ bufferId: buffer.buffer_id, traceId: buffer.trace_id, outboundMessageId: sent.id }, "buffer completed via pipeline");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.store.fail(buffer.buffer_id, message);
      ctx.logger.error({ bufferId: buffer.buffer_id, traceId: buffer.trace_id, error: message }, "buffer failed");
    }
  }

  async function fallbackResponse(buffer: ClaimedBuffer, messages: Array<{ id: number; content: string; createdAt: string }>): Promise<void> {
    const response = await ctx.fallbackGenerator.generate(
      messages.map((m) => ({ id: m.id, content: m.content, created_at: m.createdAt })),
    );
    const sent = await ctx.outbound.send(buffer.conversation_id, response);
    await ctx.store.complete(buffer.buffer_id, response, sent.id);
    ctx.logger.info({ bufferId: buffer.buffer_id, traceId: buffer.trace_id, outboundMessageId: sent.id }, "buffer completed via DeepSeek fallback");
  }

  return { processDue };
}
