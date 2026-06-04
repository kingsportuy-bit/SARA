export type ObjectiveStatus = "active" | "achieved" | "archived";

export interface ObjectiveRecord {
  id: string;
  title: string;
  slug: string;
  description?: string;
  areaId?: string;
  areaName?: string;
  status: ObjectiveStatus;
  targetDate?: string;
  successCriteria: string[];
  createdAt: string;
  updatedAt: string;
  achievedAt?: string;
  archivedAt?: string;
}

export interface CreateObjectiveInput {
  schemaVersion: "objectives_create_input.v1";
  traceId: string;
  title: string;
  slug: string;
  description?: string;
  areaId?: string;
  areaSlug?: string;
  targetDate?: string;
  successCriteria: string[];
  source: "chatwoot" | "manual" | "system";
}

export interface CreateObjectiveResult {
  schemaVersion: "objectives_create_result.v1";
  traceId: string;
  status: "created" | "failed";
  objectiveId?: string;
  eventId?: string;
  title?: string;
  slug?: string;
  areaId?: string;
  areaName?: string;
  evidence: {
    objectiveId?: string;
    eventId?: string;
    eventType?: "objective_created";
  };
  error?: string;
}

export interface ListObjectivesInput {
  schemaVersion: "objectives_list_input.v1";
  traceId: string;
  status?: ObjectiveStatus;
  areaId?: string;
  areaSlug?: string;
  limit?: number;
}

export interface ListObjectivesResult {
  schemaVersion: "objectives_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  objectives: ObjectiveRecord[];
  count: number;
  error?: string;
}

export interface AchieveObjectiveInput {
  schemaVersion: "objectives_achieve_input.v1";
  traceId: string;
  objectiveId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface AchieveObjectiveResult {
  schemaVersion: "objectives_achieve_result.v1";
  traceId: string;
  status: "achieved" | "failed";
  objectiveId?: string;
  eventId?: string;
  title?: string;
  slug?: string;
  evidence: {
    objectiveId?: string;
    eventId?: string;
    eventType?: "objective_achieved";
  };
  error?: string;
}

export interface ArchiveObjectiveInput {
  schemaVersion: "objectives_archive_input.v1";
  traceId: string;
  objectiveId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface ArchiveObjectiveResult {
  schemaVersion: "objectives_archive_result.v1";
  traceId: string;
  status: "archived" | "failed";
  objectiveId?: string;
  eventId?: string;
  title?: string;
  slug?: string;
  evidence: {
    objectiveId?: string;
    eventId?: string;
    eventType?: "objective_archived";
  };
  error?: string;
}

export interface AssignTaskObjectiveInput {
  schemaVersion: "objectives_assign_task_input.v1";
  traceId: string;
  taskId: string;
  objectiveId?: string;
  objectiveSlug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface AssignTaskObjectiveResult {
  schemaVersion: "objectives_assign_task_result.v1";
  traceId: string;
  status: "assigned" | "failed";
  taskId?: string;
  taskTitle?: string;
  objectiveId?: string;
  objectiveTitle?: string;
  objectiveSlug?: string;
  eventId?: string;
  evidence: {
    taskId?: string;
    objectiveId?: string;
    objectiveSlug?: string;
    eventId?: string;
    eventType?: "task_objective_assigned";
  };
  error?: string;
}

export interface ObjectivesRepository {
  createObjective(input: CreateObjectiveInput): Promise<CreateObjectiveResult>;
  listObjectives(input: ListObjectivesInput): Promise<ListObjectivesResult>;
  achieveObjective(input: AchieveObjectiveInput): Promise<AchieveObjectiveResult>;
  archiveObjective(input: ArchiveObjectiveInput): Promise<ArchiveObjectiveResult>;
  assignTaskObjective(input: AssignTaskObjectiveInput): Promise<AssignTaskObjectiveResult>;
}
