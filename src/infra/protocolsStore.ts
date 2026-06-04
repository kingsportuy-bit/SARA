import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateProtocolInput,
  CreateProtocolResult,
  ListProtocolsInput,
  ListProtocolsResult,
  ActivateProtocolInput,
  ActivateProtocolResult,
  ArchiveProtocolInput,
  ArchiveProtocolResult,
  EvaluateProtocolInput,
  EvaluateProtocolResult,
  ProtocolsRepository,
  ProtocolRecord,
  ProtocolStatus,
  ProtocolScope,
  ProtocolRule,
} from "../contracts/protocols.js";

interface CreateProtocolRpcResult {
  protocol_id: string;
  event_id: string;
  name: string;
  slug: string;
  scope: string;
  status: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ActivateProtocolRpcResult {
  protocol_id: string;
  event_id: string;
  name: string;
  slug: string;
  scope: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface ArchiveProtocolRpcResult {
  protocol_id: string;
  event_id: string;
  name: string;
  slug: string;
  scope: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

interface EvaluateProtocolRpcResult {
  protocol_id: string;
  event_id: string;
  name: string;
  slug: string;
  scope: string;
  status: string;
  trace_id: string;
  schema_version: string;
  error?: string;
}

function toProtocolRecord(row: Record<string, unknown>): ProtocolRecord {
  const rules = Array.isArray(row.rules)
    ? (row.rules as unknown[]).map((r) => {
        const rule = r as Record<string, unknown>;
        return {
          condition: String(rule.condition ?? ""),
          action: String(rule.action ?? ""),
        };
      })
    : [];
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    status: (row.status ?? "draft") as ProtocolStatus,
    scope: (row.scope ?? "general") as ProtocolScope,
    rules,
    description: row.description != null ? String(row.description) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    activatedAt: row.activated_at != null ? String(row.activated_at) : undefined,
    archivedAt: row.archived_at != null ? String(row.archived_at) : undefined,
  };
}

export function createProtocolsStore(supabase: SupabaseClient): ProtocolsRepository {
  return {
    async createProtocol(input: CreateProtocolInput): Promise<CreateProtocolResult> {
      const { data, error } = await supabase.rpc("sara_create_protocol", {
        p_trace_id: input.traceId,
        p_name: input.name,
        p_slug: input.slug,
        p_scope: input.scope,
        p_rules: input.rules,
        p_description: input.description ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "protocols_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as CreateProtocolRpcResult;

      if (result.error) {
        return {
          schemaVersion: "protocols_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "protocols_create_result.v1",
        traceId: input.traceId,
        status: "created",
        protocolId: result.protocol_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        scope: result.scope,
        evidence: {
          protocolId: result.protocol_id,
          eventId: result.event_id,
          eventType: "protocol_created",
        },
      };
    },

    async listProtocols(input: ListProtocolsInput): Promise<ListProtocolsResult> {
      try {
        const statusFilter = input.status ?? "active";
        let query = supabase
          .from("sara_protocols")
          .select("*")
          .eq("status", statusFilter)
          .order("created_at", { ascending: false })
          .limit(input.limit ?? 20);

        if (input.scope) {
          query = query.eq("scope", input.scope);
        }

        const { data, error } = await query;

        if (error) {
          return {
            schemaVersion: "protocols_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            protocols: [],
            count: 0,
            error: error.message,
          };
        }

        const protocols = (data as Record<string, unknown>[]).map(toProtocolRecord);

        return {
          schemaVersion: "protocols_list_result.v1",
          traceId: input.traceId,
          status: "success",
          protocols,
          count: protocols.length,
        };
      } catch (err) {
        return {
          schemaVersion: "protocols_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          protocols: [],
          count: 0,
          error: String(err),
        };
      }
    },

    async activateProtocol(input: ActivateProtocolInput): Promise<ActivateProtocolResult> {
      const { data, error } = await supabase.rpc("sara_activate_protocol", {
        p_trace_id: input.traceId,
        p_protocol_id: input.protocolId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "protocols_activate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as ActivateProtocolRpcResult;

      if (result.error) {
        return {
          schemaVersion: "protocols_activate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "protocols_activate_result.v1",
        traceId: input.traceId,
        status: "activated",
        protocolId: result.protocol_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        scope: result.scope,
        evidence: {
          protocolId: result.protocol_id,
          eventId: result.event_id,
          eventType: "protocol_activated",
        },
      };
    },

    async archiveProtocol(input: ArchiveProtocolInput): Promise<ArchiveProtocolResult> {
      const { data, error } = await supabase.rpc("sara_archive_protocol", {
        p_trace_id: input.traceId,
        p_protocol_id: input.protocolId ?? null,
        p_slug: input.slug ?? null,
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "protocols_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as ArchiveProtocolRpcResult;

      if (result.error) {
        return {
          schemaVersion: "protocols_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: result.error,
        };
      }

      return {
        schemaVersion: "protocols_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        protocolId: result.protocol_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        scope: result.scope,
        evidence: {
          protocolId: result.protocol_id,
          eventId: result.event_id,
          eventType: "protocol_archived",
        },
      };
    },

    async evaluateProtocol(input: EvaluateProtocolInput): Promise<EvaluateProtocolResult> {
      const { data, error } = await supabase.rpc("sara_log_protocol_evaluation", {
        p_trace_id: input.traceId,
        p_protocol_id: input.protocolId ?? null,
        p_slug: input.slug ?? null,
        p_evidence: input.context.evidence ?? input.context,
        p_suggestions: input.context.suggestions ?? [],
        p_source: input.source,
      });

      if (error) {
        return {
          schemaVersion: "protocols_evaluate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {
            rulesCount: 0,
            rulesMatched: 0,
          },
          suggestions: [],
          error: error.message,
        };
      }

      const result = data as EvaluateProtocolRpcResult;

      if (result.error) {
        return {
          schemaVersion: "protocols_evaluate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {
            rulesCount: 0,
            rulesMatched: 0,
          },
          suggestions: [],
          error: result.error,
        };
      }

      const rulesCount = typeof input.context.rulesEvaluated === "number" ? input.context.rulesEvaluated : 0;
      const rulesMatched = typeof input.context.rulesMatched === "number" ? input.context.rulesMatched : 0;

      return {
        schemaVersion: "protocols_evaluate_result.v1",
        traceId: input.traceId,
        status: "evaluated",
        protocolId: result.protocol_id,
        eventId: result.event_id,
        name: result.name,
        slug: result.slug,
        scope: result.scope,
        suggestions: input.context.suggestions as EvaluateProtocolResult["suggestions"] ?? [],
        evidence: {
          protocolId: result.protocol_id,
          eventId: result.event_id,
          eventType: "protocol_evaluated",
          rulesCount,
          rulesMatched,
        },
      };
    },
  };
}
