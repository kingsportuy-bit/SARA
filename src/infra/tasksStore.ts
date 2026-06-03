import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateTaskInput,
  CreateTaskResult,
  ListTasksInput,
  ListTasksResult,
  CompleteTaskInput,
  CompleteTaskResult,
  TasksRepository,
  TaskRecord,
} from "../contracts/tasks.js";

interface CreateRpcResult {
  task_id: string;
  event_id: string;
  trace_id: string;
  schema_version: string;
}

interface CompleteRpcResult {
  task_id: string;
  event_id: string;
  title: string;
  trace_id: string;
  schema_version: string;
}

function toTaskRecord(row: Record<string, unknown>): TaskRecord {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    status: String(row.status ?? "") as TaskRecord["status"],
    source: String(row.source ?? ""),
    dueAt: row.due_at != null ? String(row.due_at) : undefined,
    completedAt: row.completed_at != null ? String(row.completed_at) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function createTasksStore(supabase: SupabaseClient): TasksRepository {
  return {
    async createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
      const { data, error } = await supabase.rpc("sara_create_task", {
        p_trace_id: input.traceId,
        p_title: input.title,
        p_description: input.description ?? null,
        p_source: input.source,
        p_area_id: input.areaId ?? null,
        p_due_at: input.dueAt ?? null,
      });

      if (error) {
        return {
          schemaVersion: "tasks_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CreateRpcResult;

      return {
        schemaVersion: "tasks_create_result.v1",
        traceId: input.traceId,
        status: "created",
        taskId: result.task_id,
        eventId: result.event_id,
        evidence: {
          taskId: result.task_id,
          eventId: result.event_id,
          eventType: "task_created",
        },
      };
    },

    async listTasks(input: ListTasksInput): Promise<ListTasksResult> {
      try {
        let query = supabase
          .from("sara_tasks")
          .select("*")
          .eq("status", input.status ?? "pending")
          .order("created_at", { ascending: false })
          .limit(input.limit ?? 5);

        const { data, error } = await query;

        if (error) {
          return {
            schemaVersion: "tasks_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            tasks: [],
            count: 0,
            error: error.message,
          };
        }

        const tasks = (data as Record<string, unknown>[]).map(toTaskRecord);
        return {
          schemaVersion: "tasks_list_result.v1",
          traceId: input.traceId,
          status: "success",
          tasks,
          count: tasks.length,
        };
      } catch (err) {
        return {
          schemaVersion: "tasks_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          tasks: [],
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult> {
      const { data, error } = await supabase.rpc("sara_complete_task", {
        p_trace_id: input.traceId,
        p_task_id: input.taskId ?? null,
        p_title_match: input.titleMatch ?? null,
        p_position: input.position ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "tasks_complete_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CompleteRpcResult;

      return {
        schemaVersion: "tasks_complete_result.v1",
        traceId: input.traceId,
        status: "completed",
        taskId: result.task_id,
        eventId: result.event_id,
        title: result.title,
        evidence: {
          taskId: result.task_id,
          eventId: result.event_id,
          eventType: "task_completed",
          title: result.title,
        },
      };
    },
  };
}
