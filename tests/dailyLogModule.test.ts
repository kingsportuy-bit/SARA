import { describe, expect, it } from "vitest";
import { createDailyLogModule } from "../src/modules/dailyLog/dailyLogModule.js";
import type {
  DailyLogMorningInput,
  DailyLogMorningResult,
  DailyLogEveningInput,
  DailyLogEveningResult,
  DailyLogSummaryInput,
  DailyLogSummaryResult,
  DailyLogRepository,
} from "../src/contracts/dailyLog.js";

function fakeRepo(): DailyLogRepository {
  return {
    async upsertMorning(input: DailyLogMorningInput): Promise<DailyLogMorningResult> {
      return {
        schemaVersion: "daily_log_morning_result.v1",
        traceId: input.traceId,
        status: "updated",
        dailyLogId: "dl-uuid-1",
        eventId: "event-uuid-1",
        date: input.date,
        evidence: {
          dailyLogId: "dl-uuid-1",
          eventId: "event-uuid-1",
          eventType: "daily_log_morning_updated",
        },
      };
    },
    async upsertEvening(input: DailyLogEveningInput): Promise<DailyLogEveningResult> {
      return {
        schemaVersion: "daily_log_evening_result.v1",
        traceId: input.traceId,
        status: "updated",
        dailyLogId: "dl-uuid-2",
        eventId: "event-uuid-2",
        date: input.date,
        evidence: {
          dailyLogId: "dl-uuid-2",
          eventId: "event-uuid-2",
          eventType: "daily_log_evening_updated",
        },
      };
    },
    async getSummary(input: DailyLogSummaryInput): Promise<DailyLogSummaryResult> {
      return {
        schemaVersion: "daily_log_summary_result.v1",
        traceId: input.traceId,
        status: "success",
        dailyLog: {
          id: "dl-uuid-1",
          schemaVersion: "daily_log.v1",
          date: input.date,
          wakeEnergy: 7,
          sleepHours: 6.5,
          morningIntention: "terminar propuestas",
          eveningReview: "termine propuestas y camine",
          notes: [],
          createdAt: "2026-06-03T00:00:00Z",
          updatedAt: "2026-06-03T00:00:00Z",
        },
      };
    },
  };
}

describe("dailyLogModule.morning", () => {
  it("creates morning with valid input", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.morning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-1",
      date: "2026-06-03",
      wakeEnergy: 7,
      sleepHours: 6.5,
      morningIntention: "terminar propuestas",
      source: "chatwoot",
    });

    expect(result.status).toBe("updated");
    expect(result.dailyLogId).toBe("dl-uuid-1");
    expect(result.eventId).toBe("event-uuid-1");
    expect(result.evidence.dailyLogId).toBe("dl-uuid-1");
    expect(result.evidence.eventId).toBe("event-uuid-1");
  });

  it("validates wakeEnergy range 1-10", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.morning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-2",
      date: "2026-06-03",
      wakeEnergy: 0,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("wakeEnergy must be between 1 and 10");
  });

  it("validates wakeEnergy max 10", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.morning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-3",
      date: "2026-06-03",
      wakeEnergy: 11,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("wakeEnergy must be between 1 and 10");
  });

  it("validates sleepHours not negative", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.morning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-4",
      date: "2026-06-03",
      sleepHours: -1,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("sleepHours cannot be negative");
  });

  it("fails without any updatable fields", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.morning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-5",
      date: "2026-06-03",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("no actualizable fields");
  });

  it("accepts zero sleep hours", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.morning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-6",
      date: "2026-06-03",
      sleepHours: 0,
      source: "chatwoot",
    });

    expect(result.status).toBe("updated");
  });

  it("accepts notes only", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.morning({
      schemaVersion: "daily_log_morning_input.v1",
      traceId: "trace-notes-morning",
      date: "2026-06-03",
      notes: ["arranque tranquilo"],
      source: "chatwoot",
    });

    expect(result.status).toBe("updated");
  });
});

describe("dailyLogModule.evening", () => {
  it("creates evening with valid input", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.evening({
      schemaVersion: "daily_log_evening_input.v1",
      traceId: "trace-7",
      date: "2026-06-03",
      eveningReview: "termine propuestas",
      source: "chatwoot",
    });

    expect(result.status).toBe("updated");
    expect(result.dailyLogId).toBe("dl-uuid-2");
    expect(result.eventId).toBe("event-uuid-2");
  });

  it("fails without any updatable fields", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.evening({
      schemaVersion: "daily_log_evening_input.v1",
      traceId: "trace-8",
      date: "2026-06-03",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("no actualizable fields");
  });

  it("accepts mood only", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.evening({
      schemaVersion: "daily_log_evening_input.v1",
      traceId: "trace-9",
      date: "2026-06-03",
      mood: "bueno",
      source: "chatwoot",
    });

    expect(result.status).toBe("updated");
  });

  it("accepts notes only", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.evening({
      schemaVersion: "daily_log_evening_input.v1",
      traceId: "trace-notes-evening",
      date: "2026-06-03",
      notes: ["dia liviano"],
      source: "chatwoot",
    });

    expect(result.status).toBe("updated");
  });
});

describe("dailyLogModule.summary", () => {
  it("retrieves summary read-only", async () => {
    const repo = fakeRepo();
    const mod = createDailyLogModule(repo);
    const result = await mod.summary({
      schemaVersion: "daily_log_summary_input.v1",
      traceId: "trace-10",
      date: "2026-06-03",
    });

    expect(result.status).toBe("success");
    expect(result.dailyLog).toBeDefined();
    expect(result.dailyLog!.wakeEnergy).toBe(7);
    expect(result.dailyLog!.sleepHours).toBe(6.5);
  });
});
