import type { ClaimedBuffer, MessageStore, OutboundChatwoot, ResponseGenerator } from "../contracts.js";
import type { CoarseClassifier } from "./coarseClassifier.js";
import type { ModuleIntentClassifier } from "./moduleIntentClassifier.js";
import type { ModuleRouter } from "./moduleRouter.js";
import type { ActionExecutor } from "./actionExecutor.js";
import type { ResponseComposer } from "./responseComposer.js";
import type { MessageNormalizer } from "./messageNormalizer.js";

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

    try {
      const coarse = await ctx.coarseClassifier.classify({
        schemaVersion: "coarse_classification_input.v1",
        traceId: buffer.trace_id,
        messages,
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
