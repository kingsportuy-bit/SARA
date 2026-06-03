export interface DailyLogRecord {
  id: string;
  schemaVersion: string;
  date: string;
  wakeEnergy?: number;
  sleepHours?: number;
  morningIntention?: string;
  eveningReview?: string;
  mood?: string;
  notes: string[];
  traceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogMorningInput {
  schemaVersion: "daily_log_morning_input.v1";
  traceId: string;
  date: string;
  wakeEnergy?: number;
  sleepHours?: number;
  morningIntention?: string;
  mood?: string;
  notes?: string[];
  source: "chatwoot" | "manual" | "system";
}

export interface DailyLogMorningResult {
  schemaVersion: "daily_log_morning_result.v1";
  traceId: string;
  status: "updated" | "failed";
  dailyLogId?: string;
  eventId?: string;
  date?: string;
  evidence: {
    dailyLogId?: string;
    eventId?: string;
    eventType?: "daily_log_created" | "daily_log_morning_updated";
  };
  error?: string;
}

export interface DailyLogEveningInput {
  schemaVersion: "daily_log_evening_input.v1";
  traceId: string;
  date: string;
  eveningReview?: string;
  mood?: string;
  notes?: string[];
  source: "chatwoot" | "manual" | "system";
}

export interface DailyLogEveningResult {
  schemaVersion: "daily_log_evening_result.v1";
  traceId: string;
  status: "updated" | "failed";
  dailyLogId?: string;
  eventId?: string;
  date?: string;
  evidence: {
    dailyLogId?: string;
    eventId?: string;
    eventType?: "daily_log_created" | "daily_log_evening_updated";
  };
  error?: string;
}

export interface DailyLogSummaryInput {
  schemaVersion: "daily_log_summary_input.v1";
  traceId: string;
  date: string;
}

export interface DailyLogSummaryResult {
  schemaVersion: "daily_log_summary_result.v1";
  traceId: string;
  status: "success" | "failed";
  dailyLog?: DailyLogRecord;
  error?: string;
}

export interface DailyLogRepository {
  upsertMorning(input: DailyLogMorningInput): Promise<DailyLogMorningResult>;
  upsertEvening(input: DailyLogEveningInput): Promise<DailyLogEveningResult>;
  getSummary(input: DailyLogSummaryInput): Promise<DailyLogSummaryResult>;
}
