import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateNoteInput,
  CreateNoteResult,
  ListNotesInput,
  ListNotesResult,
  SearchNotesInput,
  SearchNotesResult,
  NotesRepository,
  NoteRecord,
} from "../contracts/notes.js";

interface RpcResult {
  note_id: string;
  event_id: string;
  trace_id: string;
  schema_version: string;
}

function toNoteRecord(row: Record<string, unknown>): NoteRecord {
  return {
    id: String(row.id),
    content: String(row.content ?? ""),
    noteType: row.note_type as NoteRecord["noteType"],
    source: String(row.source ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    createdAt: String(row.created_at ?? ""),
  };
}

export function createNotesStore(supabase: SupabaseClient): NotesRepository {
  return {
    async createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
      const { data, error } = await supabase.rpc("sara_create_note", {
        p_trace_id: input.traceId,
        p_content: input.content,
        p_note_type: input.noteType,
        p_source: input.source,
        p_area_id: input.areaId ?? null,
        p_related_entity_type: input.relatedEntityType ?? null,
        p_related_entity_id: input.relatedEntityId ?? null,
        p_tags: input.tags,
      });

      if (error) {
        return {
          schemaVersion: "notes_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: error.message,
        };
      }

      const result = data as RpcResult;

      return {
        schemaVersion: "notes_create_result.v1",
        traceId: input.traceId,
        status: "created",
        noteId: result.note_id,
        eventId: result.event_id,
        evidence: {
          noteId: result.note_id,
          eventId: result.event_id,
          eventType: "note_created",
        },
      };
    },

    async listNotes(input: ListNotesInput): Promise<ListNotesResult> {
      try {
        let query = supabase.from("sara_notes").select("*").order("created_at", { ascending: false }).limit(input.limit ?? 5);

        if (input.noteType) {
          query = query.eq("note_type", input.noteType);
        }

        const { data, error } = await query;

        if (error) {
          return {
            schemaVersion: "notes_list_result.v1",
            traceId: input.traceId,
            status: "failed",
            notes: [],
            count: 0,
            error: error.message,
          };
        }

        const notes = (data as Record<string, unknown>[]).map(toNoteRecord);
        return {
          schemaVersion: "notes_list_result.v1",
          traceId: input.traceId,
          status: "success",
          notes,
          count: notes.length,
        };
      } catch (err) {
        return {
          schemaVersion: "notes_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          notes: [],
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async searchNotes(input: SearchNotesInput): Promise<SearchNotesResult> {
      try {
        let query = supabase
          .from("sara_notes")
          .select("*")
          .ilike("content", `%${input.query}%`)
          .order("created_at", { ascending: false })
          .limit(input.limit ?? 5);

        if (input.noteType) {
          query = query.eq("note_type", input.noteType);
        }

        const { data, error } = await query;

        if (error) {
          return {
            schemaVersion: "notes_search_result.v1",
            traceId: input.traceId,
            status: "failed",
            query: input.query,
            notes: [],
            count: 0,
            error: error.message,
          };
        }

        const notes = (data as Record<string, unknown>[]).map(toNoteRecord);
        return {
          schemaVersion: "notes_search_result.v1",
          traceId: input.traceId,
          status: "success",
          query: input.query,
          notes,
          count: notes.length,
        };
      } catch (err) {
        return {
          schemaVersion: "notes_search_result.v1",
          traceId: input.traceId,
          status: "failed",
          query: input.query,
          notes: [],
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
