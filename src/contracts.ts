export interface ChatwootWebhookPayload {
  event?: string;
  id?: number;
  content?: string | null;
  message_type?: string | number;
  created_at?: string | number;
  sender?: { id?: number; type?: string; name?: string };
  account?: { id?: number };
  inbox?: { id?: number };
  conversation?: { id?: number; inbox_id?: number; display_id?: number };
}

export interface IngestMessage {
  deliveryId: string;
  traceId: string;
  messageId: number;
  accountId: number;
  inboxId: number;
  conversationId: number;
  content: string;
  senderId?: number;
  senderType?: string;
  payload: ChatwootWebhookPayload;
  processAfterSeconds: number;
}

export interface IngestResult {
  accepted: boolean;
  duplicate: boolean;
  bufferId?: string;
}

export interface ClaimedBuffer {
  buffer_id: string;
  trace_id: string;
  account_id: number;
  inbox_id: number;
  conversation_id: number;
  messages: Array<{ id: number; content: string; created_at: string }>;
}

export interface MessageStore {
  ingest(message: IngestMessage): Promise<IngestResult>;
  claimDue(limit: number): Promise<ClaimedBuffer[]>;
  complete(bufferId: string, response: string, outboundMessageId: number): Promise<void>;
  fail(bufferId: string, error: string): Promise<void>;
}

export interface ResponseGenerator {
  generate(messages: ClaimedBuffer["messages"]): Promise<string>;
}

export interface OutboundChatwoot {
  send(conversationId: number, content: string): Promise<{ id: number }>;
}
