import { describe, expect, it } from "vitest";
import { createTimersModule } from "../src/modules/timers/timersModule.js";
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
} from "../src/contracts/timers.js";

function fakeRepo(): TimersRepository {
  return {
    async startTimer(input: StartTimerInput): Promise<StartTimerResult> {
      return {
        schemaVersion: "timers_start_result.v1",
        traceId: input.traceId,
        status: "started",
        timerId: "timer-uuid-1",
        eventId: "event-uuid-1",
        kind: input.kind,
        title: input.title,
        durationSeconds: input.durationSeconds,
        dueAt: new Date(Date.now() + input.durationSeconds * 1000).toISOString(),
        evidence: {
          timerId: "timer-uuid-1",
          eventId: "event-uuid-1",
          eventType: "timer_started",
        },
      };
    },
    async cancelTimer(input: CancelTimerInput): Promise<CancelTimerResult> {
      return {
        schemaVersion: "timers_cancel_result.v1",
        traceId: input.traceId,
        status: "canceled",
        timerId: input.timerId,
        eventId: "event-uuid-1",
        kind: "workout_rest",
        title: "Descanso 90s",
        evidence: {
          timerId: input.timerId,
          eventId: "event-uuid-1",
          eventType: "timer_canceled",
        },
      };
    },
    async claimDueTimers(input: ClaimDueTimersInput): Promise<ClaimDueTimersResult> {
      return {
        schemaVersion: "timers_claim_due_result.v1",
        traceId: input.traceId,
        status: "success",
        timers: [
          {
            id: "timer-1",
            kind: "workout_rest",
            status: "pending",
            title: "Descanso 90s",
            durationSeconds: 90,
            dueAt: new Date().toISOString(),
            accountId: 7,
            inboxId: 45,
            conversationId: 85,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        count: 1,
      };
    },
    async markTimerFired(input: MarkTimerFiredInput): Promise<MarkTimerFiredResult> {
      return {
        schemaVersion: "timers_mark_fired_result.v1",
        traceId: input.traceId,
        status: "fired",
        timerId: input.timerId,
        eventId: "event-uuid-1",
        kind: "workout_rest",
        title: "Descanso 90s",
        evidence: {
          timerId: input.timerId,
          eventId: "event-uuid-1",
          eventType: "timer_fired",
        },
      };
    },
  };
}

describe("timersModule - start", () => {
  it("starts a timer with valid input", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "workout_rest",
      title: "Descanso 90s",
      durationSeconds: 90,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("started");
    expect(result.timerId).toBe("timer-uuid-1");
    expect(result.evidence.eventType).toBe("timer_started");
    expect(result.durationSeconds).toBe(90);
  });

  it("rejects empty title", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "generic",
      title: "",
      durationSeconds: 60,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title");
  });

  it("rejects zero duration", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "generic",
      title: "Timer",
      durationSeconds: 0,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("positive");
  });

  it("rejects negative duration", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "generic",
      title: "Timer",
      durationSeconds: -5,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("positive");
  });

  it("rejects duration exceeding 30 minutes MVP max", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "generic",
      title: "Timer",
      durationSeconds: 1801,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("30 minutes");
  });

  it("accepts exactly 1800 seconds (30 min max)", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "generic",
      title: "Timer 30m",
      durationSeconds: 1800,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("started");
  });

  it("rejects invalid kind", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "timers_start_input.v1",
      traceId: "trace-1",
      kind: "invalid_kind" as "generic",
      title: "Timer",
      durationSeconds: 60,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("kind");
  });
});

describe("timersModule - cancel", () => {
  it("cancels a timer with valid timerId", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.cancel({
      schemaVersion: "timers_cancel_input.v1",
      traceId: "trace-1",
      timerId: "timer-uuid-1",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("canceled");
    expect(result.timerId).toBe("timer-uuid-1");
    expect(result.evidence.eventType).toBe("timer_canceled");
  });

  it("rejects cancel without timerId", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.cancel({
      schemaVersion: "timers_cancel_input.v1",
      traceId: "trace-1",
      timerId: "",
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("timerId");
  });
});

describe("timersModule - claimDue", () => {
  it("claims due timers successfully", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.claimDue({
      schemaVersion: "timers_claim_due_input.v1",
      traceId: "trace-1",
      limit: 10,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(1);
    expect(result.timers[0].id).toBe("timer-1");
  });

  it("rejects limit less than 1", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.claimDue({
      schemaVersion: "timers_claim_due_input.v1",
      traceId: "trace-1",
      limit: 0,
      accountId: 7,
      inboxId: 45,
      conversationId: 85,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("limit");
  });
});

describe("timersModule - markFired", () => {
  it("marks timer as fired successfully", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.markFired({
      schemaVersion: "timers_mark_fired_input.v1",
      traceId: "trace-1",
      timerId: "timer-uuid-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("fired");
    expect(result.timerId).toBe("timer-uuid-1");
    expect(result.evidence.eventType).toBe("timer_fired");
  });

  it("rejects markFired without timerId", async () => {
    const mod = createTimersModule(fakeRepo());
    const result = await mod.markFired({
      schemaVersion: "timers_mark_fired_input.v1",
      traceId: "trace-1",
      timerId: "",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("timerId");
  });
});
