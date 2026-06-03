export interface SessionContextRecord {
  id: string;
  schemaVersion: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  activeModule?: string;
  activeFlow?: string;
  focusedEntityType?: string;
  focusedEntityId?: string;
  awaitingConfirmation: boolean;
  confirmationPayload?: Record<string, unknown>;
  context: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetSessionContextInput {
  accountId: number;
  inboxId: number;
  conversationId: number;
}

export interface GetSessionContextResult {
  context: SessionContextRecord | null;
}

export interface UpsertSessionContextInput {
  traceId: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  activeModule?: string;
  activeFlow?: string;
  focusedEntityType?: string;
  focusedEntityId?: string;
  awaitingConfirmation?: boolean;
  confirmationPayload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  ttlMinutes?: number;
}

export interface UpsertSessionContextResult {
  context: SessionContextRecord;
  isNew: boolean;
}

export interface ClearSessionContextInput {
  traceId: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
}

export interface ClearSessionContextResult {
  cleared: boolean;
  reason?: string;
}

export interface SessionContextRepository {
  get(input: GetSessionContextInput): Promise<GetSessionContextResult>;
  upsert(input: UpsertSessionContextInput): Promise<UpsertSessionContextResult>;
  clear(input: ClearSessionContextInput): Promise<ClearSessionContextResult>;
}
