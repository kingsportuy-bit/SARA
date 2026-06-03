import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyLogMorningInput,
  DailyLogMorningResult,
  DailyLogEveningInput,
  DailyLogEveningResult,
  DailyLogSummaryInput,
  DailyLogSummaryResult,
  DailyLogRepository,
  DailyLogRecord,
} from "../contracts/dailyLog.js";

interface MorningRpcResult {
  daily_log_id: string;
  event_id: string;
  event_type: string;
  date: string;
  trace_id: string;
  schema_version: string;
}

interface EveningRpcResult {
  daily_log_id: string;
  event_id: string;
  event_type: string;
  date: string;
  trace_id: string;
  schema_version: string;
}

function toDailyLogRecord(row: Record<string, unknown>): DailyLogRecord {
  return {
    id: String(row.id),
    schemaVersion: String(row.schema_version ?? ""),
    date: String(row.date ?? ""),
    wakeEnergy: row.wake_energy != null ? Number(row.wake_energy) : undefined,
    sleepHours: row.sleep_hours != null ? Number(row.sleep_hours) : undefined,
    morningIntention: row.morning_intention != null ? String(row.morning_intention) : undefined,
    eveningReview: row.evening_review != null ? String(row.evening_review) : undefined,
    mood: row.mood != null ? String(row.mood) : undefined,
    notes: Array.isArray(row.notes) ? (row.notes as string[]) : [],
    traceId: row.trace_id != null ? String(row.trace_id) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function createDailyLogStore(supabase: SupabaseClient): DailyLogRepository {
  return {
    async upsertMorning(input: DailyLogMorningInput): Promise<DailyLogMorningResult> {
      const { data, error } = await supabase.rpc("sara_upsert_daily_log_morning", {
        p_trace_id: input.traceId,
        p_date: input.date,
        p_wake_energy: input.wakeEnergy ?? null,
        p_sleep_hours: input.sleepHours ?? null,
        p_morning_intention: input.morningIntention ?? null,
        p_mood: input.mood ?? null,
        p_notes: input.notes ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "daily_log_morning_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as MorningRpcResult;

      return {
        schemaVersion: "daily_log_morning_result.v1",
        traceId: input.traceId,
        status: "updated",
        dailyLogId: result.daily_log_id,
        eventId: result.event_id,
        date: result.date,
        evidence: {
          dailyLogId: result.daily_log_id,
          eventId: result.event_id,
          eventType: result.event_type as "daily_log_created" | "daily_log_morning_updated",
        },
      };
    },

    async upsertEvening(input: DailyLogEveningInput): Promise<DailyLogEveningResult> {
      const { data, error } = await supabase.rpc("sara_upsert_daily_log_evening", {
        p_trace_id: input.traceId,
        p_date: input.date,
        p_evening_review: input.eveningReview ?? null,
        p_mood: input.mood ?? null,
        p_notes: input.notes ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "daily_log_evening_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as EveningRpcResult;

      return {
        schemaVersion: "daily_log_evening_result.v1",
        traceId: input.traceId,
        status: "updated",
        dailyLogId: result.daily_log_id,
        eventId: result.event_id,
        date: result.date,
        evidence: {
          dailyLogId: result.daily_log_id,
          eventId: result.event_id,
          eventType: result.event_type as "daily_log_created" | "daily_log_evening_updated",
        },
      };
    },

    async getSummary(input: DailyLogSummaryInput): Promise<DailyLogSummaryResult> {
      try {
        const { data, error } = await supabase
          .from("sara_daily_log")
          .select("*")
          .eq("date", input.date)
          .maybeSingle();

        if (error) {
          return {
            schemaVersion: "daily_log_summary_result.v1",
            traceId: input.traceId,
            status: "failed",
            error: error.message,
          };
        }

        if (!data) {
          return {
            schemaVersion: "daily_log_summary_result.v1",
            traceId: input.traceId,
            status: "success",
            dailyLog: undefined,
          };
        }

        const record = toDailyLogRecord(data as Record<string, unknown>);
        return {
          schemaVersion: "daily_log_summary_result.v1",
          traceId: input.traceId,
          status: "success",
          dailyLog: record,
        };
      } catch (err) {
        return {
          schemaVersion: "daily_log_summary_result.v1",
          traceId: input.traceId,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
