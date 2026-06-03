export type TaskStatus = "pending" | "completed";

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  source: string;
  dueAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  schemaVersion: "tasks_create_input.v1";
  traceId: string;
  title: string;
  description?: string;
  source: "chatwoot" | "manual" | "system";
  areaId?: string;
  dueAt?: string;
}

export interface CreateTaskResult {
  schemaVersion: "tasks_create_result.v1";
  traceId: string;
  status: "created" | "failed";
  taskId?: string;
  eventId?: string;
  evidence: {
    taskId?: string;
    eventId?: string;
    eventType?: "task_created";
  };
  error?: string;
}

export interface ListTasksInput {
  schemaVersion: "tasks_list_input.v1";
  traceId: string;
  limit?: number;
  status?: TaskStatus;
}

export interface ListTasksResult {
  schemaVersion: "tasks_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  tasks: TaskRecord[];
  count: number;
  error?: string;
}

export interface CompleteTaskInput {
  schemaVersion: "tasks_complete_input.v1";
  traceId: string;
  taskId?: string;
  titleMatch?: string;
  position?: number;
  source: "chatwoot" | "manual" | "system";
}

export interface CompleteTaskResult {
  schemaVersion: "tasks_complete_result.v1";
  traceId: string;
  status: "completed" | "failed";
  taskId?: string;
  eventId?: string;
  title?: string;
  evidence: {
    taskId?: string;
    eventId?: string;
    eventType?: "task_completed";
    title?: string;
  };
  error?: string;
}

export interface TasksRepository {
  createTask(input: CreateTaskInput): Promise<CreateTaskResult>;
  listTasks(input: ListTasksInput): Promise<ListTasksResult>;
  completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult>;
}
