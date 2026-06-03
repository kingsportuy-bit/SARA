import { describe, expect, it } from "vitest";
import { createResponseComposer } from "../src/modules/responseComposer.js";
import type { ResponseCompositionInput } from "../src/contracts/pipeline.js";

const composer = createResponseComposer();

const baseInput: ResponseCompositionInput = {
  schemaVersion: "response_composition_input.v1",
  traceId: "trace-1",
  messages: [{ id: 1, content: "hola", createdAt: "2026-06-02T00:00:00Z" }],
  classification: {
    coarse: {
      schemaVersion: "coarse_classification_result.v1",
      traceId: "trace-1",
      module: "unknown",
      confidence: 0.5,
      missingData: [],
      reasoningSummary: "Skeleton classifier.",
    },
    intent: {
      schemaVersion: "module_intent_result.v1",
      traceId: "trace-1",
      module: "unknown",
      action: "none",
      confidence: 0.1,
      entities: {},
      missingData: ["intent classification not implemented"],
      requiresConfirmation: false,
      reasoningSummary: "Skeleton classifier.",
    },
  },
  actionResult: {
    schemaVersion: "action_execution_result.v1",
    traceId: "trace-1",
    status: "skipped",
    evidence: { reason: "No domain modules." },
    stateChanges: [],
  },
};

describe("responseComposer", () => {
  it("returns schema version v1 with traceId", async () => {
    const result = await composer.compose(baseInput);

    expect(result.schemaVersion).toBe("response_composition_result.v1");
    expect(result.traceId).toBe("trace-1");
  });

  it("reports missing data when intent has missingData", async () => {
    const result = await composer.compose(baseInput);

    expect(result.content).toContain("No tengo suficiente informacion");
    expect(result.evidenceUsed).toHaveProperty("classification");
    expect(result.evidenceUsed).toHaveProperty("actionStatus");
  });

  it("reports low confidence when coarse confidence < 0.75", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.4 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("No estoy segura");
  });

  it("reports needs_confirmation status", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "needs_confirmation",
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("confirmacion explicita");
  });

  it("reports skipped status", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "skipped",
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("modulo solicitado aun no esta disponible");
  });

  it("reports executed status with evidence", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { noteId: "n1", eventId: "e1" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Accion ejecutada");
  });

  it("does not confirm executed without noteId or eventId evidence", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {},
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar la evidencia");
  });

  it("does not confirm executed with only reason in evidence", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { reason: "some operation" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar la evidencia");
  });

  it("does not confirm executed with only noteId but no eventId", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { noteId: "n1" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar la evidencia");
  });

  it("does not confirm executed with only eventId but no noteId", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { eventId: "e1" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar la evidencia");
  });

  it("confirms executed when both noteId and eventId present", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { noteId: "n1", eventId: "e1" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Accion ejecutada correctamente");
  });

  it("reports failed status with error message", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9 },
        intent: { ...baseInput.classification.intent, missingData: [] },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "failed",
        error: "DB connection lost",
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("DB connection lost");
  });

  it("formats list results with notes", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "notes" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "list", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {
          notes: [
            { noteType: "observacion", content: "tercera prueba real con RPC cache corregida" },
            { noteType: "idea", content: "crear una rutina semanal de revision" },
          ],
          count: 2,
        },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Estas son tus ultimas notas:");
    expect(result.content).toContain("1. [observacion]");
    expect(result.content).toContain("2. [idea]");
    expect(result.content).not.toContain("0. [observacion]");
    expect(result.content).toContain("[observacion]");
    expect(result.content).toContain("[idea]");
    expect(result.content).toContain("tercera prueba real");
    expect(result.content).toContain("rutina semanal");
  });

  it("shows empty message for list with no results", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "notes" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "list", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { notes: [], count: 0 },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("No encontre notas");
  });

  it("formats search results with query", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "notes" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "search", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {
          notes: [
            { noteType: "aprendizaje", content: "dormir bien mejora el foco" },
          ],
          count: 1,
          query: "foco",
        },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Resultados de busqueda para");
    expect(result.content).toContain("\"foco\"");
    expect(result.content).toContain("[aprendizaje]");
  });

  it("shows search-specific empty message for no search results", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "notes" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "search", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { notes: [], count: 0, query: "inexistente" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("No encontre notas para");
    expect(result.content).toContain("inexistente");
  });

  it("truncates long note content in list format", async () => {
    const longContent = "a".repeat(100);
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "notes" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "list", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {
          notes: [{ noteType: "observacion", content: longContent }],
          count: 1,
        },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("...");
  });

  it("confirms task create with taskId and eventId", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "tasks" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "create", confidence: 0.85, entities: { title: "llamar al contador" } },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { taskId: "t1", eventId: "e1", title: "llamar al contador" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Tarea creada:");
    expect(result.content).toContain("llamar al contador");
  });

  it("does not confirm task create without evidence", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "tasks" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "create", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {},
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar la evidencia");
  });

  it("confirms task complete with taskId and eventId", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "tasks" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "complete", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { taskId: "t1", eventId: "e1", title: "llamar al contador" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Tarea completada:");
    expect(result.content).toContain("llamar al contador");
  });

  it("does not confirm task complete without evidence", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "tasks" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "complete", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {},
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar la evidencia");
  });

  it("formats task list results from index 1", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "tasks" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "list", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {
          tasks: [
            { title: "llamar al contador" },
            { title: "revisar facturas" },
          ],
          count: 2,
        },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Estas son tus tareas pendientes:");
    expect(result.content).toContain("1. llamar al contador");
    expect(result.content).toContain("2. revisar facturas");
  });

  it("shows empty message for task list with no results", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "tasks" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "list", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { tasks: [], count: 0 },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("No encontre tareas pendientes");
  });
});

describe("responseComposer reminders", () => {
  it("confirms reminder create with reminderId and eventId", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "reminders" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "create", confidence: 0.85, entities: { title: "llamar al contador", dueAt: "2026-06-10T10:00:00Z" } },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { reminderId: "r1", eventId: "e1", title: "llamar al contador", dueAt: "2026-06-10T10:00:00Z" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Recordatorio creado");
    expect(result.content).toContain("llamar al contador");
  });

  it("does not confirm reminder create without evidence", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "reminders" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "create", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {},
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar la evidencia");
  });

  it("confirms reminder cancel with reminderId and eventId", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "reminders" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "cancel", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { reminderId: "r1", eventId: "e1", title: "llamar al contador" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Recordatorio cancelado:");
    expect(result.content).toContain("llamar al contador");
  });

  it("does not confirm reminder cancel without evidence", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "reminders" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "cancel", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {},
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar la evidencia");
  });

  it("formats reminder list results", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "reminders" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "list", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {
          reminders: [
            { title: "llamar al contador", dueAt: "2026-06-10T10:00:00Z" },
            { title: "revisar facturas", dueAt: "2026-06-11T15:00:00Z" },
          ],
          count: 2,
        },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Estos son tus recordatorios pendientes:");
    expect(result.content).toContain("1.");
    expect(result.content).toContain("2.");
    expect(result.content).toContain("llamar al contador");
    expect(result.content).toContain("revisar facturas");
  });

  it("shows empty message for reminder list with no results", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "reminders" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "list", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { reminders: [], count: 0 },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("No encontre recordatorios pendientes");
  });
});

describe("responseComposer daily-log", () => {
  it("confirms morning only with dailyLogId and eventId", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "daily-log" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "morning", confidence: 0.85, entities: { date: "2026-06-03" } },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { dailyLogId: "dl1", eventId: "e1", date: "2026-06-03" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Registro de manana actualizado para 2026-06-03");
  });

  it("shows warning when morning evidence is missing", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "daily-log" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "morning", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {},
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar");
  });

  it("confirms evening only with dailyLogId and eventId", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "daily-log" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "evening", confidence: 0.85, entities: { date: "2026-06-03" } },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { dailyLogId: "dl1", eventId: "e2", date: "2026-06-03" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Cierre del dia actualizado para 2026-06-03");
  });

  it("shows warning when evening evidence is missing", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "daily-log" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "evening", confidence: 0.85 },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {},
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("no se puede verificar");
  });

  it("formats summary with data", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "daily-log" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "summary", confidence: 0.85, entities: { date: "2026-06-03" } },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {
          dailyLog: {
            wakeEnergy: 7,
            sleepHours: 6.5,
            morningIntention: "terminar propuestas",
            eveningReview: "termine propuestas y camine",
          },
          dailyLogId: "dl1",
          date: "2026-06-03",
        },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("Resumen de 2026-06-03");
    expect(result.content).toContain("Energia: 7");
    expect(result.content).toContain("Sueno: 6.5");
    expect(result.content).toContain("Intencion: terminar propuestas");
    expect(result.content).toContain("Cierre: termine propuestas y camine");
  });

  it("shows sin dato for missing summary fields", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "daily-log" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "summary", confidence: 0.85, entities: { date: "2026-06-03" } },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: {
          dailyLog: {},
          date: "2026-06-03",
        },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("sin dato");
  });

  it("shows not found message when summary yields no record", async () => {
    const input: ResponseCompositionInput = {
      ...baseInput,
      classification: {
        ...baseInput.classification,
        coarse: { ...baseInput.classification.coarse, confidence: 0.9, module: "daily-log" },
        intent: { ...baseInput.classification.intent, missingData: [], action: "summary", confidence: 0.85, entities: { date: "2026-06-03" } },
      },
      actionResult: {
        ...baseInput.actionResult,
        status: "executed",
        evidence: { date: "2026-06-03" },
      },
    };
    const result = await composer.compose(input);

    expect(result.content).toContain("No encontre registro diario");
  });
});
