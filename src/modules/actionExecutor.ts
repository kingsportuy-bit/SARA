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

      if (input.module === "notes" && input.action === "create") {
        if (input.intentConfidence === undefined || input.intentConfidence < 0.75) {
          return {
            schemaVersion: "action_execution_result.v1",
            traceId: input.traceId,
            status: "failed",
            evidence: { reason: "confidence insufficient for notes.create" },
            stateChanges: [],
            error: "confidence insufficient for notes.create",
          };
        }
        if (!Array.isArray(input.intentMissingData) || input.intentMissingData.length > 0) {
          return {
            schemaVersion: "action_execution_result.v1",
            traceId: input.traceId,
            status: "failed",
            evidence: { reason: "missing data prevents notes.create" },
            stateChanges: [],
            error: "missing data prevents notes.create",
          };
        }
        const contentError = validateContent(input);
        if (contentError) {
          return {
            schemaVersion: "action_execution_result.v1",
            traceId: input.traceId,
            status: "failed",
            evidence: { reason: contentError },
            stateChanges: [],
            error: contentError,
          };
        }
      }

      return handler(input);
    },
  };
}

export function intentConfidenceSufficient(intent: ModuleIntentResult): boolean {
  return intent.confidence >= 0.75 && intent.missingData.length === 0;
}
