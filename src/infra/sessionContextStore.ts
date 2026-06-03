import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SessionContextRepository,
  GetSessionContextInput,
  GetSessionContextResult,
  UpsertSessionContextInput,
  UpsertSessionContextResult,
  ClearSessionContextInput,
  ClearSessionContextResult,
  SessionContextRecord,
} from "../contracts/sessionContext.js";

interface GetRpcResult {
  id: string;
  schemaVersion: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  activeModule: string | null;
  activeFlow: string | null;
  focusedEntityType: string | null;
  focusedEntityId: string | null;
  awaitingConfirmation: boolean;
  confirmationPayload: Record<string, unknown> | null;
  context: Record<string, unknown>;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UpsertRpcResult {
  id: string;
  schemaVersion: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  activeModule: string | null;
  activeFlow: string | null;
  focusedEntityType: string | null;
  focusedEntityId: string | null;
  awaitingConfirmation: boolean;
  confirmationPayload: Record<string, unknown> | null;
  context: Record<string, unknown>;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  eventId: string;
  isNew: boolean;
}

interface ClearRpcResult {
  cleared: boolean;
  reason?: string;
}

function toRecord(raw: GetRpcResult): SessionContextRecord {
  return {
    id: String(raw.id),
    schemaVersion: String(raw.schemaVersion),
    accountId: Number(raw.accountId),
    inboxId: Number(raw.inboxId),
    conversationId: Number(raw.conversationId),
    activeModule: raw.activeModule ?? undefined,
    activeFlow: raw.activeFlow ?? undefined,
    focusedEntityType: raw.focusedEntityType ?? undefined,
    focusedEntityId: raw.focusedEntityId ?? undefined,
    awaitingConfirmation: Boolean(raw.awaitingConfirmation),
    confirmationPayload: raw.confirmationPayload ?? undefined,
    context: raw.context ?? {},
    expiresAt: raw.expiresAt ?? undefined,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  };
}

export function createSessionContextStore(supabase: SupabaseClient): SessionContextRepository {
  return {
    async get(input: GetSessionContextInput): Promise<GetSessionContextResult> {
      const { data, error } = await supabase.rpc("sara_get_session_context", {
        p_account_id: input.accountId,
        p_inbox_id: input.inboxId,
        p_conversation_id: input.conversationId,
      });

      if (error) {
        return { context: null };
      }

      if (!data) {
        return { context: null };
      }

      return { context: toRecord(data as GetRpcResult) };
    },

    async upsert(input: UpsertSessionContextInput): Promise<UpsertSessionContextResult> {
      const { data, error } = await supabase.rpc("sara_upsert_session_context", {
        p_trace_id: input.traceId,
        p_account_id: input.accountId,
        p_inbox_id: input.inboxId,
        p_conversation_id: input.conversationId,
        p_active_module: input.activeModule ?? null,
        p_active_flow: input.activeFlow ?? null,
        p_focused_entity_type: input.focusedEntityType ?? null,
        p_focused_entity_id: input.focusedEntityId ?? null,
        p_awaiting_confirmation: input.awaitingConfirmation ?? false,
        p_confirmation_payload: input.confirmationPayload ?? null,
        p_context: input.context ?? {},
        p_ttl_minutes: input.ttlMinutes ?? 30,
      });

      if (error) {
        throw new Error(`sara_upsert_session_context failed: ${error.message}`);
      }

      const result = data as UpsertRpcResult;
      return {
        context: toRecord(result),
        isNew: result.isNew,
      };
    },

    async clear(input: ClearSessionContextInput): Promise<ClearSessionContextResult> {
      const { data, error } = await supabase.rpc("sara_clear_session_context", {
        p_trace_id: input.traceId,
        p_account_id: input.accountId,
        p_inbox_id: input.inboxId,
        p_conversation_id: input.conversationId,
      });

      if (error) {
        throw new Error(`sara_clear_session_context failed: ${error.message}`);
      }

      const result = data as ClearRpcResult;
      return {
        cleared: result.cleared,
        reason: result.reason,
      };
    },
  };
}
