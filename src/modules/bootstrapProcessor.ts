import type { MessageStore, OutboundChatwoot, ResponseGenerator } from "../contracts.js";

export function createBootstrapProcessor(
  store: MessageStore,
  generator: ResponseGenerator,
  outbound: OutboundChatwoot,
  logger: { info: (data: object, message: string) => void; error: (data: object, message: string) => void },
) {
  let running = false;

  async function processDue(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const buffers = await store.claimDue(10);
      for (const buffer of buffers) {
        try {
          const response = await generator.generate(buffer.messages);
          const sent = await outbound.send(buffer.conversation_id, response);
          await store.complete(buffer.buffer_id, response, sent.id);
          logger.info({ bufferId: buffer.buffer_id, traceId: buffer.trace_id, outboundMessageId: sent.id }, "buffer completed");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await store.fail(buffer.buffer_id, message);
          logger.error({ bufferId: buffer.buffer_id, traceId: buffer.trace_id, error: message }, "buffer failed");
        }
      }
    } finally {
      running = false;
    }
  }

  return { processDue };
}
