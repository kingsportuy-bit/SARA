import { describe, expect, it } from "vitest";
import { createRoutinesModule } from "../src/modules/routines/routinesModule.js";
import type {
  CreateRoutineInput,
  CreateRoutineResult,
  ListRoutinesInput,
  ListRoutinesResult,
  ActivateRoutineInput,
  ActivateRoutineResult,
  PauseRoutineInput,
  PauseRoutineResult,
  ArchiveRoutineInput,
  ArchiveRoutineResult,
  RoutinesRepository,
} from "../src/contracts/routines.js";

function fakeRepo(): RoutinesRepository {
  return {
    async createRoutine(input: CreateRoutineInput): Promise<CreateRoutineResult> {
      return {
        schemaVersion: "routines_create_result.v1",
        traceId: input.traceId,
        status: "created",
        routineId: "rout-uuid-1",
        eventId: "event-uuid-1",
        name: input.name,
        slug: input.slug,
        evidence: {
          routineId: "rout-uuid-1",
          eventId: "event-uuid-1",
          eventType: "routine_created",
        },
      };
    },
    async listRoutines(input: ListRoutinesInput): Promise<ListRoutinesResult> {
      return {
        schemaVersion: "routines_list_result.v1",
        traceId: input.traceId,
        status: "success",
        routines: [
          { id: "r1", name: "manana normal", slug: "manana-normal", status: "active", schedule: {}, steps: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" },
          { id: "r2", name: "tarde productiva", slug: "tarde-productiva", status: "active", schedule: {}, steps: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        ],
        count: 2,
      };
    },
    async activateRoutine(input: ActivateRoutineInput): Promise<ActivateRoutineResult> {
      return {
        schemaVersion: "routines_activate_result.v1",
        traceId: input.traceId,
        status: "activated",
        routineId: input.routineId ?? "rout-uuid-1",
        eventId: "event-uuid-1",
        name: "manana normal",
        slug: input.slug ?? "manana-normal",
        evidence: {
          routineId: input.routineId ?? "rout-uuid-1",
          eventId: "event-uuid-1",
          eventType: "routine_activated",
        },
      };
    },
    async pauseRoutine(input: PauseRoutineInput): Promise<PauseRoutineResult> {
      return {
        schemaVersion: "routines_pause_result.v1",
        traceId: input.traceId,
        status: "paused",
        routineId: input.routineId ?? "rout-uuid-1",
        eventId: "event-uuid-1",
        name: "manana normal",
        slug: input.slug ?? "manana-normal",
        evidence: {
          routineId: input.routineId ?? "rout-uuid-1",
          eventId: "event-uuid-1",
          eventType: "routine_paused",
        },
      };
    },
    async archiveRoutine(input: ArchiveRoutineInput): Promise<ArchiveRoutineResult> {
      return {
        schemaVersion: "routines_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        routineId: input.routineId ?? "rout-uuid-1",
        eventId: "event-uuid-1",
        name: "manana normal",
        slug: input.slug ?? "manana-normal",
        evidence: {
          routineId: input.routineId ?? "rout-uuid-1",
          eventId: "event-uuid-1",
          eventType: "routine_archived",
        },
      };
    },
  };
}

describe("routinesModule - create", () => {
  it("creates a routine with valid input", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "manana normal",
      slug: "manana-normal",
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.routineId).toBe("rout-uuid-1");
    expect(result.evidence.eventType).toBe("routine_created");
  });

  it("creates a routine with steps", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "manana normal",
      slug: "manana-normal",
      steps: [
        { position: 1, timeOfDay: "07:00", title: "despertar" },
        { position: 2, timeOfDay: "07:15", title: "desayuno" },
      ],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.routineId).toBe("rout-uuid-1");
  });

  it("rejects empty name", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "",
      slug: "some-slug",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("name");
  });

  it("rejects empty slug", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "valid name",
      slug: "",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("slug");
  });

  it("rejects step with empty title", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "manana normal",
      slug: "manana-normal",
      steps: [
        { position: 1, title: "" },
      ],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title");
  });

  it("rejects step with invalid position", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "routines_create_input.v1",
      traceId: "trace-1",
      name: "manana normal",
      slug: "manana-normal",
      steps: [
        { position: 0, title: "despertar" },
      ],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("position");
  });
});

describe("routinesModule - list", () => {
  it("lists routines via repository", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.list({
      schemaVersion: "routines_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.routines.length).toBe(2);
    expect(result.count).toBe(2);
  });
});

describe("routinesModule - activate", () => {
  it("activates a routine by slug", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.activate({
      schemaVersion: "routines_activate_input.v1",
      traceId: "trace-1",
      slug: "manana-normal",
      source: "chatwoot",
    });

    expect(result.status).toBe("activated");
    expect(result.evidence.eventType).toBe("routine_activated");
  });

  it("fails to activate without identifier", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.activate({
      schemaVersion: "routines_activate_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("routineId or slug");
  });
});

describe("routinesModule - pause", () => {
  it("pauses a routine by slug", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.pause({
      schemaVersion: "routines_pause_input.v1",
      traceId: "trace-1",
      slug: "manana-normal",
      source: "chatwoot",
    });

    expect(result.status).toBe("paused");
    expect(result.evidence.eventType).toBe("routine_paused");
  });

  it("fails to pause without identifier", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.pause({
      schemaVersion: "routines_pause_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("routineId or slug");
  });
});

describe("routinesModule - archive", () => {
  it("archives a routine by slug", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "routines_archive_input.v1",
      traceId: "trace-1",
      slug: "manana-normal",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.evidence.eventType).toBe("routine_archived");
  });

  it("fails to archive without identifier", async () => {
    const mod = createRoutinesModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "routines_archive_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("routineId or slug");
  });
});
