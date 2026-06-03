import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateNoteInput, CreateNoteResult, NotesRepository } from "../contracts/notes.js";

interface RpcResult {
  note_id: string;
  event_id: string;
  trace_id: string;
  schema_version: string;
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
  };
}
