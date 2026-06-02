import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import type { ChatwootWebhookPayload, IngestResult, MessageStore } from "../contracts.js";

export interface IngressHeaders {
  deliveryId?: string;
}

export interface IngressResponse extends IngestResult {
  discarded?: string;
  traceId: string;
}

function incoming(messageType: ChatwootWebhookPayload["message_type"]): boolean {
  return messageType === "incoming" || messageType === 0;
}

export async function ingestChatwootWebhook(
  payload: ChatwootWebhookPayload,
  headers: IngressHeaders,
  config: AppConfig,
  store: MessageStore,
): Promise<IngressResponse> {
  const traceId = randomUUID();
  const scoped =
    payload.event === "message_created" &&
    payload.account?.id === config.chatwoot.accountId &&
    payload.inbox?.id === config.chatwoot.inboxId &&
    payload.conversation?.id === config.chatwoot.conversationId &&
    incoming(payload.message_type);

  if (!scoped) {
    return { accepted: false, duplicate: false, discarded: "outside_authorized_scope", traceId };
  }
  if (!payload.id || !payload.content?.trim()) {
    return { accepted: false, duplicate: false, discarded: "empty_or_invalid_message", traceId };
  }
  const accountId = payload.account!.id!;
  const inboxId = payload.inbox!.id!;
  const conversationId = payload.conversation!.id!;

  const result = await store.ingest({
    deliveryId: headers.deliveryId || `message:${payload.id}`,
    traceId,
    messageId: payload.id,
    accountId,
    inboxId,
    conversationId,
    content: payload.content.trim(),
    senderId: payload.sender?.id,
    senderType: payload.sender?.type,
    payload,
    processAfterSeconds: config.bufferSeconds,
  });
  return { ...result, traceId };
}
