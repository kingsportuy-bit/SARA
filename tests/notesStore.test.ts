import { describe, expect, it } from "vitest";
import { createNotesStore } from "../src/infra/notesStore.js";
import type { CreateNoteInput } from "../src/contracts/notes.js";

function fakeSupabase() {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      if (fn !== "sara_create_note") {
        return { data: null, error: new Error("unknown rpc") };
      }
      if (!params.p_content || String(params.p_content).trim() === "") {
        return { data: null, error: new Error("content cannot be empty") };
      }
      if (params.p_note_type === "invalid") {
        return { data: null, error: new Error("invalid note_type: invalid") };
      }
      return {
        data: {
          note_id: "note-uuid-rpc",
          event_id: "event-uuid-rpc",
          trace_id: params.p_trace_id,
          schema_version: "notes_create_result.v1",
        },
        error: null,
      };
    },
  } as any;
}

describe("notesStore", () => {
  it("calls sara_create_note with correct parameters", async () => {
    const sb = fakeSupabase();
    const store = createNotesStore(sb);
    const result = await store.createNote({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-rpc-1",
      content: "nota de prueba",
      noteType: "idea",
      source: "chatwoot",
      tags: [],
    });

    expect(result.status).toBe("created");
    expect(result.noteId).toBe("note-uuid-rpc");
    expect(result.eventId).toBe("event-uuid-rpc");
    expect(result.evidence.eventType).toBe("note_created");
  });

  it("returns failed on rpc error", async () => {
    const sb = fakeSupabase();
    const store = createNotesStore(sb);
    const result = await store.createNote({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-rpc-2",
      content: "",
      noteType: "observacion",
      source: "chatwoot",
      tags: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
  });

  it("passes optional fields as null when undefined", async () => {
    let capturedParams: Record<string, unknown> | undefined;
    const sb = {
      rpc: async (_fn: string, params: Record<string, unknown>) => {
        capturedParams = params;
        return {
          data: {
            note_id: "n1",
            event_id: "e1",
            trace_id: params.p_trace_id,
            schema_version: "notes_create_result.v1",
          },
          error: null,
        };
      },
    } as any;

    const store = createNotesStore(sb);
    await store.createNote({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-rpc-3",
      content: "nota simple",
      noteType: "observacion",
      source: "manual",
      tags: [],
    });

    expect(capturedParams).toBeDefined();
    expect(capturedParams!.p_area_id).toBeNull();
    expect(capturedParams!.p_related_entity_type).toBeNull();
    expect(capturedParams!.p_related_entity_id).toBeNull();
  });
});
