import { describe, expect, it } from "vitest";
import { createTasksStore } from "../src/infra/tasksStore.js";

function fakeSupabase() {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      if (fn === "sara_create_task") {
        if (!params.p_title || String(params.p_title).trim() === "") {
          return { data: null, error: new Error("title cannot be empty") };
        }
        return {
          data: {
            task_id: "task-uuid-rpc",
            event_id: "event-uuid-rpc",
            trace_id: params.p_trace_id,
            schema_version: "tasks_create_result.v1",
          },
          error: null,
        };
      }
      if (fn === "sara_complete_task") {
        if (!params.p_task_id && !params.p_title_match && !params.p_position) {
          return { data: null, error: new Error("no matching pending task found") };
        }
        return {
          data: {
            task_id: "task-uuid-c",
            event_id: "event-uuid-c",
            title: "llamar al contador",
            trace_id: params.p_trace_id,
            schema_version: "tasks_complete_result.v1",
          },
          error: null,
        };
      }
      return { data: null, error: new Error("unknown rpc") };
    },
    from: (table: string) => {
      if (table !== "sara_tasks") throw new Error("unknown table");
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                data: [
                  { id: "t1", title: "tarea 1", description: null, status: "pending", source: "chatwoot", due_at: null, completed_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
                  { id: "t2", title: "tarea 2", description: "desc", status: "pending", source: "manual", due_at: "2026-02-01T00:00:00Z", completed_at: null, created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z" },
                ],
                error: null,
              }),
            }),
          }),
        }),
      };
    },
  } as any;
}

describe("tasksStore createTask", () => {
  it("calls sara_create_task with correct parameters", async () => {
    const sb = fakeSupabase();
    const store = createTasksStore(sb);
    const result = await store.createTask({
      schemaVersion: "tasks_create_input.v1",
      traceId: "trace-1",
      title: "llamar al contador",
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.taskId).toBe("task-uuid-rpc");
    expect(result.eventId).toBe("event-uuid-rpc");
    expect(result.evidence.eventType).toBe("task_created");
  });

  it("returns failed on rpc error", async () => {
    const sb = fakeSupabase();
    const store = createTasksStore(sb);
    const result = await store.createTask({
      schemaVersion: "tasks_create_input.v1",
      traceId: "trace-2",
      title: "",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
  });
});

describe("tasksStore listTasks", () => {
  it("queries sara_tasks and returns tasks", async () => {
    const sb = fakeSupabase();
    const store = createTasksStore(sb);
    const result = await store.listTasks({
      schemaVersion: "tasks_list_input.v1",
      traceId: "trace-list-1",
    });

    expect(result.schemaVersion).toBe("tasks_list_result.v1");
    expect(result.status).toBe("success");
    expect(result.tasks).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.tasks[0].title).toBe("tarea 1");
  });

  it("maps fields correctly", async () => {
    const sb = fakeSupabase();
    const store = createTasksStore(sb);
    const result = await store.listTasks({
      schemaVersion: "tasks_list_input.v1",
      traceId: "trace-list-2",
    });

    expect(result.tasks[1].title).toBe("tarea 2");
    expect(result.tasks[1].description).toBe("desc");
    expect(result.tasks[1].source).toBe("manual");
    expect(result.tasks[1].dueAt).toBe("2026-02-01T00:00:00Z");
    expect(result.tasks[1].status).toBe("pending");
  });
});

describe("tasksStore completeTask", () => {
  it("calls sara_complete_task with taskId", async () => {
    const sb = fakeSupabase();
    const store = createTasksStore(sb);
    const result = await store.completeTask({
      schemaVersion: "tasks_complete_input.v1",
      traceId: "trace-c1",
      taskId: "task-uuid-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("completed");
    expect(result.taskId).toBe("task-uuid-c");
    expect(result.eventId).toBe("event-uuid-c");
    expect(result.evidence.eventType).toBe("task_completed");
    expect(result.title).toBe("llamar al contador");
  });

  it("returns failed on rpc error for complete", async () => {
    const sb = fakeSupabase();
    const store = createTasksStore(sb);
    const result = await store.completeTask({
      schemaVersion: "tasks_complete_input.v1",
      traceId: "trace-c2",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
  });
});
