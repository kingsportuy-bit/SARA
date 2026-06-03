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
} from "../../contracts/areas.js";

export interface AreasModule {
  create(input: CreateAreaInput): Promise<CreateAreaResult>;
  list(input: ListAreasInput): Promise<ListAreasResult>;
  archive(input: ArchiveAreaInput): Promise<ArchiveAreaResult>;
  assignNote(input: AssignNoteAreaInput): Promise<AssignNoteAreaResult>;
  assignTask(input: AssignTaskAreaInput): Promise<AssignTaskAreaResult>;
}

export function createAreasModule(repository: AreasRepository): AreasModule {
  return {
    async create(input: CreateAreaInput): Promise<CreateAreaResult> {
      const name = (input.name ?? "").trim();
      const slug = (input.slug ?? "").trim();

      if (!name) {
        return {
          schemaVersion: "areas_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "area name cannot be empty",
        };
      }

      if (!slug) {
        return {
          schemaVersion: "areas_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "area slug cannot be empty",
        };
      }

      return repository.createArea({ ...input, name, slug });
    },

    async list(input: ListAreasInput): Promise<ListAreasResult> {
      return repository.listAreas(input);
    },

    async archive(input: ArchiveAreaInput): Promise<ArchiveAreaResult> {
      if (!input.areaId && !input.slug) {
        return {
          schemaVersion: "areas_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "areaId or slug required to archive",
        };
      }

      return repository.archiveArea(input);
    },

    async assignNote(input: AssignNoteAreaInput): Promise<AssignNoteAreaResult> {
      if (!input.noteId) {
        return {
          schemaVersion: "areas_assign_note_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "noteId is required",
        };
      }

      if (!input.areaId && !input.areaSlug) {
        return {
          schemaVersion: "areas_assign_note_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "areaId or areaSlug required to assign note",
        };
      }

      return repository.assignNoteArea(input);
    },

    async assignTask(input: AssignTaskAreaInput): Promise<AssignTaskAreaResult> {
      if (!input.taskId) {
        return {
          schemaVersion: "areas_assign_task_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "taskId is required",
        };
      }

      if (!input.areaId && !input.areaSlug) {
        return {
          schemaVersion: "areas_assign_task_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "areaId or areaSlug required to assign task",
        };
      }

      return repository.assignTaskArea(input);
    },
  };
}
