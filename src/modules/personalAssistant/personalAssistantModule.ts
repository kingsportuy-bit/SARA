import type { PersonalAssistantRepository, ExpenseInput, ContextInput, GuidanceInput, GuidanceResult, PersonalScope } from "../../contracts/personalAssistant.js";
import { containsForbiddenMaterial, scanForForbidden } from "./personalAssistantGuard.js";

export function createPersonalAssistantModule(repository: PersonalAssistantRepository) {
  const fail = (error: string) => ({ status: "failed" as const, error });

  function guardExpense(input: ExpenseInput | Partial<ExpenseInput>): ReturnType<typeof fail> | undefined {
    if (containsForbiddenMaterial(`${input.concept ?? ""} ${input.category ?? ""} ${input.entity ?? ""}`)) {
      return fail("forbidden personal data");
    }
    return undefined;
  }

  return {
    createExpense(input: ExpenseInput) {
      const guard = guardExpense(input);
      if (guard) return Promise.resolve(guard);
      return repository.createExpense(input);
    },
    listExpenses: (limit?: number) => repository.listExpenses(limit),
    updateExpense(id: string, patch: Partial<ExpenseInput>, traceId: string) {
      const guard = guardExpense(patch);
      if (guard) return Promise.resolve(guard);
      return repository.updateExpense(id, patch, traceId);
    },
    reclassifyExpense: (id: string, scope: PersonalScope, entity: string | undefined, traceId: string) => {
      if (entity && containsForbiddenMaterial(entity)) return Promise.resolve(fail("forbidden personal data"));
      return repository.reclassifyExpense(id, scope, entity, traceId);
    },
    saveContext(input: ContextInput) {
      if (input.kind === "forbidden" || containsForbiddenMaterial(`${input.key} ${input.value}`)) return Promise.resolve(fail("forbidden personal data"));
      if (input.kind === "sensitive" && input.consent !== true) return Promise.resolve(fail("explicit consent required"));
      if (input.kind === "ephemeral") return Promise.resolve({ status: "no_persisted" as const, error: "ephemeral context was not persisted" });
      return repository.saveContext(input);
    },
    correctContext(id: string, input: ContextInput) {
      if (input.kind === "forbidden" || containsForbiddenMaterial(`${input.key} ${input.value}`)) return Promise.resolve(fail("forbidden personal data"));
      if (input.kind === "sensitive" && input.consent !== true) return Promise.resolve(fail("explicit consent required"));
      if (input.kind === "ephemeral") return Promise.resolve({ status: "no_persisted" as const, error: "ephemeral context was not persisted" });
      return repository.correctContext(id, input);
    },
    listContext: () => repository.listContext(),
    forgetContext: (id: string, traceId: string) => repository.forgetContext(id, traceId),
    createCase(input: { name: string; description?: string; traceId: string }) {
      if (scanForForbidden(input).forbidden) return Promise.resolve(fail("forbidden personal data"));
      return repository.createCase(input);
    },
    addCaseEvent(input: { caseId: string; type: "note" | "pending" | "reference" | "status"; content: string; traceId: string }) {
      if (scanForForbidden(input).forbidden) return Promise.resolve(fail("forbidden personal data"));
      return repository.addCaseEvent(input);
    },
    listCaseEvents: (caseId: string) => repository.listCaseEvents(caseId),
    guide(input: GuidanceInput): GuidanceResult {
      const context = input.context.length ? input.context.join("; ") : "No hay contexto durable suficiente.";
      return { recommendation: `Priorizar una prueba reversible sobre: ${input.decision}. Contexto: ${context}`, objection: "La recomendación puede ser incorrecta si faltan datos o si cambian las restricciones.", uncertainties: ["La información disponible puede estar incompleta o desactualizada."], nextSteps: ["Definir el resultado esperado", "Elegir una acción local y reversible", "Fijar una fecha de revisión"], externalActionExecuted: false };
    },
  };
}
