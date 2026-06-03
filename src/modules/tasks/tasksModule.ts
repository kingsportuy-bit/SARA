import type {
  CreateTaskInput,
  CreateTaskResult,
  ListTasksInput,
  ListTasksResult,
  CompleteTaskInput,
  CompleteTaskResult,
  TasksRepository,
} from "../../contracts/tasks.js";

export interface TasksModule {
  create(input: CreateTaskInput): Promise<CreateTaskResult>;
  list(input: ListTasksInput): Promise<ListTasksResult>;
  complete(input: CompleteTaskInput): Promise<CompleteTaskResult>;
}

export function createTasksModule(repository: TasksRepository): TasksModule {
  return {
    async create(input) {
      if (!input.title || input.title.trim().length === 0) {
        return {
          schemaVersion: "tasks_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "title cannot be empty",
        };
      }
      return repository.createTask(input);
    },

    async list(input) {
      return repository.listTasks(input);
    },

    async complete(input) {
      if (!input.taskId && !input.titleMatch && (!input.position || input.position < 1)) {
        return {
          schemaVersion: "tasks_complete_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "taskId, titleMatch, or positive position required to complete a task",
        };
      }
      return repository.completeTask(input);
    },
  };
}
