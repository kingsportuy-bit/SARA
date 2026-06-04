import type { SupabaseClient } from "@supabase/supabase-js";
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
  ObjectiveRecord,
  ObjectiveStatus,
} from "../contracts/objectives.js";

interface CreateObjectiveRpcResult {
  objective_id: string;
  event_id: string;
  title: string;
  slug: string;
  area_id?: string;
  area_name?: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface AchieveObjectiveRpcResult {
  objective_id: string;
  event_id: string;
  title: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ArchiveObjectiveRpcResult {
  objective_id: string;
  event_id: string;
  title: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface AssignTaskObjectiveRpcResult {
  task_id: string;
  task_title: string;
  objective_id: string;
  objective_title: string;
  objective_slug?: string;
  event_id: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

function toObjectiveRecord(row: Record<string, unknown>): ObjectiveRecord {
  const successCriteria = Array.isArray(row.success_criteria) ? row.success_criteria as string[] : [];
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    areaId: row.area_id != null ? String(row.area_id) : undefined,
    areaName: row.area_name != null ? String(row.area_name) : undefined,
    status: (row.status ?? "active") as ObjectiveStatus,
    targetDate: row.target_date != null ? String(row.target_date) : undefined,
    successCriteria,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    achievedAt: row.achieved_at != null ? String(row.achieved_at) : undefined,
    archivedAt: row.archived_at != null ? String(row.archived_at) : undefined,
  };
}

export function createObjectivesStore(supabase: SupabaseClient): ObjectivesRepository {
  return {
    async createObjective(input: CreateObjectiveInput): Promise<CreateObjectiveResult> {
      const { data, error } = await supabase.rpc("sara_create_objective", {
        p_trace_id: input.traceId,
        p_title: input.title,
        p_slug: input.slug,
        p_description: input.description ?? null,
        p_area_id: input.areaId ?? null,
        p_area_slug: input.areaSlug ?? null,
        p_target_date: input.targetDate ?? null,
        p_success_criteria: input.successCriteria,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "objectives_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CreateObjectiveRpcResult;

      if (result.error) {
        return {
          schemaVersion: "objectives_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "objectives_create_result.v1",
        traceId: input.traceId,
        status: "created",
        objectiveId: result.objective_id,
        eventId: result.event_id,
        title: result.title,
        slug: result.slug,
        areaId: result.area_id,
        areaName: result.area_name,
        evidence: {
          objectiveId: result.objective_id,
          eventId: result.event_id,
          eventType: "objective_created",
        },
      };
    },

    async listObjectives(input: ListObjectivesInput): Promise<ListObjectivesResult> {
      try {
        const statusFilter = input.status ?? "active";
        let query = supabase
          .from("sara_objectives")
          .select("*")
          .eq("status", statusFilter)
          .order("created_at", { ascending: false })
          .limit(input.limit ?? 10);

        if (input.areaId) {
          query = query.eq("area_id", input.areaId);
        }

        const { data, error } = await query;

        if (error) {
          return {
            schemaVersion: "objectives_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            objectives: [],
            count: 0,
            error: error.message,
          };
        }

        const objectives = (data as Record<string, unknown>[]).map(toObjectiveRecord);

        // Filter by areaSlug manually if needed (since we might need join with sara_areas)
        if (input.areaSlug && input.areaSlug.trim()) {
          // Get area_id from slug, then filter
          const { data: areaData } = await supabase
            .from("sara_areas")
            .select("id")
            .eq("slug", input.areaSlug)
            .single();

          if (areaData) {
            const filtered = objectives.filter((o) => o.areaId === areaData.id);
            return {
              schemaVersion: "objectives_list_result.v1",
              traceId: input.traceId,
              status: "success",
              objectives: filtered,
              count: filtered.length,
            };
          }
        }

        return {
          schemaVersion: "objectives_list_result.v1",
          traceId: input.traceId,
          status: "success",
          objectives,
          count: objectives.length,
        };
      } catch (err) {
        return {
          schemaVersion: "objectives_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          objectives: [],
          count: 0,
          error: String(err),
        };
      }
    },

    async achieveObjective(input: AchieveObjectiveInput): Promise<AchieveObjectiveResult> {
      const { data, error } = await supabase.rpc("sara_achieve_objective", {
        p_trace_id: input.traceId,
        p_objective_id: input.objectiveId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "objectives_achieve_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as AchieveObjectiveRpcResult;

      if (result.error) {
        return {
          schemaVersion: "objectives_achieve_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "objectives_achieve_result.v1",
        traceId: input.traceId,
        status: "achieved",
        objectiveId: result.objective_id,
        eventId: result.event_id,
        title: result.title,
        slug: result.slug,
        evidence: {
          objectiveId: result.objective_id,
          eventId: result.event_id,
          eventType: "objective_achieved",
        },
      };
    },

    async archiveObjective(input: ArchiveObjectiveInput): Promise<ArchiveObjectiveResult> {
      const { data, error } = await supabase.rpc("sara_archive_objective", {
        p_trace_id: input.traceId,
        p_objective_id: input.objectiveId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "objectives_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as ArchiveObjectiveRpcResult;

      if (result.error) {
        return {
          schemaVersion: "objectives_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "objectives_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        objectiveId: result.objective_id,
        eventId: result.event_id,
        title: result.title,
        slug: result.slug,
        evidence: {
          objectiveId: result.objective_id,
          eventId: result.event_id,
          eventType: "objective_archived",
        },
      };
    },

    async assignTaskObjective(input: AssignTaskObjectiveInput): Promise<AssignTaskObjectiveResult> {
      const { data, error } = await supabase.rpc("sara_assign_task_objective", {
        p_trace_id: input.traceId,
        p_task_id: input.taskId,
        p_objective_id: input.objectiveId ?? null,
        p_objective_slug: input.objectiveSlug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "objectives_assign_task_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as AssignTaskObjectiveRpcResult;

      if (result.error) {
        return {
          schemaVersion: "objectives_assign_task_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "objectives_assign_task_result.v1",
        traceId: input.traceId,
        status: "assigned",
        taskId: result.task_id,
        taskTitle: result.task_title,
        objectiveId: result.objective_id,
        objectiveTitle: result.objective_title,
        objectiveSlug: result.objective_slug,
        eventId: result.event_id,
        evidence: {
          taskId: result.task_id,
          objectiveId: result.objective_id,
          objectiveSlug: result.objective_slug,
          eventId: result.event_id,
          eventType: "task_objective_assigned",
        },
      };
    },
  };
}
