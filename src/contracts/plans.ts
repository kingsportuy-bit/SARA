export type PlanStatus = "active" | "archived";

export type PlanStepStatus = "pending" | "completed";

export interface PlanStepRecord {
  id: string;
  planId: string;
  position: number;
  title: string;
  status: PlanStepStatus;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PlanRecord {
  id: string;
  objectiveId?: string;
  title: string;
  slug: string;
  status: PlanStatus;
  description?: string;
  steps: PlanStepRecord[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface PlanStepInput {
  title: string;
}

export interface CreatePlanInput {
  schemaVersion: "plans_create_input.v1";
  traceId: string;
  title: string;
  slug: string;
  description?: string;
  objectiveId?: string;
  steps: PlanStepInput[];
  source: "chatwoot" | "manual" | "system";
}

export interface CreatePlanResult {
  schemaVersion: "plans_create_result.v1";
  traceId: string;
  status: "created" | "failed";
  planId?: string;
  eventId?: string;
  title?: string;
  slug?: string;
  objectiveId?: string;
  stepTitles?: string[];
  evidence: {
    planId?: string;
    eventId?: string;
    eventType?: "plan_created";
  };
  error?: string;
}

export interface ListPlansInput {
  schemaVersion: "plans_list_input.v1";
  traceId: string;
  status?: PlanStatus;
  limit?: number;
}

export interface ListPlansResult {
  schemaVersion: "plans_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  plans: PlanRecord[];
  count: number;
  error?: string;
}

export interface ArchivePlanInput {
  schemaVersion: "plans_archive_input.v1";
  traceId: string;
  planId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface ArchivePlanResult {
  schemaVersion: "plans_archive_result.v1";
  traceId: string;
  status: "archived" | "failed";
  planId?: string;
  eventId?: string;
  title?: string;
  slug?: string;
  evidence: {
    planId?: string;
    eventId?: string;
    eventType?: "plan_archived";
  };
  error?: string;
}

export interface CompletePlanStepInput {
  schemaVersion: "plans_complete_step_input.v1";
  traceId: string;
  stepId?: string;
  planSlug?: string;
  stepPosition?: number;
  source: "chatwoot" | "manual" | "system";
}

export interface CompletePlanStepResult {
  schemaVersion: "plans_complete_step_result.v1";
  traceId: string;
  status: "completed" | "failed";
  stepId?: string;
  eventId?: string;
  planId?: string;
  position?: number;
  title?: string;
  evidence: {
    stepId?: string;
    eventId?: string;
    eventType?: "plan_step_completed";
  };
  error?: string;
}

export interface PlansRepository {
  createPlan(input: CreatePlanInput): Promise<CreatePlanResult>;
  listPlans(input: ListPlansInput): Promise<ListPlansResult>;
  archivePlan(input: ArchivePlanInput): Promise<ArchivePlanResult>;
  completePlanStep(input: CompletePlanStepInput): Promise<CompletePlanStepResult>;
}
