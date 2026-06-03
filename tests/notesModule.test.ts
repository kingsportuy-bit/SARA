import { describe, expect, it } from "vitest";
import { createNotesModule } from "../src/modules/notes/notesModule.js";
import type {
  CreateNoteInput,
  CreateNoteResult,
  ListNotesInput,
  ListNotesResult,
  SearchNotesInput,
  SearchNotesResult,
  NotesRepository,
  NoteRecord,
} from "../src/contracts/notes.js";

function fakeRepo(): NotesRepository {
  return {
    async createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
      return {
        schemaVersion: "notes_create_result.v1",
        traceId: input.traceId,
        status: "created",
        noteId: "note-uuid-1",
        eventId: "event-uuid-1",
        evidence: { noteId: "note-uuid-1", eventId: "event-uuid-1", eventType: "note_created" },
      };
    },
    async listNotes(input: ListNotesInput): Promise<ListNotesResult> {
      return {
        schemaVersion: "notes_list_result.v1",
        traceId: input.traceId,
        status: "success",
        notes: [
          { id: "n1", content: "primera nota", noteType: "observacion", source: "chatwoot", tags: [], createdAt: "2026-06-01T00:00:00Z" },
          { id: "n2", content: "segunda nota", noteType: "idea", source: "manual", tags: ["test"], createdAt: "2026-06-02T00:00:00Z" },
        ],
        count: 2,
      };
    },
    async searchNotes(input: SearchNotesInput): Promise<SearchNotesResult> {
      return {
        schemaVersion: "notes_search_result.v1",
        traceId: input.traceId,
        status: "success",
        query: input.query,
        notes: [
          { id: "n3", content: "nota sobre foco", noteType: "aprendizaje", source: "chatwoot", tags: [], createdAt: "2026-06-03T00:00:00Z" },
        ],
        count: 1,
      };
    },
  };
}

describe("notesModule.create", () => {
  it("creates a note with valid input", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const result = await mod.create({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-1",
      content: "recordar que dormir poco me baja mucho el foco",
      noteType: "aprendizaje",
      source: "chatwoot",
      tags: [],
    });

    expect(result.status).toBe("created");
    expect(result.noteId).toBe("note-uuid-1");
    expect(result.eventId).toBe("event-uuid-1");
    expect(result.evidence.noteId).toBe("note-uuid-1");
    expect(result.evidence.eventId).toBe("event-uuid-1");
    expect(result.evidence.eventType).toBe("note_created");
  });

  it("rejects empty content", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const result = await mod.create({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-2",
      content: "",
      noteType: "observacion",
      source: "chatwoot",
      tags: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("content cannot be empty");
    expect(result.noteId).toBeUndefined();
    expect(result.eventId).toBeUndefined();
  });

  it("rejects whitespace-only content", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const result = await mod.create({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-3",
      content: "   ",
      noteType: "observacion",
      source: "chatwoot",
      tags: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("content cannot be empty");
  });

  it("rejects invalid noteType", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const result = await mod.create({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-4",
      content: "algo",
      noteType: "invalido" as any,
      source: "chatwoot",
      tags: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("invalid noteType");
  });

  it("accepts all valid note types", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const types = ["aprendizaje", "idea", "problema", "riesgo", "mejora", "observacion"] as const;

    for (const noteType of types) {
      const result = await mod.create({
        schemaVersion: "notes_create_input.v1",
        traceId: "trace-5",
        content: `nota de tipo ${noteType}`,
        noteType,
        source: "chatwoot",
        tags: [],
      });
      expect(result.status).toBe("created");
    }
  });

  it("returns failed when repository throws", async () => {
    const repo: NotesRepository = {
      async createNote() {
        return {
          schemaVersion: "notes_create_result.v1",
          traceId: "trace-6",
          status: "failed",
          evidence: {},
          error: "DB error",
        };
      },
    } as NotesRepository;
    const mod = createNotesModule(repo);
    const result = await mod.create({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-6",
      content: "contenido valido",
      noteType: "idea",
      source: "manual",
      tags: ["test"],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });

  it("passes all fields to the repository", async () => {
    let captured: CreateNoteInput | undefined;
    const repo: NotesRepository = {
      async createNote(input) {
        captured = input;
        return {
          schemaVersion: "notes_create_result.v1",
          traceId: input.traceId,
          status: "created",
          noteId: "n1",
          eventId: "e1",
          evidence: { noteId: "n1", eventId: "e1", eventType: "note_created" },
        };
      },
    } as NotesRepository;
    const mod = createNotesModule(repo);
    await mod.create({
      schemaVersion: "notes_create_input.v1",
      traceId: "trace-7",
      content: "contenido",
      noteType: "riesgo",
      source: "system",
      areaId: "area-1",
      relatedEntityType: "plan",
      relatedEntityId: "plan-1",
      tags: ["urgente", "finanzas"],
    });

    expect(captured).toBeDefined();
    expect(captured!.content).toBe("contenido");
    expect(captured!.noteType).toBe("riesgo");
    expect(captured!.source).toBe("system");
    expect(captured!.areaId).toBe("area-1");
    expect(captured!.relatedEntityType).toBe("plan");
    expect(captured!.relatedEntityId).toBe("plan-1");
    expect(captured!.tags).toEqual(["urgente", "finanzas"]);
  });
});

describe("notesModule.list", () => {
  it("returns notes from repository with schema version", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const result = await mod.list({
      schemaVersion: "notes_list_input.v1",
      traceId: "trace-l1",
    });

    expect(result.schemaVersion).toBe("notes_list_result.v1");
    expect(result.status).toBe("success");
    expect(result.notes).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.notes[0].noteType).toBe("observacion");
    expect(result.notes[1].noteType).toBe("idea");
  });

  it("passes limit parameter to repository", async () => {
    let captured: ListNotesInput | undefined;
    const repo: NotesRepository = {
      async listNotes(input) {
        captured = input;
        return {
          schemaVersion: "notes_list_result.v1",
          traceId: input.traceId,
          status: "success",
          notes: [],
          count: 0,
        };
      },
    } as NotesRepository;
    const mod = createNotesModule(repo);
    await mod.list({
      schemaVersion: "notes_list_input.v1",
      traceId: "trace-l2",
      limit: 3,
    });

    expect(captured!.limit).toBe(3);
  });

  it("propagates repository failure", async () => {
    const repo: NotesRepository = {
      async listNotes(input) {
        return {
          schemaVersion: "notes_list_result.v1",
          traceId: input.traceId,
          status: "failed",
          notes: [],
          count: 0,
          error: "DB error",
        };
      },
    } as NotesRepository;
    const mod = createNotesModule(repo);
    const result = await mod.list({
      schemaVersion: "notes_list_input.v1",
      traceId: "trace-l3",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DB error");
  });
});

describe("notesModule.search", () => {
  it("returns search results from repository with schema version", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const result = await mod.search({
      schemaVersion: "notes_search_input.v1",
      traceId: "trace-s1",
      query: "foco",
    });

    expect(result.schemaVersion).toBe("notes_search_result.v1");
    expect(result.status).toBe("success");
    expect(result.notes).toHaveLength(1);
    expect(result.count).toBe(1);
    expect(result.query).toBe("foco");
  });

  it("rejects empty query", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const result = await mod.search({
      schemaVersion: "notes_search_input.v1",
      traceId: "trace-s2",
      query: "",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("query cannot be empty");
  });

  it("rejects whitespace-only query", async () => {
    const repo = fakeRepo();
    const mod = createNotesModule(repo);
    const result = await mod.search({
      schemaVersion: "notes_search_input.v1",
      traceId: "trace-s3",
      query: "   ",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("query cannot be empty");
  });

  it("passes limit and query parameters to repository", async () => {
    let captured: SearchNotesInput | undefined;
    const repo: NotesRepository = {
      async searchNotes(input) {
        captured = input;
        return {
          schemaVersion: "notes_search_result.v1",
          traceId: input.traceId,
          status: "success",
          query: input.query,
          notes: [],
          count: 0,
        };
      },
    } as NotesRepository;
    const mod = createNotesModule(repo);
    await mod.search({
      schemaVersion: "notes_search_input.v1",
      traceId: "trace-s4",
      query: "dormir",
      limit: 10,
    });

    expect(captured!.query).toBe("dormir");
    expect(captured!.limit).toBe(10);
  });

  it("returns empty results when no matches found", async () => {
    const repo: NotesRepository = {
      async searchNotes(input) {
        return {
          schemaVersion: "notes_search_result.v1",
          traceId: input.traceId,
          status: "success",
          query: input.query,
          notes: [],
          count: 0,
        };
      },
    } as NotesRepository;
    const mod = createNotesModule(repo);
    const result = await mod.search({
      schemaVersion: "notes_search_input.v1",
      traceId: "trace-s5",
      query: "noexiste",
    });

    expect(result.status).toBe("success");
    expect(result.count).toBe(0);
    expect(result.notes).toEqual([]);
  });
});
