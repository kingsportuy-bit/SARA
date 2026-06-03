import type {
  CreateNoteInput,
  CreateNoteResult,
  ListNotesInput,
  ListNotesResult,
  SearchNotesInput,
  SearchNotesResult,
  NotesRepository,
} from "../../contracts/notes.js";
import { isValidNoteType } from "../../contracts/notes.js";

export interface NotesModule {
  create(input: CreateNoteInput): Promise<CreateNoteResult>;
  list(input: ListNotesInput): Promise<ListNotesResult>;
  search(input: SearchNotesInput): Promise<SearchNotesResult>;
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

    async list(input) {
      return repository.listNotes(input);
    },

    async search(input) {
      if (!input.query || input.query.trim().length === 0) {
        return {
          schemaVersion: "notes_search_result.v1",
          traceId: input.traceId,
          status: "failed",
          query: input.query,
          notes: [],
          count: 0,
          error: "query cannot be empty",
        };
      }
      return repository.searchNotes(input);
    },
  };
}
