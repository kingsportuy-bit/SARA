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
} from "../../contracts/objectives.js";

export interface ObjectivesModule {
  create(input: CreateObjectiveInput): Promise<CreateObjectiveResult>;
  list(input: ListObjectivesInput): Promise<ListObjectivesResult>;
  achieve(input: AchieveObjectiveInput): Promise<AchieveObjectiveResult>;
  archive(input: ArchiveObjectiveInput): Promise<ArchiveObjectiveResult>;
  assignTask(input: AssignTaskObjectiveInput): Promise<AssignTaskObjectiveResult>;
}

export function createObjectivesModule(repository: ObjectivesRepository): ObjectivesModule {
  return {
    async create(input: CreateObjectiveInput): Promise<CreateObjectiveResult> {
      const title = (input.title ?? "").trim();
      const slug = (input.slug ?? "").trim();

      if (!title) {
        return {
          schemaVersion: "objectives_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "objective title cannot be empty",
        };
      }

      if (!slug) {
        return {
          schemaVersion: "objectives_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "objective slug cannot be empty",
        };
      }

      return repository.createObjective({ ...input, title, slug });
    },

    async list(input: ListObjectivesInput): Promise<ListObjectivesResult> {
      return repository.listObjectives(input);
    },

    async achieve(input: AchieveObjectiveInput): Promise<AchieveObjectiveResult> {
      if (!input.objectiveId && !input.slug) {
        return {
          schemaVersion: "objectives_achieve_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "objectiveId or slug required to achieve",
        };
      }
      return repository.achieveObjective(input);
    },

    async archive(input: ArchiveObjectiveInput): Promise<ArchiveObjectiveResult> {
      if (!input.objectiveId && !input.slug) {
        return {
          schemaVersion: "objectives_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "objectiveId or slug required to archive",
        };
      }
      return repository.archiveObjective(input);
    },

    async assignTask(input: AssignTaskObjectiveInput): Promise<AssignTaskObjectiveResult> {
      if (!input.taskId) {
        return {
          schemaVersion: "objectives_assign_task_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "taskId is required",
        };
      }
      if (!input.objectiveId && !input.objectiveSlug) {
        return {
          schemaVersion: "objectives_assign_task_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "objectiveId or objectiveSlug required to assign task",
        };
      }
      return repository.assignTaskObjective(input);
    },
  };
}
