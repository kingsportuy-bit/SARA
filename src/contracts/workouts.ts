export type WorkoutSessionStatus = "active" | "finished" | "canceled";

export interface WorkoutSessionRecord {
  id: string;
  schemaVersion: string;
  title?: string;
  status: WorkoutSessionStatus;
  routineId?: string;
  areaId?: string;
  objectiveId?: string;
  startedAt: string;
  finishedAt?: string;
  notes?: string;
  traceId?: string;
  createdAt: string;
  updatedAt: string;
  setCount?: number;
}

export interface WorkoutSetRecord {
  id: string;
  schemaVersion: string;
  sessionId: string;
  exerciseName: string;
  setNumber: number;
  targetReps?: number;
  actualReps?: number;
  weightKg?: number;
  durationSeconds?: number;
  restSeconds?: number;
  notes?: string;
  traceId?: string;
  createdAt: string;
}

export interface StartWorkoutSessionInput {
  schemaVersion: "workouts_start_input.v1";
  traceId: string;
  title?: string;
  routineId?: string;
  areaId?: string;
  objectiveId?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface StartWorkoutSessionResult {
  schemaVersion: "workouts_start_result.v1";
  traceId: string;
  status: "started" | "failed";
  sessionId?: string;
  eventId?: string;
  title?: string;
  evidence: {
    sessionId?: string;
    eventId?: string;
    eventType?: "workout_session_started";
  };
  error?: string;
}

export interface LogWorkoutSetInput {
  schemaVersion: "workouts_set_input.v1";
  traceId: string;
  sessionId: string;
  exerciseName: string;
  setNumber: number;
  targetReps?: number;
  actualReps?: number;
  weightKg?: number;
  durationSeconds?: number;
  restSeconds?: number;
  notes?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface LogWorkoutSetResult {
  schemaVersion: "workouts_set_result.v1";
  traceId: string;
  status: "logged" | "failed";
  setId?: string;
  eventId?: string;
  sessionId?: string;
  exerciseName?: string;
  setNumber?: number;
  evidence: {
    setId?: string;
    eventId?: string;
    eventType?: "workout_set_logged";
  };
  error?: string;
}

export interface FinishWorkoutSessionInput {
  schemaVersion: "workouts_finish_input.v1";
  traceId: string;
  sessionId?: string;
  notes?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface FinishWorkoutSessionResult {
  schemaVersion: "workouts_finish_result.v1";
  traceId: string;
  status: "finished" | "failed";
  sessionId?: string;
  eventId?: string;
  title?: string;
  setCount?: number;
  evidence: {
    sessionId?: string;
    eventId?: string;
    eventType?: "workout_session_finished";
  };
  error?: string;
}

export interface CancelWorkoutSessionInput {
  schemaVersion: "workouts_cancel_input.v1";
  traceId: string;
  sessionId?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface CancelWorkoutSessionResult {
  schemaVersion: "workouts_cancel_result.v1";
  traceId: string;
  status: "canceled" | "failed";
  sessionId?: string;
  eventId?: string;
  title?: string;
  evidence: {
    sessionId?: string;
    eventId?: string;
    eventType?: "workout_session_canceled";
  };
  error?: string;
}

export interface ListWorkoutSessionsInput {
  schemaVersion: "workouts_list_input.v1";
  traceId: string;
  status?: WorkoutSessionStatus;
  limit?: number;
}

export interface ListWorkoutSessionsResult {
  schemaVersion: "workouts_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  sessions: WorkoutSessionRecord[];
  count: number;
  error?: string;
}

export interface WorkoutsRepository {
  startSession(input: StartWorkoutSessionInput): Promise<StartWorkoutSessionResult>;
  logSet(input: LogWorkoutSetInput): Promise<LogWorkoutSetResult>;
  finishSession(input: FinishWorkoutSessionInput): Promise<FinishWorkoutSessionResult>;
  cancelSession(input: CancelWorkoutSessionInput): Promise<CancelWorkoutSessionResult>;
  listSessions(input: ListWorkoutSessionsInput): Promise<ListWorkoutSessionsResult>;
}
