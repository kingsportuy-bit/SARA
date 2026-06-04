import { describe, expect, it } from "vitest";
import { createModuleIntentClassifier } from "../src/modules/moduleIntentClassifier.js";

const classifier = createModuleIntentClassifier();

describe("moduleIntentClassifier", () => {
  it("returns none action with missingData for unknown module", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-1",
      module: "unknown",
      messages: [{ id: 1, content: "hola", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.schemaVersion).toBe("module_intent_result.v1");
    expect(result.traceId).toBe("trace-1");
    expect(result.module).toBe("unknown");
    expect(result.action).toBe("none");
    expect(result.confidence).toBe(0.1);
    expect(result.entities).toEqual({});
    expect(result.missingData).toContain("intent classification not implemented");
    expect(result.requiresConfirmation).toBe(false);
    expect(result.reasoningSummary).toBeDefined();
  });

  it("preserves module from input in result when no intent detected", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-2",
      module: "daily-log",
      messages: [{ id: 2, content: "como estoy hoy", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.module).toBe("daily-log");
    expect(result.action).toBe("none");
  });
});

describe("moduleIntentClassifier TASK-20260603-020 modules", () => {
  it("detects routines.create", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-routines-020",
      module: "routines",
      messages: [{ id: 1, content: "crear rutina manana normal: 07:00 despertar", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.entities).toHaveProperty("slug", "manana-normal");
    expect(result.missingData).toEqual([]);
  });

  it("resolves workouts.log-set from workout session context", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-workouts-020",
      module: "workouts",
      messages: [{ id: 1, content: "sentadilla serie 1 8 reps 60kg", createdAt: "now" }],
      sessionContext: { focusedEntityType: "workout_session", focusedEntityId: "session-1" },
    });

    expect(result.action).toBe("log-set");
    expect(result.entities).toHaveProperty("sessionId", "session-1");
    expect(result.missingData).toEqual([]);
  });

  it("blocks workouts.log-set without workout session context", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-workouts-020-missing",
      module: "workouts",
      messages: [{ id: 1, content: "sentadilla serie 1 8 reps 60kg", createdAt: "now" }],
    });

    expect(result.action).toBe("log-set");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("workoutSession");
  });

  it("detects timers.start", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-timers-020",
      module: "timers",
      messages: [{ id: 1, content: "descanso 90 segundos", createdAt: "now" }],
    });

    expect(result.action).toBe("start");
    expect(result.entities).toHaveProperty("kind", "workout_rest");
    expect(result.entities).toHaveProperty("durationSeconds", 90);
  });

  it("detects progress.objective read-only intent", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-progress-020",
      module: "progress",
      messages: [{ id: 1, content: "progreso objetivo mejorar energia", createdAt: "now" }],
    });

    expect(result.action).toBe("objective");
    expect(result.entities).toHaveProperty("objectiveSlug", "mejorar-energia");
  });

  it("detects plans.create", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-plans-020",
      module: "plans",
      messages: [{ id: 1, content: "crear plan mejorar energia: caminar; dormir", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.missingData).toEqual([]);
  });

  it("detects protocols.evaluate", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-protocols-020",
      module: "protocols",
      messages: [{ id: 1, content: "evaluar protocolo energia baja", createdAt: "now" }],
      sessionContext: { context: { sleepHours: 5 } },
    });

    expect(result.action).toBe("evaluate");
    expect(result.entities).toHaveProperty("slug", "energia-baja");
  });
});

describe("moduleIntentClassifier notes.create detection", () => {
  it("detects nota: prefix and extracts content", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n1",
      module: "notes",
      messages: [{ id: 1, content: "nota: recordar que dormir poco me baja mucho el foco", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.module).toBe("notes");
    expect(result.action).toBe("create");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
    expect(result.entities).toHaveProperty("content", "recordar que dormir poco me baja mucho el foco");
    expect(result.requiresConfirmation).toBe(false);
  });

  it("detects guarda una nota prefix", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n2",
      module: "notes",
      messages: [{ id: 1, content: "guarda una nota: revisar el protocolo de Barberox", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
  });

  it("detects anota esto as prefix", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n3",
      module: "notes",
      messages: [{ id: 1, content: "anota esto como idea: crear una rutina semanal de revision", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("create");
    expect(result.entities).toHaveProperty("content");
    expect(result.missingData).toEqual([]);
  });

  it("returns missingData when prefix has no content", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n4",
      module: "notes",
      messages: [{ id: 1, content: "nota:", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("content");
  });

  it("detects notes.create with already-normalized content (no Chatwoot header in classifier)", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-nh1",
      module: "notes",
      messages: [{ id: 1, content: "nota: recordar que esta es la primera prueba real", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
  });

  it("does not detect notes.create for non-notes modules", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n5",
      module: "unknown",
      messages: [{ id: 1, content: "nota: esto es importante", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("none");
    expect(result.confidence).toBe(0.1);
  });

  it("does not detect notes.create for daily-log module", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n6",
      module: "daily-log",
      messages: [{ id: 1, content: "nota: esto no deberia activar", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("none");
  });

  it("does no false positive on non-note messages in notes module", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-n7",
      module: "notes",
      messages: [{ id: 1, content: "hola que tal", createdAt: "2026-06-02T00:00:00Z" }],
    });

    expect(result.action).toBe("none");
    expect(result.confidence).toBe(0.1);
  });
});

describe("moduleIntentClassifier notes.list detection", () => {
  it("detects list intent from que notas tengo", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-l1",
      module: "notes",
      messages: [{ id: 1, content: "que notas tengo", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
    expect(result.action).toBe("list");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
    expect(result.requiresConfirmation).toBe(false);
  });

  it("detects list intent from listar notas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-l2",
      module: "notes",
      messages: [{ id: 1, content: "listar notas", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });

  it("detects list intent from ultimas notas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-l3",
      module: "notes",
      messages: [{ id: 1, content: "ultimas notas", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });

  it("detects list intent from mis notas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-l4",
      module: "notes",
      messages: [{ id: 1, content: "mis notas", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });

  it("detects list intent from lista mis notas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-l5",
      module: "notes",
      messages: [{ id: 1, content: "lista mis notas", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });
});

describe("moduleIntentClassifier notes.search detection", () => {
  it("detects search intent from busca notas sobre foco", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-s1",
      module: "notes",
      messages: [{ id: 1, content: "busca notas sobre foco", createdAt: "now" }],
    });

    expect(result.module).toBe("notes");
    expect(result.action).toBe("search");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
    expect(result.entities).toHaveProperty("query", "foco");
  });

  it("detects search intent from buscar notas sobre foco", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-s2",
      module: "notes",
      messages: [{ id: 1, content: "buscar notas sobre foco", createdAt: "now" }],
    });

    expect(result.action).toBe("search");
    expect(result.entities).toHaveProperty("query", "foco");
  });

  it("detects search intent from notas sobre sueño", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-s3",
      module: "notes",
      messages: [{ id: 1, content: "notas sobre sueño", createdAt: "now" }],
    });

    expect(result.action).toBe("search");
    expect(result.entities).toHaveProperty("query", "sueño");
  });

  it("detects search intent from notas de tipo idea", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-s4",
      module: "notes",
      messages: [{ id: 1, content: "notas de tipo idea", createdAt: "now" }],
    });

    expect(result.action).toBe("search");
    expect(result.entities).toHaveProperty("query", "idea");
  });

  it("prefers search over list when query pattern matches", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-s5",
      module: "notes",
      messages: [{ id: 1, content: "notas sobre entrenamiento", createdAt: "now" }],
    });

    expect(result.action).toBe("search");
  });
});

describe("moduleIntentClassifier tasks.create detection", () => {
  it("detects tarea: prefix and extracts title", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tc1",
      module: "tasks",
      messages: [{ id: 1, content: "tarea: llamar al contador", createdAt: "now" }],
    });

    expect(result.module).toBe("tasks");
    expect(result.action).toBe("create");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
    expect(result.entities).toHaveProperty("title", "llamar al contador");
  });

  it("detects crear tarea: prefix", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tc2",
      module: "tasks",
      messages: [{ id: 1, content: "crear tarea: revisar facturas", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.entities).toHaveProperty("title", "revisar facturas");
  });

  it("detects tengo que and extracts title", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tc3",
      module: "tasks",
      messages: [{ id: 1, content: "tengo que ordenar la bandeja de entrada", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.entities).toHaveProperty("title", "ordenar la bandeja de entrada");
  });

  it("detects debo and extracts title", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tc4",
      module: "tasks",
      messages: [{ id: 1, content: "debo enviar el informe", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.entities).toHaveProperty("title", "enviar el informe");
  });

  it("returns missingData when title is empty", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tc5",
      module: "tasks",
      messages: [{ id: 1, content: "tarea:", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("title");
  });

  it("does not detect tasks for non-tasks module", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tc6",
      module: "notes",
      messages: [{ id: 1, content: "tarea: hacer algo", createdAt: "now" }],
    });

    expect(result.action).toBe("none");
  });
});

describe("moduleIntentClassifier tasks.list detection", () => {
  it("detects list intent from que tareas tengo", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tl1",
      module: "tasks",
      messages: [{ id: 1, content: "que tareas tengo", createdAt: "now" }],
    });

    expect(result.module).toBe("tasks");
    expect(result.action).toBe("list");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
  });

  it("detects list intent from listar tareas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tl2",
      module: "tasks",
      messages: [{ id: 1, content: "listar tareas", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });

  it("detects list intent from mis tareas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tl3",
      module: "tasks",
      messages: [{ id: 1, content: "mis tareas", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });

  it("detects list intent from tareas pendientes", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tl4",
      module: "tasks",
      messages: [{ id: 1, content: "tareas pendientes", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });

  it("detects list intent from lista mis tareas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tl5",
      module: "tasks",
      messages: [{ id: 1, content: "lista mis tareas", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });
});

describe("moduleIntentClassifier tasks.complete detection", () => {
  it("detects complete with position from completar tarea N", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tx1",
      module: "tasks",
      messages: [{ id: 1, content: "completar tarea 1", createdAt: "now" }],
    });

    expect(result.module).toBe("tasks");
    expect(result.action).toBe("complete");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("position", 1);
  });

  it("detects complete with position from marcar tarea N como hecha", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tx2",
      module: "tasks",
      messages: [{ id: 1, content: "marcar tarea 2 como hecha", createdAt: "now" }],
    });

    expect(result.action).toBe("complete");
    expect(result.entities).toHaveProperty("position", 2);
  });

  it("detects complete with titleMatch from complete X", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tx3",
      module: "tasks",
      messages: [{ id: 1, content: "complete llamar al contador", createdAt: "now" }],
    });

    expect(result.action).toBe("complete");
    expect(result.entities).toHaveProperty("titleMatch", "llamar al contador");
  });

  it("detects complete with titleMatch from termine X", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-tx4",
      module: "tasks",
      messages: [{ id: 1, content: "termine revisar facturas", createdAt: "now" }],
    });

    expect(result.action).toBe("complete");
    expect(result.entities).toHaveProperty("titleMatch", "revisar facturas");
  });
});

describe("moduleIntentClassifier tasks.complete reference resolution", () => {
  it("resolves completar esa with focused task in session context", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-r1",
      module: "tasks",
      messages: [{ id: 1, content: "completar esa", createdAt: "now" }],
      sessionContext: {
        focusedEntityType: "task",
        focusedEntityId: "task-focused-1",
        context: { lastTaskTitle: "llamar al contador" },
      },
    });

    expect(result.action).toBe("complete");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("taskId", "task-focused-1");
    expect(result.missingData).toEqual([]);
  });

  it("resolves completar la ultima tarea with focused task", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-r2",
      module: "tasks",
      messages: [{ id: 1, content: "completar la ultima tarea", createdAt: "now" }],
      sessionContext: {
        focusedEntityType: "task",
        focusedEntityId: "task-focused-2",
      },
    });

    expect(result.action).toBe("complete");
    expect(result.entities).toHaveProperty("taskId", "task-focused-2");
  });

  it("resolves marcar esa como hecha with focused task", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-r3",
      module: "tasks",
      messages: [{ id: 1, content: "marcar esa como hecha", createdAt: "now" }],
      sessionContext: {
        focusedEntityType: "task",
        focusedEntityId: "task-3",
      },
    });

    expect(result.action).toBe("complete");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("taskId", "task-3");
  });

  it("resolves from lastTaskList when single task in context", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-r4",
      module: "tasks",
      messages: [{ id: 1, content: "completar la ultima", createdAt: "now" }],
      sessionContext: {
        context: {
          lastTaskList: [{ position: 1, id: "task-abc", title: "llamar al contador" }],
        },
      },
    });

    expect(result.action).toBe("complete");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("taskId", "task-abc");
  });

  it("returns missingData when session context is undefined (ambiguous)", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-r5",
      module: "tasks",
      messages: [{ id: 1, content: "completar esa", createdAt: "now" }],
    });

    expect(result.action).toBe("complete");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("task");
  });

  it("returns missingData when lastTaskList has multiple tasks (ambiguous)", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-r6",
      module: "tasks",
      messages: [{ id: 1, content: "completar la ultima tarea", createdAt: "now" }],
      sessionContext: {
        context: {
          lastTaskList: [
            { position: 1, id: "t1", title: "a" },
            { position: 2, id: "t2", title: "b" },
          ],
        },
      },
    });

    expect(result.action).toBe("complete");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("task");
  });

  it("resolves marcar la ultima tarea como hecha with focused task", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-r7",
      module: "tasks",
      messages: [{ id: 1, content: "marcar la ultima tarea como hecha", createdAt: "now" }],
      sessionContext: {
        focusedEntityType: "task",
        focusedEntityId: "task-x7",
      },
    });

    expect(result.action).toBe("complete");
    expect(result.entities).toHaveProperty("taskId", "task-x7");
  });
});

describe("moduleIntentClassifier reminders.create detection", () => {
  it("detects recordame en N minutos and extracts title and dueAt", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rc1",
      module: "reminders",
      messages: [{ id: 1, content: "recordame en 5 minutos llamar al contador", createdAt: "now" }],
    });

    expect(result.module).toBe("reminders");
    expect(result.action).toBe("create");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
    expect(result.entities).toHaveProperty("title", "llamar al contador");
    expect(result.entities).toHaveProperty("dueAt");
  });

  it("detects recordame en N horas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rc2",
      module: "reminders",
      messages: [{ id: 1, content: "recordame en 2 horas revisar facturas", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.entities).toHaveProperty("dueAt");
  });

  it("detects recordame manana a las 9", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rc3",
      module: "reminders",
      messages: [{ id: 1, content: "recordame manana a las 9 llamar al banco", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.entities).toHaveProperty("dueAt");
    expect(result.entities).toHaveProperty("title", "llamar al banco");
  });

  it("returns missingData when time cannot be parsed", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rc4",
      module: "reminders",
      messages: [{ id: 1, content: "recordame llamar al contador", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("dueAt");
  });

  it("returns missingData when title is empty", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rc5",
      module: "reminders",
      messages: [{ id: 1, content: "recordame en 5 minutos", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("title");
  });
});

describe("moduleIntentClassifier reminders.list detection", () => {
  it("detects list intent from que recordatorios tengo", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rl1",
      module: "reminders",
      messages: [{ id: 1, content: "que recordatorios tengo", createdAt: "now" }],
    });

    expect(result.module).toBe("reminders");
    expect(result.action).toBe("list");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
  });

  it("detects list intent from listar recordatorios", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rl2",
      module: "reminders",
      messages: [{ id: 1, content: "listar recordatorios", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });

  it("detects list intent from mis recordatorios", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rl3",
      module: "reminders",
      messages: [{ id: 1, content: "mis recordatorios", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });
});

describe("moduleIntentClassifier reminders.cancel detection", () => {
  it("detects cancel with position from cancelar recordatorio N", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rx1",
      module: "reminders",
      messages: [{ id: 1, content: "cancelar recordatorio 1", createdAt: "now" }],
    });

    expect(result.module).toBe("reminders");
    expect(result.action).toBe("cancel");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("position", 1);
  });

  it("detects cancel with titleMatch", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rx2",
      module: "reminders",
      messages: [{ id: 1, content: "cancelar recordatorio llamar al contador", createdAt: "now" }],
    });

    expect(result.action).toBe("cancel");
    expect(result.entities).toHaveProperty("titleMatch", "llamar al contador");
  });

  it("detects eliminar recordatorio N", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rx3",
      module: "reminders",
      messages: [{ id: 1, content: "eliminar recordatorio 2", createdAt: "now" }],
    });

    expect(result.action).toBe("cancel");
    expect(result.entities).toHaveProperty("position", 2);
  });
});

describe("moduleIntentClassifier reminders.cancel reference resolution", () => {
  it("resolves cancelar ese with focused reminder in session context", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rr1",
      module: "reminders",
      messages: [{ id: 1, content: "cancelar ese", createdAt: "now" }],
      sessionContext: {
        focusedEntityType: "reminder",
        focusedEntityId: "reminder-focused-1",
        context: { lastReminderTitle: "llamar al banco" },
      },
    });

    expect(result.action).toBe("cancel");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("reminderId", "reminder-focused-1");
    expect(result.missingData).toEqual([]);
  });

  it("resolves cancelar el ultimo recordatorio from lastReminderList with single entry", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rr2",
      module: "reminders",
      messages: [{ id: 1, content: "cancelar el ultimo recordatorio", createdAt: "now" }],
      sessionContext: {
        context: {
          lastReminderList: [{ position: 1, id: "rem-abc", title: "llamar al banco", dueAt: "2026-06-10T10:00:00Z" }],
        },
      },
    });

    expect(result.action).toBe("cancel");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("reminderId", "rem-abc");
  });

  it("returns missingData when session context is undefined (ambiguous cancel)", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-rr3",
      module: "reminders",
      messages: [{ id: 1, content: "cancelar ese", createdAt: "now" }],
    });

    expect(result.action).toBe("cancel");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("reminder");
  });
});

describe("moduleIntentClassifier daily-log detection", () => {
  it("detects daily-log.morning from buen dia", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl1",
      module: "daily-log",
      messages: [{ id: 1, content: "buen dia energia 7 dormi 6.5 foco terminar propuestas", createdAt: "now" }],
    });

    expect(result.module).toBe("daily-log");
    expect(result.action).toBe("morning");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("wakeEnergy", 7);
    expect(result.entities).toHaveProperty("sleepHours", 6.5);
    expect(result.entities).toHaveProperty("morningIntention");
    expect(result.missingData).toEqual([]);
  });

  it("detects daily-log.morning from checkin manana", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl2",
      module: "daily-log",
      messages: [{ id: 1, content: "checkin manana energia 8 dormi 7 intencion ordenar agenda", createdAt: "now" }],
    });

    expect(result.action).toBe("morning");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("detects daily-log.evening from cierre del dia", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl3",
      module: "daily-log",
      messages: [{ id: 1, content: "cierre del dia avance termine propuestas y camine", createdAt: "now" }],
    });

    expect(result.module).toBe("daily-log");
    expect(result.action).toBe("evening");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.entities).toHaveProperty("eveningReview");
    expect(result.missingData).toEqual([]);
  });

  it("detects daily-log.evening from cierre de hoy", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl4",
      module: "daily-log",
      messages: [{ id: 1, content: "cierre de hoy avance logre avanzar", createdAt: "now" }],
    });

    expect(result.action).toBe("evening");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("detects daily-log.evening from fin del dia", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl5",
      module: "daily-log",
      messages: [{ id: 1, content: "fin del dia avance termine todo", createdAt: "now" }],
    });

    expect(result.action).toBe("evening");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("detects daily-log.summary from resumen del dia", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl6",
      module: "daily-log",
      messages: [{ id: 1, content: "resumen del dia", createdAt: "now" }],
    });

    expect(result.module).toBe("daily-log");
    expect(result.action).toBe("summary");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.missingData).toEqual([]);
  });

  it("detects daily-log.summary from como estuvo mi dia", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl7",
      module: "daily-log",
      messages: [{ id: 1, content: "como estuvo mi dia", createdAt: "now" }],
    });

    expect(result.action).toBe("summary");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("detects daily-log.summary from que tal mi dia", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl8",
      module: "daily-log",
      messages: [{ id: 1, content: "que tal mi dia", createdAt: "now" }],
    });

    expect(result.action).toBe("summary");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("returns low confidence for morning without updatable fields", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl9",
      module: "daily-log",
      messages: [{ id: 1, content: "buen dia", createdAt: "now" }],
    });

    expect(result.action).toBe("morning");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("dailyLogFields");
  });

  it("returns low confidence for evening without updatable fields", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-dl10",
      module: "daily-log",
      messages: [{ id: 1, content: "cierre del dia", createdAt: "now" }],
    });

    expect(result.action).toBe("evening");
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.missingData).toContain("dailyLogFields");
  });

  it("detects areas.create intent from crear area", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-areas-1",
      module: "areas",
      messages: [{ id: 1, content: "crear area salud", createdAt: "now" }],
    });

    expect(result.action).toBe("create");
    expect(result.confidence).toBe(0.85);
    expect(result.entities).toHaveProperty("name", "salud");
    expect(result.entities).toHaveProperty("slug", "salud");
    expect(result.missingData).toEqual([]);
  });

  it("detects areas.list intent from que areas tengo", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-areas-2",
      module: "areas",
      messages: [{ id: 1, content: "que areas tengo", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
    expect(result.confidence).toBe(0.85);
    expect(result.missingData).toEqual([]);
  });

  it("detects areas.list intent from listar areas", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-areas-3",
      module: "areas",
      messages: [{ id: 1, content: "listar areas", createdAt: "now" }],
    });

    expect(result.action).toBe("list");
  });

  it("detects areas.archive intent from archivar area salud", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-areas-4",
      module: "areas",
      messages: [{ id: 1, content: "archivar area salud", createdAt: "now" }],
    });

    expect(result.action).toBe("archive");
    expect(result.confidence).toBe(0.85);
    expect(result.entities).toHaveProperty("areaSlug", "salud");
  });

  it("detects areas.assign-note intent from asociar esa nota al area", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-areas-5",
      module: "areas",
      messages: [{ id: 1, content: "asociar esa nota al area salud", createdAt: "now" }],
      sessionContext: {
        focusedEntityType: "note",
        focusedEntityId: "note-uuid-1",
      },
    });

    expect(result.action).toBe("assign-note");
    expect(result.confidence).toBe(0.85);
    expect(result.entities).toHaveProperty("areaSlug", "salud");
    expect(result.entities).toHaveProperty("noteId", "note-uuid-1");
  });

  it("detects areas.assign-task intent from asociar esa tarea al area", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-areas-6",
      module: "areas",
      messages: [{ id: 1, content: "asociar esa tarea al area salud", createdAt: "now" }],
      sessionContext: {
        focusedEntityType: "task",
        focusedEntityId: "task-uuid-1",
      },
    });

    expect(result.action).toBe("assign-task");
    expect(result.confidence).toBe(0.85);
    expect(result.entities).toHaveProperty("areaSlug", "salud");
    expect(result.entities).toHaveProperty("taskId", "task-uuid-1");
  });

  it("areas.assign does not execute with ambiguous entity", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-areas-7",
      module: "areas",
      messages: [{ id: 1, content: "asociar esa tarea al area salud", createdAt: "now" }],
    });

    expect(result.action).toBe("assign-task");
    expect(result.confidence).toBe(0.4);
    expect(result.missingData).toContain("entity");
  });

  it("areas.assign does not execute without area", async () => {
    const result = await classifier.classify({
      schemaVersion: "module_intent_input.v1",
      traceId: "trace-areas-8",
      module: "areas",
      messages: [{ id: 1, content: "asignar esa tarea al area", createdAt: "now" }],
    });

    expect(result.confidence).toBe(0.4);
    expect(result.missingData).toContain("area");
  });
});
