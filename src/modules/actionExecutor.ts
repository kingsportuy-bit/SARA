import type { ActionExecutionInput, ActionExecutionResult, ModuleIntentResult } from "../contracts/pipeline.js";

export interface ModuleHandler {
  (input: ActionExecutionInput): Promise<ActionExecutionResult>;
}

export interface ActionExecutor {
  execute(input: ActionExecutionInput): Promise<ActionExecutionResult>;
}

type HandlerRegistry = Record<string, Record<string, ModuleHandler>>;

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

      return handler(input);
    },
  };
}

export function intentConfidenceSufficient(intent: ModuleIntentResult): boolean {
  return intent.confidence >= 0.75 && intent.missingData.length === 0;
}
