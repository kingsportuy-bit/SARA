export interface WorkoutExerciseProgress {
  exerciseName: string;
  totalSessions: number;
  totalSets: number;
  lastWeightKg: number | null;
  lastReps: number | null;
  maxWeightKg: number | null;
  maxWeightDate: string | null;
  volumeBySession: { sessionId: string; sessionDate: string; sets: number; totalVolume: number }[];
  recentSessions: {
    sessionId: string;
    date: string;
    sets: number;
  }[];
}

export interface ObjectiveProgressSummary {
  objectiveId: string;
  objectiveTitle: string;
  objectiveSlug: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  tasks: { id: string; title: string; status: string }[];
}

export interface DailyConsistencySummary {
  totalDays: number;
  streak: number;
  lastDate: string | null;
  averageWakeEnergy: number | null;
  averageSleepHours: number | null;
}

export interface GetWorkoutProgressInput {
  schemaVersion: "progress_workout_input.v1";
  traceId: string;
  exerciseName?: string;
  limit?: number;
}

export interface GetWorkoutProgressResult {
  schemaVersion: "progress_workout_result.v1";
  traceId: string;
  status: "success" | "failed" | "empty";
  progress?: WorkoutExerciseProgress;
  error?: string;
}

export interface GetObjectiveProgressInput {
  schemaVersion: "progress_objective_input.v1";
  traceId: string;
  objectiveSlug?: string;
  objectiveId?: string;
}

export interface GetObjectiveProgressResult {
  schemaVersion: "progress_objective_result.v1";
  traceId: string;
  status: "success" | "failed" | "empty";
  progress?: ObjectiveProgressSummary;
  error?: string;
}

export interface GetDailyConsistencyInput {
  schemaVersion: "progress_consistency_input.v1";
  traceId: string;
  days?: number;
}

export interface GetDailyConsistencyResult {
  schemaVersion: "progress_consistency_result.v1";
  traceId: string;
  status: "success" | "failed" | "empty";
  summary?: DailyConsistencySummary;
  error?: string;
}

export interface ProgressRepository {
  getWorkoutProgress(input: GetWorkoutProgressInput): Promise<GetWorkoutProgressResult>;
  getObjectiveProgress(input: GetObjectiveProgressInput): Promise<GetObjectiveProgressResult>;
  getDailyConsistency(input: GetDailyConsistencyInput): Promise<GetDailyConsistencyResult>;
}
