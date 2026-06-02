import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import type { MessageStore } from "./contracts.js";
import { ingestChatwootWebhook } from "./modules/chatwootIngress.js";
import { verifyChatwootSignature } from "./modules/signature.js";

export function buildApp(config: AppConfig, store: MessageStore) {
  const app = Fastify({ logger: true });

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    try {
      const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
      (request as typeof request & { rawBody: Buffer }).rawBody = rawBody;
      done(null, JSON.parse(rawBody.toString("utf8")));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "sara" }));

  app.post("/api/v1/webhooks/chatwoot", async (request, reply) => {
    const rawBody = (request as typeof request & { rawBody: Buffer }).rawBody;
    if (config.chatwoot.verifySignature) {
      const valid = verifyChatwootSignature(
        rawBody,
        request.headers["x-chatwoot-timestamp"] as string | undefined,
        request.headers["x-chatwoot-signature"] as string | undefined,
        config.chatwoot.webhookSecret!,
      );
      if (!valid) return reply.code(401).send({ accepted: false, error: "invalid_signature" });
    }

    const result = await ingestChatwootWebhook(
      request.body as Parameters<typeof ingestChatwootWebhook>[0],
      { deliveryId: request.headers["x-chatwoot-delivery"] as string | undefined },
      config,
      store,
    );
    return reply.code(202).send(result);
  });

  return app;
}
