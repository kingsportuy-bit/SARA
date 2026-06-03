import { describe, expect, it } from "vitest";
import { createDailyLogStore } from "../src/infra/dailyLogStore.js";

function fakeSupabase() {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      if (fn === "sara_upsert_daily_log_morning") {
        if (params.p_wake_energy !== null && (Number(params.p_wake_energy) < 1 || Number(params.p_wake_energy) > 10)) {
          return { data: null, error: new Error("wake_energy must be between 1 and 10") };
        }
        if (params.p_sleep_hours !== null && Number(params.p_sleep_hours) < 0) {
          return { data: null, error: new Error("sleep_hours cannot be negative") };
        }
        return {
          data: {
            daily_log_id: "dl-morning-uuid",
            event_id: "event-morning-uuid",
            event_type: "daily_log_morning_updated",
            date: params.p_date,
            trace_id: params.p_trace_id,
            schema_version: "daily_log_morning_result.v1",
          },
          error: null,
        };
      }
      if (fn === "sara_upsert_daily_log_evening") {
        return {
          data: {
            daily_log_id: "dl-evening-uuid",
            event_id: "event-evening-uuid",
            event_type: "daily_log_evening_updated",
            date: params.p_date,
            trace_id: params.p_trace_id,
            schema_version: "daily_log_evening_result.v1",
          },
          error: null,
        };
      }
      return { data: null, error: new Error("unknown rpc") };
    },
    from: (table: string) => {
      if (table !== "sara_daily_log") throw new Error("unknown table");
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({
              data: {
                id: "dl-uuid-1",
                schema_version: "daily_log.v1",
                date: "2026-06-03",
                wake_energy: 7,
                sleep_hours: 6.5,
                morning_intention: "terminar propuestas",
                evening_review: "termine propuestas y camine",
                mood: null,
                notes: [],
                trace_id: "trace-1",
                created_at: "2026-06-03T00:00:00Z",
                updated_at: "2026-06-03T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      };
    },
  } as any;
}

describe("dailyLogStore upsertMorning", () => {
  it("calls sara_upsert_daily_log_morning with correct parameters", async () => {
    const sb = fakeSupabase();
    const store = createDailyLogStore(sb);
    const result = await store.upsertMorning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-1",
      date: "2026-06-03",
      wakeEnergy: 7,
      sleepHours: 6.5,
      morningIntention: "terminar propuestas",
      source: "chatwoot",
    });

    expect(result.status).toBe("updated");
    expect(result.dailyLogId).toBe("dl-morning-uuid");
    expect(result.eventId).toBe("event-morning-uuid");
    expect(result.evidence.eventType).toBe("daily_log_morning_updated");
  });

  it("returns failed on rpc error", async () => {
    const sb = fakeSupabase();
    const store = createDailyLogStore(sb);
    const result = await store.upsertMorning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-2",
      date: "2026-06-03",
      wakeEnergy: 0,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
  });
});

describe("dailyLogStore upsertEvening", () => {
  it("calls sara_upsert_daily_log_evening with correct parameters", async () => {
    const sb = fakeSupabase();
    const store = createDailyLogStore(sb);
    const result = await store.upsertEvening({
      schemaVersion: "daily_log_evening_input.v1",
      traceId: "trace-3",
      date: "2026-06-03",
      eveningReview: "termine propuestas",
      source: "chatwoot",
    });

    expect(result.status).toBe("updated");
    expect(result.dailyLogId).toBe("dl-evening-uuid");
    expect(result.eventId).toBe("event-evening-uuid");
    expect(result.evidence.eventType).toBe("daily_log_evening_updated");
  });
});

describe("dailyLogStore getSummary", () => {
  it("queries sara_daily_log for summary", async () => {
    const sb = fakeSupabase();
    const store = createDailyLogStore(sb);
    const result = await store.getSummary({
      schemaVersion: "daily_log_summary_input.v1",
      traceId: "trace-4",
      date: "2026-06-03",
    });

    expect(result.status).toBe("success");
    expect(result.dailyLog).toBeDefined();
    expect(result.dailyLog!.wakeEnergy).toBe(7);
    expect(result.dailyLog!.sleepHours).toBe(6.5);
    expect(result.dailyLog!.morningIntention).toBe("terminar propuestas");
    expect(result.dailyLog!.eveningReview).toBe("termine propuestas y camine");
  });
});
