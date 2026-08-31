import type { PersonalAssistantRepository, ExpenseInput, ContextInput, GuidanceInput, GuidanceResult, PersonalScope } from "../../contracts/personalAssistant.js";

export function createPersonalAssistantModule(repository: PersonalAssistantRepository) {
  const fail = (error: string) => ({ status: "failed" as const, error });
  return {
    createExpense: (input: ExpenseInput) => repository.createExpense(input),
    listExpenses: (limit?: number) => repository.listExpenses(limit),
    updateExpense: (id: string, patch: Partial<ExpenseInput>, traceId: string) => repository.updateExpense(id, patch, traceId),
    reclassifyExpense: (id: string, scope: PersonalScope, entity: string | undefined, traceId: string) => repository.reclassifyExpense(id, scope, entity, traceId),
    saveContext(input: ContextInput) {
      if (input.kind === "forbidden" || /(?:password|contraseña|pin|token|mfa|secret|secreto|recovery|recuperaci[oó]n)/i.test(`${input.key} ${input.value}`)) return Promise.resolve(fail("forbidden personal data"));
      if (input.kind === "sensitive" && input.consent !== true) return Promise.resolve(fail("explicit consent required"));
      if (input.kind === "ephemeral") return Promise.resolve({ status: "no_persisted" as const, error: "ephemeral context was not persisted" });
      return repository.saveContext(input);
    },
    correctContext(id: string, input: ContextInput) {
      if (input.kind === "forbidden" || /(?:password|contraseña|pin|token|mfa|secret|secreto|recovery|recuperaci[oó]n)/i.test(`${input.key} ${input.value}`)) return Promise.resolve(fail("forbidden personal data"));
      if (input.kind === "sensitive" && input.consent !== true) return Promise.resolve(fail("explicit consent required"));
      if (input.kind === "ephemeral") return Promise.resolve({ status: "no_persisted" as const, error: "ephemeral context was not persisted" });
      return repository.correctContext(id, input);
    },
    listContext: () => repository.listContext(),
    forgetContext: (id: string, traceId: string) => repository.forgetContext(id, traceId),
    createCase: (input: { name: string; description?: string; traceId: string }) => repository.createCase(input),
    addCaseEvent: (input: { caseId: string; type: "note" | "pending" | "reference" | "status"; content: string; traceId: string }) => repository.addCaseEvent(input),
    listCaseEvents: (caseId: string) => repository.listCaseEvents(caseId),
    guide(input: GuidanceInput): GuidanceResult {
      const context = input.context.length ? input.context.join("; ") : "No hay contexto durable suficiente.";
      return { recommendation: `Priorizar una prueba reversible sobre: ${input.decision}. Contexto: ${context}`, objection: "La recomendación puede ser incorrecta si faltan datos o si cambian las restricciones.", uncertainties: ["La información disponible puede estar incompleta o desactualizada."], nextSteps: ["Definir el resultado esperado", "Elegir una acción local y reversible", "Fijar una fecha de revisión"], externalActionExecuted: false };
    },
  };
}
