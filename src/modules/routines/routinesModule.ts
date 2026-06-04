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
} from "../../contracts/routines.js";

export interface RoutinesModule {
  create(input: CreateRoutineInput): Promise<CreateRoutineResult>;
  list(input: ListRoutinesInput): Promise<ListRoutinesResult>;
  activate(input: ActivateRoutineInput): Promise<ActivateRoutineResult>;
  pause(input: PauseRoutineInput): Promise<PauseRoutineResult>;
  archive(input: ArchiveRoutineInput): Promise<ArchiveRoutineResult>;
}

export function createRoutinesModule(repository: RoutinesRepository): RoutinesModule {
  return {
    async create(input: CreateRoutineInput): Promise<CreateRoutineResult> {
      const name = (input.name ?? "").trim();
      const slug = (input.slug ?? "").trim();

      if (!name) {
        return {
          schemaVersion: "routines_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "routine name cannot be empty",
        };
      }

      if (!slug) {
        return {
          schemaVersion: "routines_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "routine slug cannot be empty",
        };
      }

      if (input.steps && input.steps.length > 0) {
        for (const step of input.steps) {
          const stepTitle = (step.title ?? "").trim();
          if (!stepTitle) {
            return {
              schemaVersion: "routines_create_result.v1",
              traceId: input.traceId,
              status: "failed",
              evidence: {},
              error: "routine step title cannot be empty",
            };
          }
          if (!step.position || step.position < 1) {
            return {
              schemaVersion: "routines_create_result.v1",
              traceId: input.traceId,
              status: "failed",
              evidence: {},
              error: "routine step position must be a positive integer",
            };
          }
        }
      }

      return repository.createRoutine({ ...input, name, slug });
    },

    async list(input: ListRoutinesInput): Promise<ListRoutinesResult> {
      return repository.listRoutines(input);
    },

    async activate(input: ActivateRoutineInput): Promise<ActivateRoutineResult> {
      if (!input.routineId && !input.slug) {
        return {
          schemaVersion: "routines_activate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "routineId or slug required to activate",
        };
      }
      return repository.activateRoutine(input);
    },

    async pause(input: PauseRoutineInput): Promise<PauseRoutineResult> {
      if (!input.routineId && !input.slug) {
        return {
          schemaVersion: "routines_pause_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "routineId or slug required to pause",
        };
      }
      return repository.pauseRoutine(input);
    },

    async archive(input: ArchiveRoutineInput): Promise<ArchiveRoutineResult> {
      if (!input.routineId && !input.slug) {
        return {
          schemaVersion: "routines_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "routineId or slug required to archive",
        };
      }
      return repository.archiveRoutine(input);
    },
  };
}
