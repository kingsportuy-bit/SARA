import type { SupabaseClient } from "@supabase/supabase-js";
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
  AreaRecord,
  AreaStatus,
} from "../contracts/areas.js";

interface CreateAreaRpcResult {
  area_id: string;
  event_id: string;
  name: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ArchiveAreaRpcResult {
  area_id: string;
  event_id: string;
  name: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface AssignNoteAreaRpcResult {
  note_id: string;
  area_id: string;
  area_name: string;
  event_id: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface AssignTaskAreaRpcResult {
  task_id: string;
  title: string;
  area_id: string;
  area_name: string;
  event_id: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

function toAreaRecord(row: Record<string, unknown>): AreaRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    status: (row.status ?? "active") as AreaStatus,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function createAreasStore(supabase: SupabaseClient): AreasRepository {
  return {
    async createArea(input: CreateAreaInput): Promise<CreateAreaResult> {
      const { data, error } = await supabase.rpc("sara_create_area", {
        p_trace_id: input.traceId,
        p_name: input.name,
        p_slug: input.slug,
        p_description: input.description ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "areas_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CreateAreaRpcResult;

      if (result.error) {
        return {
          schemaVersion: "areas_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "areas_create_result.v1",
        traceId: input.traceId,
        status: "created",
        areaId: result.area_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        evidence: {
          areaId: result.area_id,
          eventId: result.event_id,
          eventType: "area_created",
        },
      };
    },

    async listAreas(input: ListAreasInput): Promise<ListAreasResult> {
      try {
        const statusFilter = input.status ?? "active";
        let query = supabase
          .from("sara_areas")
          .select("*")
          .eq("status", statusFilter)
          .order("name", { ascending: true })
          .limit(input.limit ?? 10);

        const { data, error } = await query;

        if (error) {
          return {
            schemaVersion: "areas_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            areas: [],
            count: 0,
            error: error.message,
          };
        }

        const areas = (data as Record<string, unknown>[]).map(toAreaRecord);
        return {
          schemaVersion: "areas_list_result.v1",
          traceId: input.traceId,
          status: "success",
          areas,
          count: areas.length,
        };
      } catch (err) {
        return {
          schemaVersion: "areas_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          areas: [],
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async archiveArea(input: ArchiveAreaInput): Promise<ArchiveAreaResult> {
      const { data, error } = await supabase.rpc("sara_archive_area", {
        p_trace_id: input.traceId,
        p_area_id: input.areaId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "areas_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as ArchiveAreaRpcResult;

      if (result.error) {
        return {
          schemaVersion: "areas_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "areas_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        areaId: result.area_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        evidence: {
          areaId: result.area_id,
          eventId: result.event_id,
          eventType: "area_archived",
        },
      };
    },

    async assignNoteArea(input: AssignNoteAreaInput): Promise<AssignNoteAreaResult> {
      const { data, error } = await supabase.rpc("sara_assign_note_area", {
        p_trace_id: input.traceId,
        p_note_id: input.noteId,
        p_area_id: input.areaId ?? null,
        p_area_slug: input.areaSlug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "areas_assign_note_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as AssignNoteAreaRpcResult;

      if (result.error) {
        return {
          schemaVersion: "areas_assign_note_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "areas_assign_note_result.v1",
        traceId: input.traceId,
        status: "assigned",
        noteId: result.note_id,
        areaId: result.area_id,
        areaName: result.area_name,
        eventId: result.event_id,
        evidence: {
          noteId: result.note_id,
          areaId: result.area_id,
          eventId: result.event_id,
          eventType: "note_area_assigned",
        },
      };
    },

    async assignTaskArea(input: AssignTaskAreaInput): Promise<AssignTaskAreaResult> {
      const { data, error } = await supabase.rpc("sara_assign_task_area", {
        p_trace_id: input.traceId,
        p_task_id: input.taskId,
        p_area_id: input.areaId ?? null,
        p_area_slug: input.areaSlug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "areas_assign_task_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as AssignTaskAreaRpcResult;

      if (result.error) {
        return {
          schemaVersion: "areas_assign_task_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "areas_assign_task_result.v1",
        traceId: input.traceId,
        status: "assigned",
        taskId: result.task_id,
        title: result.title,
        areaId: result.area_id,
        areaName: result.area_name,
        eventId: result.event_id,
        evidence: {
          taskId: result.task_id,
          areaId: result.area_id,
          eventId: result.event_id,
          eventType: "task_area_assigned",
        },
      };
    },
  };
}
