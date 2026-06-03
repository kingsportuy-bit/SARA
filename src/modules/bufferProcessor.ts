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
        entities: intent.entities,
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
