import type { ActionExecutionInput, ActionExecutionResult, ModuleIntentResult } from "../contracts/pipeline.js";

export interface ActionExecutor {
  execute(input: ActionExecutionInput): Promise<ActionExecutionResult>;
}

export function createActionExecutor(): ActionExecutor {
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

      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "skipped",
        evidence: { reason: "No domain modules registered yet." },
        stateChanges: [],
      };
    },
  };
}

export function intentConfidenceSufficient(intent: ModuleIntentResult): boolean {
  return intent.confidence >= 0.75 && intent.missingData.length === 0;
}
