import type {
  CreatePlanInput,
  CreatePlanResult,
  ListPlansInput,
  ListPlansResult,
  ArchivePlanInput,
  ArchivePlanResult,
  CompletePlanStepInput,
  CompletePlanStepResult,
  PlansRepository,
} from "../../contracts/plans.js";

export interface PlansModule {
  create(input: CreatePlanInput): Promise<CreatePlanResult>;
  list(input: ListPlansInput): Promise<ListPlansResult>;
  archive(input: ArchivePlanInput): Promise<ArchivePlanResult>;
  completeStep(input: CompletePlanStepInput): Promise<CompletePlanStepResult>;
}

export function createPlansModule(repository: PlansRepository): PlansModule {
  return {
    async create(input: CreatePlanInput): Promise<CreatePlanResult> {
      const title = (input.title ?? "").trim();
      const slug = (input.slug ?? "").trim();

      if (!title) {
        return {
          schemaVersion: "plans_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "plan title cannot be empty",
        };
      }

      if (!slug) {
        return {
          schemaVersion: "plans_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "plan slug cannot be empty",
        };
      }

      return repository.createPlan({ ...input, title, slug });
    },

    async list(input: ListPlansInput): Promise<ListPlansResult> {
      return repository.listPlans(input);
    },

    async archive(input: ArchivePlanInput): Promise<ArchivePlanResult> {
      if (!input.planId && !input.slug) {
        return {
          schemaVersion: "plans_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "planId or slug required to archive",
        };
      }
      return repository.archivePlan(input);
    },

    async completeStep(input: CompletePlanStepInput): Promise<CompletePlanStepResult> {
      if (!input.stepId && (!input.planSlug || !input.stepPosition)) {
        return {
          schemaVersion: "plans_complete_step_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "stepId or (planSlug + stepPosition) required to complete step",
        };
      }
      return repository.completePlanStep(input);
    },
  };
}
