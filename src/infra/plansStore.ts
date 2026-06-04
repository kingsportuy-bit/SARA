import type { SupabaseClient } from "@supabase/supabase-js";
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
  PlanRecord,
  PlanStepRecord,
  PlanStatus,
  PlanStepStatus,
} from "../contracts/plans.js";

interface CreatePlanRpcResult {
  plan_id: string;
  event_id: string;
  title: string;
  slug: string;
  objective_id?: string;
  step_titles: string[];
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ListPlansRpcResult {
  plans: PlanRpcRecord[];
  count: number;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface PlanRpcRecord {
  id: string;
  schema_version: string;
  objective_id?: string;
  title: string;
  slug: string;
  status: string;
  description?: string;
  trace_id?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  steps: PlanStepRpcRecord[];
}

interface PlanStepRpcRecord {
  id: string;
  position: number;
  title: string;
  status: string;
  task_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface ArchivePlanRpcResult {
  plan_id: string;
  event_id: string;
  title: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface CompletePlanStepRpcResult {
  step_id: string;
  event_id: string;
  plan_id: string;
  position: number;
  title: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

function toStepRecord(row: PlanStepRpcRecord): PlanStepRecord {
  return {
    id: String(row.id),
    planId: "", // filled by parent
    position: Number(row.position),
    title: String(row.title ?? ""),
    status: (row.status ?? "pending") as PlanStepStatus,
    taskId: row.task_id != null ? String(row.task_id) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    completedAt: row.completed_at != null ? String(row.completed_at) : undefined,
  };
}

function toPlanRecord(row: PlanRpcRecord): PlanRecord {
  const steps = Array.isArray(row.steps) ? row.steps.map((s) => {
    const step = toStepRecord(s);
    step.planId = String(row.id);
    return step;
  }) : [];
  return {
    id: String(row.id),
    objectiveId: row.objective_id != null ? String(row.objective_id) : undefined,
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    status: (row.status ?? "active") as PlanStatus,
    description: row.description != null ? String(row.description) : undefined,
    steps,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    archivedAt: row.archived_at != null ? String(row.archived_at) : undefined,
  };
}

export function createPlansStore(supabase: SupabaseClient): PlansRepository {
  return {
    async createPlan(input: CreatePlanInput): Promise<CreatePlanResult> {
      const { data, error } = await supabase.rpc("sara_create_plan", {
        p_trace_id: input.traceId,
        p_title: input.title,
        p_slug: input.slug,
        p_description: input.description ?? null,
        p_objective_id: input.objectiveId ?? null,
        p_steps: input.steps.map((s) => ({ title: s.title })),
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "plans_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CreatePlanRpcResult;

      if (result.error) {
        return {
          schemaVersion: "plans_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "plans_create_result.v1",
        traceId: input.traceId,
        status: "created",
        planId: result.plan_id,
        eventId: result.event_id,
        title: result.title,
        slug: result.slug,
        objectiveId: result.objective_id,
        stepTitles: result.step_titles,
        evidence: {
          planId: result.plan_id,
          eventId: result.event_id,
          eventType: "plan_created",
        },
      };
    },

    async listPlans(input: ListPlansInput): Promise<ListPlansResult> {
      try {
        const { data, error } = await supabase.rpc("sara_list_plans", {
          p_trace_id: input.traceId,
          p_status: input.status ?? "active",
          p_limit: input.limit ?? 10,
        });

        if (error) {
          return {
            schemaVersion: "plans_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            plans: [],
            count: 0,
            error: error.message,
          };
        }

        const result = data as ListPlansRpcResult;

        if (result.error) {
          return {
            schemaVersion: "plans_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            plans: [],
            count: 0,
            error: result.error,
          };
        }

        const plans = (result.plans ?? []).map(toPlanRecord);

        return {
          schemaVersion: "plans_list_result.v1",
          traceId: input.traceId,
          status: "success",
          plans,
          count: result.count ?? plans.length,
        };
      } catch (err) {
        return {
          schemaVersion: "plans_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          plans: [],
          count: 0,
          error: String(err),
        };
      }
    },

    async archivePlan(input: ArchivePlanInput): Promise<ArchivePlanResult> {
      const { data, error } = await supabase.rpc("sara_archive_plan", {
        p_trace_id: input.traceId,
        p_plan_id: input.planId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "plans_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as ArchivePlanRpcResult;

      if (result.error) {
        return {
          schemaVersion: "plans_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "plans_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        planId: result.plan_id,
        eventId: result.event_id,
        title: result.title,
        slug: result.slug,
        evidence: {
          planId: result.plan_id,
          eventId: result.event_id,
          eventType: "plan_archived",
        },
      };
    },

    async completePlanStep(input: CompletePlanStepInput): Promise<CompletePlanStepResult> {
      const { data, error } = await supabase.rpc("sara_complete_plan_step", {
        p_trace_id: input.traceId,
        p_step_id: input.stepId ?? null,
        p_plan_slug: input.planSlug ?? null,
        p_step_position: input.stepPosition ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "plans_complete_step_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CompletePlanStepRpcResult;

      if (result.error) {
        return {
          schemaVersion: "plans_complete_step_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "plans_complete_step_result.v1",
        traceId: input.traceId,
        status: "completed",
        stepId: result.step_id,
        eventId: result.event_id,
        planId: result.plan_id,
        position: result.position,
        title: result.title,
        evidence: {
          stepId: result.step_id,
          eventId: result.event_id,
          eventType: "plan_step_completed",
        },
      };
    },
  };
}
