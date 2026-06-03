import { describe, expect, it } from "vitest";
import { createAreasModule } from "../src/modules/areas/areasModule.js";
import type {
  CreateAreaInput,
  CreateAreaResult,
  ListAreasInput,
  ListAreasResult,
  ArchiveAreaInput,
  ArchiveAreaResult,
  AssignNoteAreaInput,
  AssignNoteAreaResult,
  AssignTaskAreaInput,
  AssignTaskAreaResult,
  AreasRepository,
} from "../src/contracts/areas.js";

function fakeRepo(): AreasRepository {
  return {
    async createArea(input: CreateAreaInput): Promise<CreateAreaResult> {
      return {
        schemaVersion: "areas_create_result.v1",
        traceId: input.traceId,
        status: "created",
        areaId: "area-uuid-1",
        eventId: "event-uuid-1",
        name: input.name,
        slug: input.slug,
        evidence: {
          areaId: "area-uuid-1",
          eventId: "event-uuid-1",
          eventType: "area_created",
        },
      };
    },
    async listAreas(input: ListAreasInput): Promise<ListAreasResult> {
      return {
        schemaVersion: "areas_list_result.v1",
        traceId: input.traceId,
        status: "success",
        areas: [
          { id: "a1", name: "salud", slug: "salud", status: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
          { id: "a2", name: "trabajo", slug: "trabajo", status: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        ],
        count: 2,
      };
    },
    async archiveArea(input: ArchiveAreaInput): Promise<ArchiveAreaResult> {
      return {
        schemaVersion: "areas_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        areaId: input.areaId ?? "area-uuid-1",
        eventId: "event-uuid-1",
        name: "salud",
        slug: input.slug ?? "salud",
        evidence: {
          areaId: input.areaId ?? "area-uuid-1",
          eventId: "event-uuid-1",
          eventType: "area_archived",
        },
      };
    },
    async assignNoteArea(input: AssignNoteAreaInput): Promise<AssignNoteAreaResult> {
      return {
        schemaVersion: "areas_assign_note_result.v1",
        traceId: input.traceId,
        status: "assigned",
        noteId: input.noteId,
        areaId: "area-uuid-1",
        areaName: "salud",
        eventId: "event-uuid-1",
        evidence: {
          noteId: input.noteId,
          areaId: "area-uuid-1",
          eventId: "event-uuid-1",
          eventType: "note_area_assigned",
        },
      };
    },
    async assignTaskArea(input: AssignTaskAreaInput): Promise<AssignTaskAreaResult> {
      return {
        schemaVersion: "areas_assign_task_result.v1",
        traceId: input.traceId,
        status: "assigned",
        taskId: input.taskId,
        title: "llamar al contador",
        areaId: "area-uuid-1",
        areaName: "salud",
        eventId: "event-uuid-1",
        evidence: {
          taskId: input.taskId,
          areaId: "area-uuid-1",
          eventId: "event-uuid-1",
          eventType: "task_area_assigned",
        },
      };
    },
  };
}

const module = createAreasModule(fakeRepo());

describe("areasModule.create", () => {
  it("creates area with valid input", async () => {
    const result = await module.create({
      schemaVersion: "areas_create_input.v1",
      traceId: "trace-1",
      name: "salud",
      slug: "salud",
      source: "chatwoot",
    });
    expect(result.status).toBe("created");
    expect(result.areaId).toBe("area-uuid-1");
    expect(result.eventId).toBe("event-uuid-1");
    expect(result.name).toBe("salud");
    expect(result.slug).toBe("salud");
    expect(result.evidence.areaId).toBe("area-uuid-1");
    expect(result.evidence.eventId).toBe("event-uuid-1");
    expect(result.evidence.eventType).toBe("area_created");
  });

  it("rejects empty name", async () => {
    const result = await module.create({
      schemaVersion: "areas_create_input.v1",
      traceId: "trace-1",
      name: "",
      slug: "salud",
      source: "chatwoot",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("area name cannot be empty");
  });

  it("rejects whitespace-only name", async () => {
    const result = await module.create({
      schemaVersion: "areas_create_input.v1",
      traceId: "trace-1",
      name: "   ",
      slug: "salud",
      source: "chatwoot",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("area name cannot be empty");
  });

  it("rejects empty slug", async () => {
    const result = await module.create({
      schemaVersion: "areas_create_input.v1",
      traceId: "trace-1",
      name: "salud",
      slug: "",
      source: "chatwoot",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("area slug cannot be empty");
  });
});

describe("areasModule.list", () => {
  it("lists areas as read-only", async () => {
    const result = await module.list({
      schemaVersion: "areas_list_input.v1",
      traceId: "trace-1",
    });
    expect(result.status).toBe("success");
    expect(result.areas).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.areas[0].name).toBe("salud");
    expect(result.areas[1].name).toBe("trabajo");
  });
});

describe("areasModule.archive", () => {
  it("archives area by areaId", async () => {
    const result = await module.archive({
      schemaVersion: "areas_archive_input.v1",
      traceId: "trace-1",
      areaId: "area-uuid-1",
      source: "chatwoot",
    });
    expect(result.status).toBe("archived");
    expect(result.areaId).toBe("area-uuid-1");
    expect(result.eventId).toBe("event-uuid-1");
    expect(result.evidence.eventType).toBe("area_archived");
  });

  it("archives area by slug", async () => {
    const result = await module.archive({
      schemaVersion: "areas_archive_input.v1",
      traceId: "trace-1",
      slug: "salud",
      source: "chatwoot",
    });
    expect(result.status).toBe("archived");
  });

  it("fails without areaId or slug", async () => {
    const result = await module.archive({
      schemaVersion: "areas_archive_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("areaId or slug required to archive");
  });
});

describe("areasModule.assignNote", () => {
  it("assigns note to area by areaSlug", async () => {
    const result = await module.assignNote({
      schemaVersion: "areas_assign_note_input.v1",
      traceId: "trace-1",
      noteId: "note-uuid-1",
      areaSlug: "salud",
      source: "chatwoot",
    });
    expect(result.status).toBe("assigned");
    expect(result.noteId).toBe("note-uuid-1");
    expect(result.areaName).toBe("salud");
    expect(result.evidence.eventType).toBe("note_area_assigned");
  });

  it("fails without noteId", async () => {
    const result = await module.assignNote({
      schemaVersion: "areas_assign_note_input.v1",
      traceId: "trace-1",
      noteId: "",
      areaSlug: "salud",
      source: "chatwoot",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("noteId is required");
  });

  it("fails without area identifier", async () => {
    const result = await module.assignNote({
      schemaVersion: "areas_assign_note_input.v1",
      traceId: "trace-1",
      noteId: "note-uuid-1",
      source: "chatwoot",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("areaId or areaSlug required to assign note");
  });
});

describe("areasModule.assignTask", () => {
  it("assigns task to area by areaSlug", async () => {
    const result = await module.assignTask({
      schemaVersion: "areas_assign_task_input.v1",
      traceId: "trace-1",
      taskId: "task-uuid-1",
      areaSlug: "salud",
      source: "chatwoot",
    });
    expect(result.status).toBe("assigned");
    expect(result.taskId).toBe("task-uuid-1");
    expect(result.areaName).toBe("salud");
    expect(result.evidence.eventType).toBe("task_area_assigned");
  });

  it("fails without taskId", async () => {
    const result = await module.assignTask({
      schemaVersion: "areas_assign_task_input.v1",
      traceId: "trace-1",
      taskId: "",
      areaSlug: "salud",
      source: "chatwoot",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("taskId is required");
  });

  it("fails without area identifier", async () => {
    const result = await module.assignTask({
      schemaVersion: "areas_assign_task_input.v1",
      traceId: "trace-1",
      taskId: "task-uuid-1",
      source: "chatwoot",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("areaId or areaSlug required to assign task");
  });
});
