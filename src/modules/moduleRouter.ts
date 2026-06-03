import type { ModuleIntentResult, RouteResult } from "../contracts/pipeline.js";

export interface ModuleRouter {
  route(intent: ModuleIntentResult): Promise<RouteResult>;
}

const REGISTRY: Record<string, string[]> = {};

export function createModuleRouter(): ModuleRouter {
  return {
    async route(intent) {
      const moduleActions = REGISTRY[intent.module];
      if (!moduleActions || moduleActions.length === 0) {
        return {
          schemaVersion: "route_result.v1",
          traceId: intent.traceId,
          module: intent.module,
          action: intent.action,
          executable: false,
          reason: `Module "${intent.module}" not registered or has no actions.`,
        };
      }
      if (!moduleActions.includes(intent.action)) {
        return {
          schemaVersion: "route_result.v1",
          traceId: intent.traceId,
          module: intent.module,
          action: intent.action,
          executable: false,
          reason: `Action "${intent.action}" not registered for module "${intent.module}".`,
        };
      }
      return {
        schemaVersion: "route_result.v1",
        traceId: intent.traceId,
        module: intent.module,
        action: intent.action,
        executable: true,
      };
    },
  };
}
