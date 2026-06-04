export type ProtocolStatus = "draft" | "active" | "archived";
export type ProtocolScope = "daily" | "fitness" | "planning" | "general";

export interface ProtocolRule {
  condition: string;
  action: string;
}

export interface ProtocolRecord {
  id: string;
  name: string;
  slug: string;
  status: ProtocolStatus;
  scope: ProtocolScope;
  rules: ProtocolRule[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  archivedAt?: string;
}

export interface CreateProtocolInput {
  schemaVersion: "protocols_create_input.v1";
  traceId: string;
  name: string;
  slug: string;
  scope: ProtocolScope;
  rules: ProtocolRule[];
  description?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface CreateProtocolResult {
  schemaVersion: "protocols_create_result.v1";
  traceId: string;
  status: "created" | "failed";
  protocolId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  scope?: string;
  evidence: {
    protocolId?: string;
    eventId?: string;
    eventType?: "protocol_created";
  };
  error?: string;
}

export interface ListProtocolsInput {
  schemaVersion: "protocols_list_input.v1";
  traceId: string;
  status?: ProtocolStatus;
  scope?: ProtocolScope;
  limit?: number;
}

export interface ListProtocolsResult {
  schemaVersion: "protocols_list_result.v1";
  traceId: string;
  status: "success" | "failed";
  protocols: ProtocolRecord[];
  count: number;
  error?: string;
}

export interface ActivateProtocolInput {
  schemaVersion: "protocols_activate_input.v1";
  traceId: string;
  protocolId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface ActivateProtocolResult {
  schemaVersion: "protocols_activate_result.v1";
  traceId: string;
  status: "activated" | "failed";
  protocolId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  scope?: string;
  evidence: {
    protocolId?: string;
    eventId?: string;
    eventType?: "protocol_activated";
  };
  error?: string;
}

export interface ArchiveProtocolInput {
  schemaVersion: "protocols_archive_input.v1";
  traceId: string;
  protocolId?: string;
  slug?: string;
  source: "chatwoot" | "manual" | "system";
}

export interface ArchiveProtocolResult {
  schemaVersion: "protocols_archive_result.v1";
  traceId: string;
  status: "archived" | "failed";
  protocolId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  scope?: string;
  evidence: {
    protocolId?: string;
    eventId?: string;
    eventType?: "protocol_archived";
  };
  error?: string;
}

export interface EvaluateProtocolInput {
  schemaVersion: "protocols_evaluate_input.v1";
  traceId: string;
  protocolId?: string;
  slug?: string;
  context: Record<string, unknown>;
  source: "chatwoot" | "manual" | "system";
}

export interface ProtocolSuggestion {
  rule: ProtocolRule;
  applies: boolean;
  suggestion: string;
  evidence: string;
}

export interface EvaluateProtocolResult {
  schemaVersion: "protocols_evaluate_result.v1";
  traceId: string;
  status: "evaluated" | "failed";
  protocolId?: string;
  eventId?: string;
  name?: string;
  slug?: string;
  scope?: string;
  suggestions: ProtocolSuggestion[];
  evidence: {
    protocolId?: string;
    eventId?: string;
    eventType?: "protocol_evaluated";
    rulesCount: number;
    rulesMatched: number;
  };
  error?: string;
}

export interface ProtocolsRepository {
  createProtocol(input: CreateProtocolInput): Promise<CreateProtocolResult>;
  listProtocols(input: ListProtocolsInput): Promise<ListProtocolsResult>;
  activateProtocol(input: ActivateProtocolInput): Promise<ActivateProtocolResult>;
  archiveProtocol(input: ArchiveProtocolInput): Promise<ArchiveProtocolResult>;
  evaluateProtocol(input: EvaluateProtocolInput): Promise<EvaluateProtocolResult>;
}
