import { describe, expect, it } from "vitest";
import { createTasksModule } from "../src/modules/tasks/tasksModule.js";
import type {
  CreateTaskInput,
  CreateTaskResult,
  ListTasksInput,
  ListTasksResult,
  CompleteTaskInput,
  CompleteTaskResult,
  TasksRepository,
} from "../src/contracts/tasks.js";

function fakeRepo(): TasksRepository {
  return {
    async createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
      return {
        schemaVersion: "tasks_create_result.v1",
        traceId: input.traceId,
        status: "created",
        taskId: "task-uuid-1",
        eventId: "event-uuid-1",
        evidence: { taskId: "task-uuid-1", eventId: "event-uuid-1", eventType: "task_created" },
      };
    },
    async listTasks(input: ListTasksInput): Promise<ListTasksResult> {
      return {
        schemaVersion: "tasks_list_result.v1",
        traceId: input.traceId,
        status: "success",
        tasks: [
          { id: "t1", title: "llamar al contador", status: "pending", source: "chatwoot", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z" },
          { id: "t2", title: "revisar facturas", status: "pending", source: "chatwoot", createdAt: "2026-06-02T00:00:00Z", updatedAt: "2026-06-02T00:00:00Z" },
        ],
        count: 2,
      };
    },
    async completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult> {
      return {
        schemaVersion: "tasks_complete_result.v1",
        traceId: input.traceId,
        status: "completed",
        taskId: "task-uuid-1",
        eventId: "event-uuid-2",
        title: "llamar al contador",
        evidence: { taskId: "task-uuid-1", eventId: "event-uuid-2", eventType: "task_completed", title: "llamar al contador" },
      };
    },
  };
}

describe("tasksModule.create", () => {
  it("creates a task with valid input", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.create({
      schemaVersion: "tasks_create_input.v1",
      traceId: "trace-1",
      title: "llamar al contador",
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.taskId).toBe("task-uuid-1");
    expect(result.eventId).toBe("event-uuid-1");
    expect(result.evidence.taskId).toBe("task-uuid-1");
    expect(result.evidence.eventId).toBe("event-uuid-1");
    expect(result.evidence.eventType).toBe("task_created");
  });

  it("rejects empty title", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.create({
      schemaVersion: "tasks_create_input.v1",
      traceId: "trace-2",
      title: "",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title cannot be empty");
    expect(result.taskId).toBeUndefined();
  });

  it("rejects whitespace-only title", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.create({
      schemaVersion: "tasks_create_input.v1",
      traceId: "trace-3",
      title: "   ",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title cannot be empty");
  });

  it("returns failed when repository returns failed", async () => {
    const repo: TasksRepository = {
      async createTask() {
        return {
          schemaVersion: "tasks_create_result.v1",
          traceId: "trace-4",
          status: "failed",
          evidence: {},
          error: "DB error",
        };
      },
    } as TasksRepository;
    const mod = createTasksModule(repo);
    const result = await mod.create({
      schemaVersion: "tasks_create_input.v1",
      traceId: "trace-4",
      title: "test",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });
});

describe("tasksModule.list", () => {
  it("returns pending tasks from repository", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.list({
      schemaVersion: "tasks_list_input.v1",
      traceId: "trace-l1",
    });

    expect(result.schemaVersion).toBe("tasks_list_result.v1");
    expect(result.status).toBe("success");
    expect(result.tasks).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.tasks[0].title).toBe("llamar al contador");
    expect(result.tasks[1].title).toBe("revisar facturas");
  });

  it("propagates repository failure", async () => {
    const repo: TasksRepository = {
      async listTasks(input) {
        return {
          schemaVersion: "tasks_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          tasks: [],
          count: 0,
          error: "DB down",
        };
      },
    } as TasksRepository;
    const mod = createTasksModule(repo);
    const result = await mod.list({
      schemaVersion: "tasks_list_input.v1",
      traceId: "trace-l2",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB down");
  });
});

describe("tasksModule.complete", () => {
  it("completes a task by taskId with evidence", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.complete({
      schemaVersion: "tasks_complete_input.v1",
      traceId: "trace-c1",
      taskId: "task-uuid-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("completed");
    expect(result.taskId).toBe("task-uuid-1");
    expect(result.eventId).toBe("event-uuid-2");
    expect(result.evidence.eventType).toBe("task_completed");
    expect(result.title).toBe("llamar al contador");
  });

  it("completes a task by titleMatch", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.complete({
      schemaVersion: "tasks_complete_input.v1",
      traceId: "trace-c2",
      titleMatch: "llamar al contador",
      source: "chatwoot",
    });

    expect(result.status).toBe("completed");
  });

  it("completes a task by position", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.complete({
      schemaVersion: "tasks_complete_input.v1",
      traceId: "trace-c3",
      position: 1,
      source: "chatwoot",
    });

    expect(result.status).toBe("completed");
  });

  it("fails without any identifier", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.complete({
      schemaVersion: "tasks_complete_input.v1",
      traceId: "trace-c4",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("taskId, titleMatch, or positive position required");
  });

  it("fails with zero position", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.complete({
      schemaVersion: "tasks_complete_input.v1",
      traceId: "trace-c5",
      position: 0,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("required");
  });

  it("fails with negative position", async () => {
    const repo = fakeRepo();
    const mod = createTasksModule(repo);
    const result = await mod.complete({
      schemaVersion: "tasks_complete_input.v1",
      traceId: "trace-c6",
      position: -1,
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
  });
});
