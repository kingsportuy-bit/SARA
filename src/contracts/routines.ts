export type RoutineStatus = "draft" | "active" | "paused" | "archived";

export interface RoutineStepRecord {
  id: string;
  position: number;
  timeOfDay?: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineRecord {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: RoutineStatus;
  areaId?: string;
  objectiveId?: string;
  schedule: Record<string, unknown>;
  steps: RoutineStepRecord[];
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  pausedAt?: string;
  archivedAt?: string;
}

export interface RoutineStepInput {
  position: number;
  timeOfDay?: string;
  title: string;
  description?: string;
  durationMinutes?: number;
}

export interface CreateRoutineInput {
  schemaVersion: "routines_create_input.v1";
  traceId: string;
  name: string;
  slug: string;
  description?: string;
  areaId?: string;
  areaSlug?: string;
  steps?: RoutineStepInput[];
  source: "chatwoot" | "manual" | "system";
}

export interface CreateRoutineResult {
  schemaVersion: "routines_create_result.v1";
  traceId: string;
  status: "created" | "failed";
  routineId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  evidence: {
    routineId?: string;
    eventId?: string;
    eventType?: "routine_created";
  };
  error?: string;
}

export interface ListRoutinesInput {
  schemaVersion: "routines_list_input.v1";
  traceId: string;
  status?: RoutineStatus;
  limit?: number;
}

export interface ListRoutinesResult {
  schemaVersion: "routines_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  routines: RoutineRecord[];
  count: number;
  error?: string;
}

export interface ActivateRoutineInput {
  schemaVersion: "routines_activate_input.v1";
  traceId: string;
  routineId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface ActivateRoutineResult {
  schemaVersion: "routines_activate_result.v1";
  traceId: string;
  status: "activated" | "failed";
  routineId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  evidence: {
    routineId?: string;
    eventId?: string;
    eventType?: "routine_activated";
  };
  error?: string;
}

export interface PauseRoutineInput {
  schemaVersion: "routines_pause_input.v1";
  traceId: string;
  routineId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface PauseRoutineResult {
  schemaVersion: "routines_pause_result.v1";
  traceId: string;
  status: "paused" | "failed";
  routineId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  evidence: {
    routineId?: string;
    eventId?: string;
    eventType?: "routine_paused";
  };
  error?: string;
}

export interface ArchiveRoutineInput {
  schemaVersion: "routines_archive_input.v1";
  traceId: string;
  routineId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface ArchiveRoutineResult {
  schemaVersion: "routines_archive_result.v1";
  traceId: string;
  status: "archived" | "failed";
  routineId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  evidence: {
    routineId?: string;
    eventId?: string;
    eventType?: "routine_archived";
  };
  error?: string;
}

export interface RoutinesRepository {
  createRoutine(input: CreateRoutineInput): Promise<CreateRoutineResult>;
  listRoutines(input: ListRoutinesInput): Promise<ListRoutinesResult>;
  activateRoutine(input: ActivateRoutineInput): Promise<ActivateRoutineResult>;
  pauseRoutine(input: PauseRoutineInput): Promise<PauseRoutineResult>;
  archiveRoutine(input: ArchiveRoutineInput): Promise<ArchiveRoutineResult>;
}
