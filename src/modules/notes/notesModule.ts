import type { CreateNoteInput, CreateNoteResult, NotesRepository } from "../../contracts/notes.js";
import { isValidNoteType } from "../../contracts/notes.js";

export interface NotesModule {
  create(input: CreateNoteInput): Promise<CreateNoteResult>;
}

export function createNotesModule(repository: NotesRepository): NotesModule {
  return {
    async create(input) {
      if (!input.content || input.content.trim().length === 0) {
        return {
          schemaVersion: "notes_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "content cannot be empty",
        };
      }

      if (!isValidNoteType(input.noteType)) {
        return {
          schemaVersion: "notes_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: `invalid noteType: ${input.noteType}`,
        };
      }

      return repository.createNote(input);
    },
  };
}
