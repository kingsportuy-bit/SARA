export type TimerKind = "workout_rest" | "generic";
export type TimerStatus = "pending" | "fired" | "canceled";

export interface TimerRecord {
  id: string;
  kind: TimerKind;
  status: TimerStatus;
  title: string;
  durationSeconds: number;
  dueAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  createdAt: string;
  updatedAt: string;
  firedAt?: string;
  canceledAt?: string;
}

export interface StartTimerInput {
  schemaVersion: "timers_start_input.v1";
  traceId: string;
  kind: TimerKind;
  title: string;
  durationSeconds: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  source: "chatwoot" | "manual" | "system";
}

export interface StartTimerResult {
  schemaVersion: "timers_start_result.v1";
  traceId: string;
  status: "started" | "failed";
  timerId?: string;
  eventId?: string;
  kind?: string;
  title?: string;
  durationSeconds?: number;
  dueAt?: string;
  evidence: {
    timerId?: string;
    eventId?: string;
    eventType?: "timer_started";
  };
  error?: string;
}

export interface CancelTimerInput {
  schemaVersion: "timers_cancel_input.v1";
  traceId: string;
  timerId: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  source: "chatwoot" | "manual" | "system";
}

export interface CancelTimerResult {
  schemaVersion: "timers_cancel_result.v1";
  traceId: string;
  status: "canceled" | "failed";
  timerId?: string;
  eventId?: string;
  kind?: string;
  title?: string;
  evidence: {
    timerId?: string;
    eventId?: string;
    eventType?: "timer_canceled";
  };
  error?: string;
}

export interface ClaimDueTimersInput {
  schemaVersion: "timers_claim_due_input.v1";
  traceId: string;
  limit: number;
  accountId: number;
  inboxId: number;
  conversationId: number;
}

export interface ClaimDueTimersResult {
  schemaVersion: "timers_claim_due_result.v1";
  traceId: string;
  status: "success" | "failed";
  timers: TimerRecord[];
  count: number;
  error?: string;
}

export interface MarkTimerFiredInput {
  schemaVersion: "timers_mark_fired_input.v1";
  traceId: string;
  timerId: string;
  source: "chatwoot" | "manual" | "system";
}

export interface MarkTimerFiredResult {
  schemaVersion: "timers_mark_fired_result.v1";
  traceId: string;
  status: "fired" | "failed";
  timerId?: string;
  eventId?: string;
  kind?: string;
  title?: string;
  evidence: {
    timerId?: string;
    eventId?: string;
    eventType?: "timer_fired";
  };
  error?: string;
}

export interface TimersRepository {
  startTimer(input: StartTimerInput): Promise<StartTimerResult>;
  cancelTimer(input: CancelTimerInput): Promise<CancelTimerResult>;
  claimDueTimers(input: ClaimDueTimersInput): Promise<ClaimDueTimersResult>;
  markTimerFired(input: MarkTimerFiredInput): Promise<MarkTimerFiredResult>;
}
