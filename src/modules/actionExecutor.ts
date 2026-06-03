import type { ActionExecutionInput, ActionExecutionResult, ModuleIntentResult } from "../contracts/pipeline.js";

export interface ModuleHandler {
  (input: ActionExecutionInput): Promise<ActionExecutionResult>;
}

export interface ActionExecutor {
  execute(input: ActionExecutionInput): Promise<ActionExecutionResult>;
}

type HandlerRegistry = Record<string, Record<string, ModuleHandler>>;

function validateContent(input: ActionExecutionInput): string | null {
  const content = input.entities?.content;
  if (!content || typeof content !== "string" || String(content).trim().length === 0) {
    return "content is required for notes.create";
  }
  return null;
}

function validateTitle(input: ActionExecutionInput): string | null {
  const title = input.entities?.title;
  if (!title || typeof title !== "string" || String(title).trim().length === 0) {
    return "title is required for tasks.create";
  }
  return null;
}

function validateCompleteIdentifier(input: ActionExecutionInput): string | null {
  const hasTaskId = input.entities?.taskId;
  const hasTitleMatch = input.entities?.titleMatch && typeof input.entities.titleMatch === "string" && input.entities.titleMatch.trim().length > 0;
  const position = Number(input.entities?.position);
  const hasPosition = !isNaN(position) && position > 0;
  if (!hasTaskId && !hasTitleMatch && !hasPosition) {
    return "taskId, titleMatch, or positive position required for tasks.complete";
  }
  return null;
}

function guardConfidenceAndMissing(input: ActionExecutionInput): string | null {
  if (input.intentConfidence === undefined || input.intentConfidence < 0.75) {
    return `confidence insufficient for ${input.module}.${input.action}`;
  }
  if (!Array.isArray(input.intentMissingData) || input.intentMissingData.length > 0) {
    return `missing data prevents ${input.module}.${input.action}`;
  }
  return null;
}

function guardAction(input: ActionExecutionInput): string | null {
  const writingActions = ["create", "complete"];

  if (writingActions.includes(input.action)) {
    const cm = guardConfidenceAndMissing(input);
    if (cm) return cm;
  }

  if (input.module === "notes" && input.action === "create") {
    return validateContent(input);
  }

  if (input.module === "tasks" && input.action === "create") {
    return validateTitle(input);
  }

  if (input.module === "tasks" && input.action === "complete") {
    return validateCompleteIdentifier(input);
  }

  return null;
}

export function createActionExecutor(handlers: HandlerRegistry = {}): ActionExecutor {
  return {
    async execute(input) {
      if (input.requiresConfirmation) {
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "needs_confirmation",
          evidence: { reason: "Confirmation required before execution." },
          stateChanges: [],
        };
      }

      const moduleHandlers = handlers[input.module];
      if (!moduleHandlers) {
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "skipped",
          evidence: { reason: `Module "${input.module}" has no registered handlers.` },
          stateChanges: [],
        };
      }

      const handler = moduleHandlers[input.action];
      if (!handler) {
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "skipped",
          evidence: { reason: `Action "${input.action}" not implemented for module "${input.module}".` },
          stateChanges: [],
        };
      }

      const guardError = guardAction(input);
      if (guardError) {
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: { reason: guardError },
          stateChanges: [],
          error: guardError,
        };
      }

      return handler(input);
    },
  };
}

export function intentConfidenceSufficient(intent: ModuleIntentResult): boolean {
  return intent.confidence >= 0.75 && intent.missingData.length === 0;
}
