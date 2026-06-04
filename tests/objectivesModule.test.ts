import { describe, expect, it } from "vitest";
import { createObjectivesModule } from "../src/modules/objectives/objectivesModule.js";
import type {
  CreateObjectiveInput,
  CreateObjectiveResult,
  ListObjectivesInput,
  ListObjectivesResult,
  AchieveObjectiveInput,
  AchieveObjectiveResult,
  ArchiveObjectiveInput,
  ArchiveObjectiveResult,
  AssignTaskObjectiveInput,
  AssignTaskObjectiveResult,
  ObjectivesRepository,
} from "../src/contracts/objectives.js";

function fakeRepo(): ObjectivesRepository {
  return {
    async createObjective(input: CreateObjectiveInput): Promise<CreateObjectiveResult> {
      return {
        schemaVersion: "objectives_create_result.v1",
        traceId: input.traceId,
        status: "created",
        objectiveId: "obj-uuid-1",
        eventId: "event-uuid-1",
        title: input.title,
        slug: input.slug,
        evidence: {
          objectiveId: "obj-uuid-1",
          eventId: "event-uuid-1",
          eventType: "objective_created",
        },
      };
    },
    async listObjectives(input: ListObjectivesInput): Promise<ListObjectivesResult> {
      return {
        schemaVersion: "objectives_list_result.v1",
        traceId: input.traceId,
        status: "success",
        objectives: [
          { id: "o1", title: "mejorar mi energia", slug: "mejorar-mi-energia", status: "active", successCriteria: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" },
          { id: "o2", title: "facturar mas", slug: "facturar-mas", status: "active", successCriteria: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        ],
        count: 2,
      };
    },
    async achieveObjective(input: AchieveObjectiveInput): Promise<AchieveObjectiveResult> {
      return {
        schemaVersion: "objectives_achieve_result.v1",
        traceId: input.traceId,
        status: "achieved",
        objectiveId: input.objectiveId ?? "obj-uuid-1",
        eventId: "event-uuid-1",
        title: "mejorar mi energia",
        slug: input.slug ?? "mejorar-mi-energia",
        evidence: {
          objectiveId: input.objectiveId ?? "obj-uuid-1",
          eventId: "event-uuid-1",
          eventType: "objective_achieved",
        },
      };
    },
    async archiveObjective(input: ArchiveObjectiveInput): Promise<ArchiveObjectiveResult> {
      return {
        schemaVersion: "objectives_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        objectiveId: input.objectiveId ?? "obj-uuid-1",
        eventId: "event-uuid-1",
        title: "mejorar mi energia",
        slug: input.slug ?? "mejorar-mi-energia",
        evidence: {
          objectiveId: input.objectiveId ?? "obj-uuid-1",
          eventId: "event-uuid-1",
          eventType: "objective_archived",
        },
      };
    },
    async assignTaskObjective(input: AssignTaskObjectiveInput): Promise<AssignTaskObjectiveResult> {
      return {
        schemaVersion: "objectives_assign_task_result.v1",
        traceId: input.traceId,
        status: "assigned",
        taskId: input.taskId,
        taskTitle: "llamar al contador",
        objectiveId: "obj-uuid-1",
        objectiveTitle: "facturar mas",
        objectiveSlug: input.objectiveSlug ?? "facturar-mas",
        eventId: "event-uuid-1",
        evidence: {
          taskId: input.taskId,
          objectiveId: "obj-uuid-1",
          objectiveSlug: input.objectiveSlug,
          eventId: "event-uuid-1",
          eventType: "task_objective_assigned",
        },
      };
    },
  };
}

describe("objectivesModule - create", () => {
  it("creates an objective with valid input", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "objectives_create_input.v1",
      traceId: "trace-1",
      title: "mejorar mi energia",
      slug: "mejorar-mi-energia",
      successCriteria: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.objectiveId).toBe("obj-uuid-1");
    expect(result.evidence.eventType).toBe("objective_created");
  });

  it("rejects empty title", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "objectives_create_input.v1",
      traceId: "trace-1",
      title: "",
      slug: "some-slug",
      successCriteria: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title");
  });

  it("rejects empty slug", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "objectives_create_input.v1",
      traceId: "trace-1",
      title: "valid title",
      slug: "",
      successCriteria: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("slug");
  });
});

describe("objectivesModule - list", () => {
  it("lists objectives via repository", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.list({
      schemaVersion: "objectives_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.objectives.length).toBe(2);
    expect(result.count).toBe(2);
  });
});

describe("objectivesModule - achieve", () => {
  it("achieves an objective by slug", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.achieve({
      schemaVersion: "objectives_achieve_input.v1",
      traceId: "trace-1",
      slug: "mejorar-mi-energia",
      source: "chatwoot",
    });

    expect(result.status).toBe("achieved");
    expect(result.evidence.eventType).toBe("objective_achieved");
  });

  it("fails to achieve without identifier", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.achieve({
      schemaVersion: "objectives_achieve_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("objectiveId or slug");
  });
});

describe("objectivesModule - archive", () => {
  it("archives an objective by slug", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "objectives_archive_input.v1",
      traceId: "trace-1",
      slug: "mejorar-mi-energia",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.evidence.eventType).toBe("objective_archived");
  });

  it("fails to archive without identifier", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "objectives_archive_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("objectiveId or slug");
  });
});

describe("objectivesModule - assignTask", () => {
  it("assigns a task to an objective by slug", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.assignTask({
      schemaVersion: "objectives_assign_task_input.v1",
      traceId: "trace-1",
      taskId: "t1",
      objectiveSlug: "facturar-mas",
      source: "chatwoot",
    });

    expect(result.status).toBe("assigned");
    expect(result.evidence.eventType).toBe("task_objective_assigned");
    expect(result.taskId).toBe("t1");
    expect(result.objectiveSlug).toBe("facturar-mas");
  });

  it("fails to assign without taskId", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.assignTask({
      schemaVersion: "objectives_assign_task_input.v1",
      traceId: "trace-1",
      taskId: "",
      objectiveSlug: "facturar-mas",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("taskId");
  });

  it("fails to assign without objective identifier", async () => {
    const mod = createObjectivesModule(fakeRepo());
    const result = await mod.assignTask({
      schemaVersion: "objectives_assign_task_input.v1",
      traceId: "trace-1",
      taskId: "t1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("objectiveId or objectiveSlug");
  });
});
