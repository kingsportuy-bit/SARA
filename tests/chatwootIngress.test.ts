import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config.js";
import type { IngestMessage, MessageStore } from "../src/contracts.js";
import { ingestChatwootWebhook } from "../src/modules/chatwootIngress.js";

const config = {
  bufferSeconds: 20,
  chatwoot: { accountId: 6, inboxId: 44, conversationId: 20 },
} as AppConfig;

function store() {
  const ingested: IngestMessage[] = [];
  const adapter: MessageStore = {
    async ingest(message) {
      ingested.push(message);
      return { accepted: true, duplicate: false, bufferId: "buffer-1" };
    },
    async claimDue() { return []; },
    async complete() {},
    async fail() {},
  };
  return { adapter, ingested };
}

describe("ingestChatwootWebhook", () => {
  it("persists authorized incoming messages with a 20 second buffer", async () => {
    const memory = store();
    const result = await ingestChatwootWebhook({
      event: "message_created",
      id: 123,
      content: "hola",
      message_type: "incoming",
      account: { id: 6 },
      inbox: { id: 44 },
      conversation: { id: 20 },
    }, { deliveryId: "delivery-1" }, config, memory.adapter);
    expect(result.accepted).toBe(true);
    expect(memory.ingested[0]).toMatchObject({ messageId: 123, content: "hola", processAfterSeconds: 20 });
  });

  it("discards messages from another conversation", async () => {
    const memory = store();
    const result = await ingestChatwootWebhook({
      event: "message_created",
      id: 123,
      content: "hola",
      message_type: "incoming",
      account: { id: 6 },
      inbox: { id: 44 },
      conversation: { id: 999 },
    }, {}, config, memory.adapter);
    expect(result.discarded).toBe("outside_authorized_scope");
    expect(memory.ingested).toHaveLength(0);
  });

  it("discards outgoing messages to prevent response loops", async () => {
    const memory = store();
    const result = await ingestChatwootWebhook({
      event: "message_created",
      id: 124,
      content: "respuesta",
      message_type: "outgoing",
      account: { id: 6 },
      inbox: { id: 44 },
      conversation: { id: 20 },
    }, {}, config, memory.adapter);
    expect(result.discarded).toBe("outside_authorized_scope");
    expect(memory.ingested).toHaveLength(0);
  });
});
