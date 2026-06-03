export type AreaStatus = "active" | "paused" | "archived";

export interface AreaRecord {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: AreaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAreaInput {
  schemaVersion: "areas_create_input.v1";
  traceId: string;
  name: string;
  slug: string;
  description?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface CreateAreaResult {
  schemaVersion: "areas_create_result.v1";
  traceId: string;
  status: "created" | "failed";
  areaId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  evidence: {
    areaId?: string;
    eventId?: string;
    eventType?: "area_created";
  };
  error?: string;
}

export interface ListAreasInput {
  schemaVersion: "areas_list_input.v1";
  traceId: string;
  status?: AreaStatus;
  limit?: number;
}

export interface ListAreasResult {
  schemaVersion: "areas_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  areas: AreaRecord[];
  count: number;
  error?: string;
}

export interface ArchiveAreaInput {
  schemaVersion: "areas_archive_input.v1";
  traceId: string;
  areaId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface ArchiveAreaResult {
  schemaVersion: "areas_archive_result.v1";
  traceId: string;
  status: "archived" | "failed";
  areaId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  evidence: {
    areaId?: string;
    eventId?: string;
    eventType?: "area_archived";
  };
  error?: string;
}

export interface AssignNoteAreaInput {
  schemaVersion: "areas_assign_note_input.v1";
  traceId: string;
  noteId: string;
  areaId?: string;
  areaSlug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface AssignNoteAreaResult {
  schemaVersion: "areas_assign_note_result.v1";
  traceId: string;
  status: "assigned" | "failed";
  noteId?: string;
  areaId?: string;
  areaName?: string;
  eventId?: string;
  evidence: {
    noteId?: string;
    areaId?: string;
    eventId?: string;
    eventType?: "note_area_assigned";
  };
  error?: string;
}

export interface AssignTaskAreaInput {
  schemaVersion: "areas_assign_task_input.v1";
  traceId: string;
  taskId: string;
  areaId?: string;
  areaSlug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface AssignTaskAreaResult {
  schemaVersion: "areas_assign_task_result.v1";
  traceId: string;
  status: "assigned" | "failed";
  taskId?: string;
  title?: string;
  areaId?: string;
  areaName?: string;
  eventId?: string;
  evidence: {
    taskId?: string;
    areaId?: string;
    eventId?: string;
    eventType?: "task_area_assigned";
  };
  error?: string;
}

export interface AreasRepository {
  createArea(input: CreateAreaInput): Promise<CreateAreaResult>;
  listAreas(input: ListAreasInput): Promise<ListAreasResult>;
  archiveArea(input: ArchiveAreaInput): Promise<ArchiveAreaResult>;
  assignNoteArea(input: AssignNoteAreaInput): Promise<AssignNoteAreaResult>;
  assignTaskArea(input: AssignTaskAreaInput): Promise<AssignTaskAreaResult>;
}
