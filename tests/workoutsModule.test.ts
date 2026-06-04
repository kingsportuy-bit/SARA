import { describe, expect, it } from "vitest";
import { createWorkoutsModule } from "../src/modules/workouts/workoutsModule.js";
import type {
  StartWorkoutSessionInput,
  StartWorkoutSessionResult,
  LogWorkoutSetInput,
  LogWorkoutSetResult,
  FinishWorkoutSessionInput,
  FinishWorkoutSessionResult,
  CancelWorkoutSessionInput,
  CancelWorkoutSessionResult,
  ListWorkoutSessionsInput,
  ListWorkoutSessionsResult,
  WorkoutsRepository,
} from "../src/contracts/workouts.js";

function fakeRepo(): WorkoutsRepository {
  return {
    async startSession(input: StartWorkoutSessionInput): Promise<StartWorkoutSessionResult> {
      return {
        schemaVersion: "workouts_start_result.v1",
        traceId: input.traceId,
        status: "started",
        sessionId: "session-uuid-1",
        eventId: "event-uuid-1",
        title: input.title,
        evidence: {
          sessionId: "session-uuid-1",
          eventId: "event-uuid-1",
          eventType: "workout_session_started",
        },
      };
    },
    async logSet(input: LogWorkoutSetInput): Promise<LogWorkoutSetResult> {
      return {
        schemaVersion: "workouts_set_result.v1",
        traceId: input.traceId,
        status: "logged",
        setId: "set-uuid-1",
        eventId: "event-uuid-1",
        sessionId: input.sessionId,
        exerciseName: input.exerciseName,
        setNumber: input.setNumber,
        evidence: {
          setId: "set-uuid-1",
          eventId: "event-uuid-1",
          eventType: "workout_set_logged",
        },
      };
    },
    async finishSession(input: FinishWorkoutSessionInput): Promise<FinishWorkoutSessionResult> {
      return {
        schemaVersion: "workouts_finish_result.v1",
        traceId: input.traceId,
        status: "finished",
        sessionId: "session-uuid-1",
        eventId: "event-uuid-1",
        title: "piernas",
        setCount: 5,
        evidence: {
          sessionId: "session-uuid-1",
          eventId: "event-uuid-1",
          eventType: "workout_session_finished",
        },
      };
    },
    async cancelSession(input: CancelWorkoutSessionInput): Promise<CancelWorkoutSessionResult> {
      return {
        schemaVersion: "workouts_cancel_result.v1",
        traceId: input.traceId,
        status: "canceled",
        sessionId: "session-uuid-1",
        eventId: "event-uuid-1",
        title: "piernas",
        evidence: {
          sessionId: "session-uuid-1",
          eventId: "event-uuid-1",
          eventType: "workout_session_canceled",
        },
      };
    },
    async listSessions(input: ListWorkoutSessionsInput): Promise<ListWorkoutSessionsResult> {
      return {
        schemaVersion: "workouts_list_result.v1",
        traceId: input.traceId,
        status: "success",
        sessions: [
          {
            id: "s1",
            schemaVersion: "workouts_session.v1",
            title: "piernas",
            status: "finished",
            startedAt: "2026-06-01T10:00:00Z",
            finishedAt: "2026-06-01T11:00:00Z",
            createdAt: "2026-06-01T10:00:00Z",
            updatedAt: "2026-06-01T11:00:00Z",
            setCount: 5,
          },
        ],
        count: 1,
      };
    },
  };
}

describe("workoutsModule - start", () => {
  it("starts a workout session", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "workouts_start_input.v1",
      traceId: "trace-1",
      title: "piernas",
      source: "chatwoot",
    });

    expect(result.status).toBe("started");
    expect(result.sessionId).toBe("session-uuid-1");
    expect(result.evidence.eventType).toBe("workout_session_started");
  });

  it("starts without title", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.start({
      schemaVersion: "workouts_start_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("started");
  });
});

describe("workoutsModule - logSet", () => {
  it("logs a set with valid data", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "session-uuid-1",
      exerciseName: "sentadilla",
      setNumber: 1,
      actualReps: 8,
      weightKg: 60,
      source: "chatwoot",
    });

    expect(result.status).toBe("logged");
    expect(result.setId).toBe("set-uuid-1");
    expect(result.evidence.eventType).toBe("workout_set_logged");
  });

  it("rejects empty exercise name", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "session-uuid-1",
      exerciseName: "",
      setNumber: 1,
      actualReps: 8,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("exercise name");
  });

  it("rejects set number zero", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "session-uuid-1",
      exerciseName: "sentadilla",
      setNumber: 0,
      actualReps: 8,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("set number");
  });

  it("rejects missing effort (no reps and no duration)", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "session-uuid-1",
      exerciseName: "sentadilla",
      setNumber: 1,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("actualReps or durationSeconds");
  });

  it("rejects negative actual reps", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "session-uuid-1",
      exerciseName: "sentadilla",
      setNumber: 1,
      actualReps: -1,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("reps must be positive");
  });

  it("rejects negative duration", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "session-uuid-1",
      exerciseName: "plano",
      setNumber: 1,
      durationSeconds: -1,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("duration must be positive");
  });

  it("accepts duration as effort", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.logSet({
      schemaVersion: "workouts_set_input.v1",
      traceId: "trace-1",
      sessionId: "session-uuid-1",
      exerciseName: "plano",
      setNumber: 1,
      durationSeconds: 120,
      source: "chatwoot",
    });

    expect(result.status).toBe("logged");
  });
});

describe("workoutsModule - finish", () => {
  it("finishes a workout session", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.finish({
      schemaVersion: "workouts_finish_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("finished");
    expect(result.setCount).toBe(5);
    expect(result.evidence.eventType).toBe("workout_session_finished");
  });
});

describe("workoutsModule - cancel", () => {
  it("cancels a workout session", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.cancel({
      schemaVersion: "workouts_cancel_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("canceled");
    expect(result.evidence.eventType).toBe("workout_session_canceled");
  });
});

describe("workoutsModule - list", () => {
  it("lists workout sessions", async () => {
    const mod = createWorkoutsModule(fakeRepo());
    const result = await mod.list({
      schemaVersion: "workouts_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.sessions.length).toBe(1);
    expect(result.count).toBe(1);
    expect(result.sessions[0].title).toBe("piernas");
  });
});
