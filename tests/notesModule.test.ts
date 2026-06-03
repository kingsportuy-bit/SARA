import { describe, expect, it } from "vitest";
import { createNotesModule } from "../src/modules/notes/notesModule.js";
import type { CreateNoteInput, CreateNoteResult, NotesRepository } from "../src/contracts/notes.js";

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
    };
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
    };
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
