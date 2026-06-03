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
    from: (table: string) => {
      if (table !== "sara_notes") throw new Error("unknown table");
      let lastFilter: string | null = null;
      let lastValue: string | null = null;
      return {
        select: () => ({
          eq: (col: string, val: string) => { lastFilter = col; lastValue = val; return {
            order: () => ({
              limit: () => ({
                data: [
                  { id: "n1", content: "nota 1", note_type: "observacion", source: "chatwoot", tags: [], created_at: "2026-01-01T00:00:00Z" },
                  { id: "n2", content: "nota 2", note_type: "idea", source: "manual", tags: ["t1"], created_at: "2026-01-02T00:00:00Z" },
                ],
                error: null,
              }),
            }),
          }; },
          order: () => ({
            limit: () => ({
              data: [
                { id: "n1", content: "nota 1", note_type: "observacion", source: "chatwoot", tags: [], created_at: "2026-01-01T00:00:00Z" },
                { id: "n2", content: "nota 2", note_type: "idea", source: "manual", tags: ["t1"], created_at: "2026-01-02T00:00:00Z" },
              ],
              error: null,
            }),
          }),
          ilike: () => ({
            order: () => ({
              limit: () => ({
                data: [
                  { id: "n1", content: "nota match", note_type: "observacion", source: "chatwoot", tags: [], created_at: "2026-01-01T00:00:00Z" },
                ],
                error: null,
              }),
            }),
          }),
        }),
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

describe("notesStore listNotes", () => {
  it("queries sara_notes and returns notes", async () => {
    const sb = fakeSupabase();
    const store = createNotesStore(sb);
    const result = await store.listNotes({
      schemaVersion: "notes_list_input.v1",
      traceId: "trace-list-1",
    });

    expect(result.schemaVersion).toBe("notes_list_result.v1");
    expect(result.status).toBe("success");
    expect(result.notes).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.notes[0].id).toBe("n1");
    expect(result.notes[0].noteType).toBe("observacion");
  });

  it("maps note_type and created_at correctly", async () => {
    const sb = fakeSupabase();
    const store = createNotesStore(sb);
    const result = await store.listNotes({
      schemaVersion: "notes_list_input.v1",
      traceId: "trace-list-2",
    });

    expect(result.notes[1].noteType).toBe("idea");
    expect(result.notes[1].source).toBe("manual");
    expect(result.notes[1].tags).toEqual(["t1"]);
    expect(result.notes[1].createdAt).toBe("2026-01-02T00:00:00Z");
  });
});

describe("notesStore searchNotes", () => {
  it("queries sara_notes with ilike and returns matching notes", async () => {
    const sb = fakeSupabase();
    const store = createNotesStore(sb);
    const result = await store.searchNotes({
      schemaVersion: "notes_search_input.v1",
      traceId: "trace-search-1",
      query: "match",
    });

    expect(result.schemaVersion).toBe("notes_search_result.v1");
    expect(result.status).toBe("success");
    expect(result.notes).toHaveLength(1);
    expect(result.count).toBe(1);
    expect(result.query).toBe("match");
  });
});
