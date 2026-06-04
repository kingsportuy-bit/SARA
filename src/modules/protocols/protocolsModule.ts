import type {
  CreateProtocolInput,
  CreateProtocolResult,
  ListProtocolsInput,
  ListProtocolsResult,
  ActivateProtocolInput,
  ActivateProtocolResult,
  ArchiveProtocolInput,
  ArchiveProtocolResult,
  EvaluateProtocolInput,
  EvaluateProtocolResult,
  ProtocolsRepository,
  ProtocolRule,
} from "../../contracts/protocols.js";

export interface ProtocolsModule {
  create(input: CreateProtocolInput): Promise<CreateProtocolResult>;
  list(input: ListProtocolsInput): Promise<ListProtocolsResult>;
  activate(input: ActivateProtocolInput): Promise<ActivateProtocolResult>;
  archive(input: ArchiveProtocolInput): Promise<ArchiveProtocolResult>;
  evaluate(input: EvaluateProtocolInput): Promise<EvaluateProtocolResult>;
}

function evaluateRuleDeterministically(rule: ProtocolRule, context: Record<string, unknown>): { applies: boolean; evidence: string } {
  const conditionLower = rule.condition.toLowerCase();
  const actionLower = rule.action.toLowerCase();

  // Sleep-related rules
  if (conditionLower.includes("dorm") || conditionLower.includes("sue") || conditionLower.includes("horas de sue")) {
    for (const [key, value] of Object.entries(context)) {
      if (key.toLowerCase().includes("sleep") || key.toLowerCase().includes("sue") || key.toLowerCase().includes("dorm")) {
        const numVal = typeof value === "number" ? value : typeof value === "string" ? parseFloat(value) : NaN;
        if (!isNaN(numVal)) {
          // Check for conditions like "menos de N horas"
          const lessThanMatch = conditionLower.match(/menos\s+de\s+(\d+)\s*horas/);
          if (lessThanMatch) {
            const threshold = parseInt(lessThanMatch[1], 10);
            if (numVal < threshold) {
              return { applies: true, evidence: `${key}: ${numVal} < ${threshold} horas` };
            }
          }
          const moreThanMatch = conditionLower.match(/m[aá]s\s+de\s+(\d+)\s*horas/);
          if (moreThanMatch) {
            const threshold = parseInt(moreThanMatch[1], 10);
            if (numVal > threshold) {
              return { applies: true, evidence: `${key}: ${numVal} > ${threshold} horas` };
            }
          }
        }
      }
    }
  }

  // Energy-related rules
  if (conditionLower.includes("energ") || conditionLower.includes("energia")) {
    for (const [key, value] of Object.entries(context)) {
      if (key.toLowerCase().includes("energ") || key.toLowerCase().includes("energy") || key.toLowerCase().includes("energ")) {
        const numVal = typeof value === "number" ? value : typeof value === "string" ? parseFloat(value) : NaN;
        if (!isNaN(numVal)) {
          const lessThanMatch = conditionLower.match(/menos\s+de\s+(\d+)/);
          if (lessThanMatch) {
            const threshold = parseInt(lessThanMatch[1], 10);
            if (numVal < threshold) {
              return { applies: true, evidence: `${key}: ${numVal} < ${threshold}` };
            }
          }
          const moreThanMatch = conditionLower.match(/m[aá]s\s+de\s+(\d+)/);
          if (moreThanMatch) {
            const threshold = parseInt(moreThanMatch[1], 10);
            if (numVal > threshold) {
              return { applies: true, evidence: `${key}: ${numVal} > ${threshold}` };
            }
          }
          const rangeMatch = conditionLower.match(/entre\s+(\d+)\s+y\s+(\d+)/);
          if (rangeMatch) {
            const low = parseInt(rangeMatch[1], 10);
            const high = parseInt(rangeMatch[2], 10);
            if (numVal >= low && numVal <= high) {
              return { applies: true, evidence: `${key}: ${numVal} entre ${low} y ${high}` };
            }
          }
        }
      }
    }
  }

  // Mood-related rules
  if (conditionLower.includes("anim") || conditionLower.includes("estado") || conditionLower.includes("mood")) {
    for (const [key, value] of Object.entries(context)) {
      if (key.toLowerCase().includes("mood") || key.toLowerCase().includes("anim") || key.toLowerCase().includes("estado")) {
        const strVal = String(value ?? "").toLowerCase();
        const keywords = ["bajo", "cansado", "agotado", "mal", "triste", "desanimado"];
        for (const kw of keywords) {
          if (conditionLower.includes(kw) && strVal.includes(kw)) {
            return { applies: true, evidence: `${key}: "${String(value)}" contiene "${kw}"` };
          }
        }
        // General text match
        if (strVal.includes(conditionLower) || conditionLower.includes(strVal)) {
          return { applies: true, evidence: `${key}: "${String(value)}" coincide con "${rule.condition}"` };
        }
      }
    }
  }

  // Generic keyword match in context
  for (const [key, value] of Object.entries(context)) {
    const strVal = String(value ?? "").toLowerCase();
    // Check if condition keywords appear in context values
    const conditionWords = conditionLower.split(/\s+/).filter((w) => w.length > 2);
    const matchCount = conditionWords.filter((w) => strVal.includes(w)).length;
    if (matchCount >= Math.max(2, Math.ceil(conditionWords.length * 0.5))) {
      return { applies: true, evidence: `${key}: "${String(value).substring(0, 60)}" coincide parcialmente` };
    }
  }

  return { applies: false, evidence: "no se encontraron datos que activen la regla" };
}

export function createProtocolsModule(repository: ProtocolsRepository): ProtocolsModule {
  return {
    async create(input: CreateProtocolInput): Promise<CreateProtocolResult> {
      const name = (input.name ?? "").trim();
      const slug = (input.slug ?? "").trim();

      if (!name) {
        return {
          schemaVersion: "protocols_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "protocol name cannot be empty",
        };
      }

      if (!slug) {
        return {
          schemaVersion: "protocols_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "protocol slug cannot be empty",
        };
      }

      if (!["daily", "fitness", "planning", "general"].includes(input.scope)) {
        return {
          schemaVersion: "protocols_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: `invalid scope: ${input.scope}`,
        };
      }

      if (!Array.isArray(input.rules)) {
        return {
          schemaVersion: "protocols_create_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "rules must be an array",
        };
      }

      return repository.createProtocol({ ...input, name, slug });
    },

    async list(input: ListProtocolsInput): Promise<ListProtocolsResult> {
      return repository.listProtocols(input);
    },

    async activate(input: ActivateProtocolInput): Promise<ActivateProtocolResult> {
      if (!input.protocolId && !input.slug) {
        return {
          schemaVersion: "protocols_activate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "protocolId or slug required to activate",
        };
      }
      return repository.activateProtocol(input);
    },

    async archive(input: ArchiveProtocolInput): Promise<ArchiveProtocolResult> {
      if (!input.protocolId && !input.slug) {
        return {
          schemaVersion: "protocols_archive_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {},
          error: "protocolId or slug required to archive",
        };
      }
      return repository.archiveProtocol(input);
    },

    async evaluate(input: EvaluateProtocolInput): Promise<EvaluateProtocolResult> {
      if (!input.protocolId && !input.slug) {
        return {
          schemaVersion: "protocols_evaluate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {
            rulesCount: 0,
            rulesMatched: 0,
          },
          suggestions: [],
          error: "protocolId or slug required to evaluate",
        };
      }

      // First, get the protocol to access its rules
      const listResult = await repository.listProtocols({
        schemaVersion: "protocols_list_input.v1",
        traceId: input.traceId,
      });

      if (listResult.status === "failed") {
        return {
          schemaVersion: "protocols_evaluate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {
            rulesCount: 0,
            rulesMatched: 0,
          },
          suggestions: [],
          error: listResult.error ?? "failed to list protocols",
        };
      }

      const protocol = listResult.protocols.find(
        (p) =>
          (input.protocolId && p.id === input.protocolId) ||
          (input.slug && p.slug === input.slug)
      );

      if (!protocol) {
        return {
          schemaVersion: "protocols_evaluate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {
            rulesCount: 0,
            rulesMatched: 0,
          },
          suggestions: [],
          error: "protocol not found",
        };
      }

      // Only active protocols can be evaluated
      if (protocol.status !== "active") {
        return {
          schemaVersion: "protocols_evaluate_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: {
            rulesCount: 0,
            rulesMatched: 0,
          },
          suggestions: [],
          error: `protocol is ${protocol.status}, only active protocols can be evaluated`,
        };
      }

      const rules = protocol.rules ?? [];
      const suggestions = rules.map((rule) => {
        const { applies, evidence } = evaluateRuleDeterministically(rule, input.context);
        return {
          rule,
          applies,
          suggestion: applies ? rule.action : "",
          evidence,
        };
      });

      const rulesMatched = suggestions.filter((s) => s.applies).length;

      // Log evaluation (this is delegated to repository which calls the RPC)
      return repository.evaluateProtocol({
        ...input,
        context: {
          ...input.context,
          rulesEvaluated: rules.length,
          rulesMatched,
        },
      });
    },
  };
}
