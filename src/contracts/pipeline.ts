export interface CoarseClassificationInput {
  schemaVersion: "coarse_classification_input.v1";
  traceId: string;
  messages: Array<{
    id: number;
    content: string;
    createdAt: string;
  }>;
  sessionContext?: {
    contextId?: string;
    activeModule?: string;
    activeFlow?: string;
    focusedEntityType?: string;
    focusedEntityId?: string;
    awaitingConfirmation?: boolean;
    context?: Record<string, unknown>;
  };
}

export interface CoarseClassificationResult {
  schemaVersion: "coarse_classification_result.v1";
  traceId: string;
  module: "notes" | "tasks" | "reminders" | "daily-log" | "session-context" | "unknown";
  confidence: number;
  missingData: string[];
  reasoningSummary: string;
}

export interface ModuleIntentInput {
  schemaVersion: "module_intent_input.v1";
  traceId: string;
  module: CoarseClassificationResult["module"];
  messages: CoarseClassificationInput["messages"];
  sessionContext?: CoarseClassificationInput["sessionContext"];
}

export interface ModuleIntentResult {
  schemaVersion: "module_intent_result.v1";
  traceId: string;
  module: "notes" | "tasks" | "reminders" | "daily-log" | "session-context" | "unknown";
  action: string;
  confidence: number;
  entities: Record<string, unknown>;
  missingData: string[];
  requiresConfirmation: boolean;
  reasoningSummary: string;
}

export interface RouteResult {
  schemaVersion: "route_result.v1";
  traceId: string;
  module: ModuleIntentResult["module"];
  action: string;
  executable: boolean;
  reason?: string;
}

export interface ActionExecutionInput {
  schemaVersion: "action_execution_input.v1";
  traceId: string;
  module: ModuleIntentResult["module"];
  action: string;
  entities: Record<string, unknown>;
  requiresConfirmation: boolean;
  /** Confidence from ModuleIntentResult. Required guard for execution. */
  intentConfidence?: number;
  /** Missing data from ModuleIntentResult. Required guard for execution. */
  intentMissingData?: string[];
}

export interface ActionExecutionResult {
  schemaVersion: "action_execution_result.v1";
  traceId: string;
  status: "executed" | "failed" | "skipped" | "needs_confirmation";
  evidence: Record<string, unknown>;
  stateChanges: Array<{
    entityType: string;
    entityId?: string;
    eventType: string;
    payload: Record<string, unknown>;
  }>;
  error?: string;
}

export interface ResponseCompositionInput {
  schemaVersion: "response_composition_input.v1";
  traceId: string;
  messages: CoarseClassificationInput["messages"];
  classification: {
    coarse: CoarseClassificationResult;
    intent: ModuleIntentResult;
  };
  actionResult: ActionExecutionResult;
}

export interface ResponseCompositionResult {
  schemaVersion: "response_composition_result.v1";
  traceId: string;
  content: string;
  evidenceUsed: Record<string, unknown>;
}
