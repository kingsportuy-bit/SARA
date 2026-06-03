export type NoteType =
  | "aprendizaje"
  | "idea"
  | "problema"
  | "riesgo"
  | "mejora"
  | "observacion";

export const VALID_NOTE_TYPES: readonly NoteType[] = [
  "aprendizaje",
  "idea",
  "problema",
  "riesgo",
  "mejora",
  "observacion",
] as const;

export function isValidNoteType(value: string): value is NoteType {
  return (VALID_NOTE_TYPES as readonly string[]).includes(value);
}

export interface CreateNoteInput {
  schemaVersion: "notes_create_input.v1";
  traceId: string;
  content: string;
  noteType: NoteType;
  source: "chatwoot" | "manual" | "system";
  areaId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  tags: string[];
}

export interface CreateNoteResult {
  schemaVersion: "notes_create_result.v1";
  traceId: string;
  status: "created" | "failed";
  noteId?: string;
  eventId?: string;
  evidence: {
    noteId?: string;
    eventId?: string;
    eventType?: "note_created";
  };
  error?: string;
}

export interface NoteRecord {
  id: string;
  content: string;
  noteType: NoteType;
  source: string;
  tags: string[];
  createdAt: string;
}

export interface ListNotesInput {
  schemaVersion: "notes_list_input.v1";
  traceId: string;
  limit?: number;
  noteType?: NoteType;
}

export interface ListNotesResult {
  schemaVersion: "notes_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  notes: NoteRecord[];
  count: number;
  error?: string;
}

export interface SearchNotesInput {
  schemaVersion: "notes_search_input.v1";
  traceId: string;
  query: string;
  limit?: number;
  noteType?: NoteType;
}

export interface SearchNotesResult {
  schemaVersion: "notes_search_result.v1";
  traceId: string;
  status: "success" | "failed";
  query: string;
  notes: NoteRecord[];
  count: number;
  error?: string;
}

export interface NotesRepository {
  createNote(input: CreateNoteInput): Promise<CreateNoteResult>;
  listNotes(input: ListNotesInput): Promise<ListNotesResult>;
  searchNotes(input: SearchNotesInput): Promise<SearchNotesResult>;
}
