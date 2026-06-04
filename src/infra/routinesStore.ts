import type { SupabaseClient } from "@supabase/supabase-js";
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
  RoutineRecord,
  RoutineStepRecord,
  RoutineStatus,
} from "../contracts/routines.js";

interface CreateRoutineRpcResult {
  routine_id: string;
  event_id: string;
  name: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ActivateRoutineRpcResult {
  routine_id: string;
  event_id: string;
  name: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface PauseRoutineRpcResult {
  routine_id: string;
  event_id: string;
  name: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ArchiveRoutineRpcResult {
  routine_id: string;
  event_id: string;
  name: string;
  slug: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface RpcStep {
  id: string;
  position: number;
  time_of_day: string | null;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

interface RpcRoutineRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  area_id: string | null;
  objective_id: string | null;
  schedule: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  paused_at: string | null;
  archived_at: string | null;
  steps: RpcStep[];
}

interface ListRoutinesRpcResult {
  routines: RpcRoutineRow[];
  count: number;
  status: string;
}

function toRoutineStep(step: RpcStep): RoutineStepRecord {
  return {
    id: String(step.id),
    position: Number(step.position),
    timeOfDay: step.time_of_day ?? undefined,
    title: String(step.title ?? ""),
    description: step.description ?? undefined,
    durationMinutes: step.duration_minutes ?? undefined,
    createdAt: String(step.created_at ?? ""),
    updatedAt: String(step.updated_at ?? ""),
  };
}

function toRoutineRecord(row: RpcRoutineRow): RoutineRecord {
  const steps = Array.isArray(row.steps) ? row.steps.map(toRoutineStep) : [];
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    status: (row.status ?? "draft") as RoutineStatus,
    areaId: row.area_id != null ? String(row.area_id) : undefined,
    objectiveId: row.objective_id != null ? String(row.objective_id) : undefined,
    schedule: row.schedule ?? {},
    steps,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    activatedAt: row.activated_at != null ? String(row.activated_at) : undefined,
    pausedAt: row.paused_at != null ? String(row.paused_at) : undefined,
    archivedAt: row.archived_at != null ? String(row.archived_at) : undefined,
  };
}

export function createRoutinesStore(supabase: SupabaseClient): RoutinesRepository {
  return {
    async createRoutine(input: CreateRoutineInput): Promise<CreateRoutineResult> {
      const stepsJson = input.steps
        ? input.steps.map((s) => ({
            position: s.position,
            time_of_day: s.timeOfDay ?? null,
            title: s.title,
            description: s.description ?? null,
            duration_minutes: s.durationMinutes ?? null,
            metadata: {},
          }))
        : [];

      const { data, error } = await supabase.rpc("sara_create_routine", {
        p_trace_id: input.traceId,
        p_name: input.name,
        p_slug: input.slug,
        p_description: input.description ?? null,
        p_area_id: input.areaId ?? null,
        p_area_slug: input.areaSlug ?? null,
        p_steps: stepsJson,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "routines_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CreateRoutineRpcResult;

      if (result.error) {
        return {
          schemaVersion: "routines_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "routines_create_result.v1",
        traceId: input.traceId,
        status: "created",
        routineId: result.routine_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        evidence: {
          routineId: result.routine_id,
          eventId: result.event_id,
          eventType: "routine_created",
        },
      };
    },

    async listRoutines(input: ListRoutinesInput): Promise<ListRoutinesResult> {
      try {
        const { data, error } = await supabase.rpc("sara_list_routines", {
          p_status: input.status ?? null,
          p_limit: input.limit ?? 10,
        });

        if (error) {
          return {
            schemaVersion: "routines_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            routines: [],
            count: 0,
            error: error.message,
          };
        }

        const result = data as unknown as ListRoutinesRpcResult;

        if (result.status !== "success") {
          return {
            schemaVersion: "routines_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            routines: [],
            count: 0,
            error: "list routines RPC failed",
          };
        }

        const routines = (result.routines || []).map(toRoutineRecord);
        return {
          schemaVersion: "routines_list_result.v1",
          traceId: input.traceId,
          status: "success",
          routines,
          count: result.count ?? routines.length,
        };
      } catch (err) {
        return {
          schemaVersion: "routines_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          routines: [],
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async activateRoutine(input: ActivateRoutineInput): Promise<ActivateRoutineResult> {
      const { data, error } = await supabase.rpc("sara_activate_routine", {
        p_trace_id: input.traceId,
        p_routine_id: input.routineId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "routines_activate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as ActivateRoutineRpcResult;

      if (result.error) {
        return {
          schemaVersion: "routines_activate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "routines_activate_result.v1",
        traceId: input.traceId,
        status: "activated",
        routineId: result.routine_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        evidence: {
          routineId: result.routine_id,
          eventId: result.event_id,
          eventType: "routine_activated",
        },
      };
    },

    async pauseRoutine(input: PauseRoutineInput): Promise<PauseRoutineResult> {
      const { data, error } = await supabase.rpc("sara_pause_routine", {
        p_trace_id: input.traceId,
        p_routine_id: input.routineId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "routines_pause_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as PauseRoutineRpcResult;

      if (result.error) {
        return {
          schemaVersion: "routines_pause_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "routines_pause_result.v1",
        traceId: input.traceId,
        status: "paused",
        routineId: result.routine_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        evidence: {
          routineId: result.routine_id,
          eventId: result.event_id,
          eventType: "routine_paused",
        },
      };
    },

    async archiveRoutine(input: ArchiveRoutineInput): Promise<ArchiveRoutineResult> {
      const { data, error } = await supabase.rpc("sara_archive_routine", {
        p_trace_id: input.traceId,
        p_routine_id: input.routineId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "routines_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as ArchiveRoutineRpcResult;

      if (result.error) {
        return {
          schemaVersion: "routines_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "routines_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        routineId: result.routine_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        evidence: {
          routineId: result.routine_id,
          eventId: result.event_id,
          eventType: "routine_archived",
        },
      };
    },
  };
}
