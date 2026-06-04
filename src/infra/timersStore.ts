import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StartTimerInput,
  StartTimerResult,
  CancelTimerInput,
  CancelTimerResult,
  ClaimDueTimersInput,
  ClaimDueTimersResult,
  MarkTimerFiredInput,
  MarkTimerFiredResult,
  TimersRepository,
  TimerRecord,
  TimerKind,
  TimerStatus,
} from "../contracts/timers.js";

interface StartTimerRpcResult {
  timer_id: string;
  event_id: string;
  kind: string;
  title: string;
  duration_seconds: number;
  due_at: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface CancelTimerRpcResult {
  timer_id: string;
  event_id: string;
  kind: string;
  title: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ClaimDueTimerRow {
  timer_id: string;
  kind: string;
  title: string;
  duration_seconds: number;
  due_at: string;
  related_entity_type?: string;
  related_entity_id?: string;
  trace_id?: string;
  created_at: string;
}

interface MarkTimerFiredRpcResult {
  timer_id: string;
  event_id: string;
  kind: string;
  title: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

function toTimerRecord(
  row: ClaimDueTimerRow,
  accountId: number,
  inboxId: number,
  conversationId: number,
): TimerRecord {
  return {
    id: String(row.timer_id),
    kind: row.kind as TimerKind,
    status: "pending",
    title: String(row.title),
    durationSeconds: Number(row.duration_seconds),
    dueAt: String(row.due_at),
    relatedEntityType: row.related_entity_type ?? undefined,
    relatedEntityId: row.related_entity_id ?? undefined,
    accountId,
    inboxId,
    conversationId,
    createdAt: String(row.created_at),
    updatedAt: String(row.created_at),
  };
}

export function createTimersStore(supabase: SupabaseClient): TimersRepository {
  return {
    async startTimer(input: StartTimerInput): Promise<StartTimerResult> {
      const { data, error } = await supabase.rpc("sara_start_timer", {
        p_trace_id: input.traceId,
        p_kind: input.kind,
        p_title: input.title,
        p_duration_seconds: input.durationSeconds,
        p_related_entity_type: input.relatedEntityType ?? null,
        p_related_entity_id: input.relatedEntityId ?? null,
        p_account_id: input.accountId,
        p_inbox_id: input.inboxId,
        p_conversation_id: input.conversationId,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "timers_start_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as StartTimerRpcResult;

      if (result.error) {
        return {
          schemaVersion: "timers_start_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "timers_start_result.v1",
        traceId: input.traceId,
        status: "started",
        timerId: result.timer_id,
        eventId: result.event_id,
        kind: result.kind,
        title: result.title,
        durationSeconds: result.duration_seconds,
        dueAt: result.due_at,
        evidence: {
          timerId: result.timer_id,
          eventId: result.event_id,
          eventType: "timer_started",
        },
      };
    },

    async cancelTimer(input: CancelTimerInput): Promise<CancelTimerResult> {
      const { data, error } = await supabase.rpc("sara_cancel_timer", {
        p_trace_id: input.traceId,
        p_timer_id: input.timerId,
        p_account_id: input.accountId,
        p_inbox_id: input.inboxId,
        p_conversation_id: input.conversationId,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "timers_cancel_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CancelTimerRpcResult;

      if (result.error) {
        return {
          schemaVersion: "timers_cancel_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "timers_cancel_result.v1",
        traceId: input.traceId,
        status: "canceled",
        timerId: result.timer_id,
        eventId: result.event_id,
        kind: result.kind,
        title: result.title,
        evidence: {
          timerId: result.timer_id,
          eventId: result.event_id,
          eventType: "timer_canceled",
        },
      };
    },

    async claimDueTimers(input: ClaimDueTimersInput): Promise<ClaimDueTimersResult> {
      const { data, error } = await supabase.rpc("sara_claim_due_timers", {
        p_limit: input.limit,
        p_account_id: input.accountId,
        p_inbox_id: input.inboxId,
        p_conversation_id: input.conversationId,
      });

      if (error) {
        return {
          schemaVersion: "timers_claim_due_result.v1",
          traceId: input.traceId,
          status: "failed",
          timers: [],
          count: 0,
          error: error.message,
        };
      }

      const rows = (data as ClaimDueTimerRow[]) ?? [];
      const timers = rows.map((r) => toTimerRecord(r, input.accountId, input.inboxId, input.conversationId));

      return {
        schemaVersion: "timers_claim_due_result.v1",
        traceId: input.traceId,
        status: "success",
        timers,
        count: timers.length,
      };
    },

    async markTimerFired(input: MarkTimerFiredInput): Promise<MarkTimerFiredResult> {
      const { data, error } = await supabase.rpc("sara_mark_timer_fired", {
        p_trace_id: input.traceId,
        p_timer_id: input.timerId,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "timers_mark_fired_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as MarkTimerFiredRpcResult;

      if (result.error) {
        return {
          schemaVersion: "timers_mark_fired_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "timers_mark_fired_result.v1",
        traceId: input.traceId,
        status: "fired",
        timerId: result.timer_id,
        eventId: result.event_id,
        kind: result.kind,
        title: result.title,
        evidence: {
          timerId: result.timer_id,
          eventId: result.event_id,
          eventType: "timer_fired",
        },
      };
    },
  };
}
