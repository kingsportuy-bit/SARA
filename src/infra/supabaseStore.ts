import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MessageStore, IngestMessage, IngestResult, ClaimedBuffer } from "../contracts.js";

export function createSupabaseClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createSupabaseStore(supabaseOrUrl: SupabaseClient | string, serviceRoleKey?: string): MessageStore {
  const supabase = typeof supabaseOrUrl === "string"
    ? createSupabaseClient(supabaseOrUrl, serviceRoleKey!)
    : supabaseOrUrl;

  return {
    async ingest(message: IngestMessage): Promise<IngestResult> {
      const { data, error } = await supabase.rpc("sara_ingest_chatwoot_message", {
        p_delivery_id: message.deliveryId,
        p_trace_id: message.traceId,
        p_message_id: message.messageId,
        p_account_id: message.accountId,
        p_inbox_id: message.inboxId,
        p_conversation_id: message.conversationId,
        p_content: message.content,
        p_sender_id: message.senderId ?? null,
        p_sender_type: message.senderType ?? null,
        p_payload: message.payload,
        p_buffer_seconds: message.processAfterSeconds,
      });
      if (error) throw new Error(`sara_ingest_chatwoot_message failed: ${error.message}`);
      return data as IngestResult;
    },
    async claimDue(limit: number): Promise<ClaimedBuffer[]> {
      const { data, error } = await supabase.rpc("sara_claim_due_message_buffers", { p_limit: limit });
      if (error) throw new Error(`sara_claim_due_message_buffers failed: ${error.message}`);
      return (data || []) as ClaimedBuffer[];
    },
    async complete(bufferId: string, response: string, outboundMessageId: number): Promise<void> {
      const { error } = await supabase.rpc("sara_complete_message_buffer", {
        p_buffer_id: bufferId,
        p_response: response,
        p_outbound_message_id: outboundMessageId,
      });
      if (error) throw new Error(`sara_complete_message_buffer failed: ${error.message}`);
    },
    async fail(bufferId: string, errorMessage: string): Promise<void> {
      const { error } = await supabase.rpc("sara_fail_message_buffer", {
        p_buffer_id: bufferId,
        p_error: errorMessage.slice(0, 2000),
      });
      if (error) throw new Error(`sara_fail_message_buffer failed: ${error.message}`);
    },
  };
}
