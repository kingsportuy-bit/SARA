import { describe, expect, it } from "vitest";
import { createModuleRouter, registerModule } from "../src/modules/moduleRouter.js";
import type { ModuleIntentResult } from "../src/contracts/pipeline.js";

const router = createModuleRouter();

function intent(overrides?: Partial<ModuleIntentResult>): ModuleIntentResult {
  return {
    schemaVersion: "module_intent_result.v1",
    traceId: "trace-1",
    module: "unknown",
    action: "none",
    confidence: 0.1,
    entities: {},
    missingData: [],
    requiresConfirmation: false,
    reasoningSummary: "",
    ...overrides,
  };
}

describe("moduleRouter", () => {
  it("returns not executable for unregistered module", async () => {
    const result = await router.route(intent({ module: "notes", action: "create" }));

    expect(result.schemaVersion).toBe("route_result.v1");
    expect(result.traceId).toBe("trace-1");
    expect(result.module).toBe("notes");
    expect(result.action).toBe("create");
    expect(result.executable).toBe(false);
    expect(result.reason).toContain("not registered");
  });

  it("returns not executable for unknown module", async () => {
    const result = await router.route(intent({ module: "unknown", action: "none" }));

    expect(result.executable).toBe(false);
    expect(result.reason).toContain("not registered");
  });

  it("returns not executable for daily-log module (not registered)", async () => {
    const result = await router.route(intent({ module: "daily-log", action: "checkin" }));

    expect(result.executable).toBe(false);
  });

  it("returns a reason when module is not executable", async () => {
    const result = await router.route(intent({ module: "session-context", action: "start" }));

    expect(result.executable).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("marks notes.create executable after registration", async () => {
    registerModule("notes", ["create"]);
    const registered = createModuleRouter();

    const result = await registered.route(intent({ module: "notes", action: "create" }));
    expect(result.executable).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects unregistered action within registered module", async () => {
    registerModule("notes", ["create"]);
    const registered = createModuleRouter();

    const result = await registered.route(intent({ module: "notes", action: "delete" }));
    expect(result.executable).toBe(false);
    expect(result.reason).toContain("not registered");
  });

  it("marks tasks.create executable after registration", async () => {
    registerModule("tasks", ["create"]);
    const registered = createModuleRouter();

    const result = await registered.route(intent({ module: "tasks", action: "create" }));
    expect(result.executable).toBe(true);
  });

  it("marks tasks.list executable after registration", async () => {
    registerModule("tasks", ["create", "list"]);
    const registered = createModuleRouter();

    const result = await registered.route(intent({ module: "tasks", action: "list" }));
    expect(result.executable).toBe(true);
  });

  it("marks tasks.complete executable after registration", async () => {
    registerModule("tasks", ["create", "list", "complete"]);
    const registered = createModuleRouter();

    const result = await registered.route(intent({ module: "tasks", action: "complete" }));
    expect(result.executable).toBe(true);
  });

  it("marks TASK-20260603-020 module actions executable after registration", async () => {
    registerModule("routines", ["create"]);
    registerModule("workouts", ["start", "log-set"]);
    registerModule("timers", ["start"]);
    registerModule("progress", ["workout"]);
    registerModule("plans", ["create"]);
    registerModule("protocols", ["evaluate"]);
    const registered = createModuleRouter();

    await expect(registered.route(intent({ module: "routines", action: "create" }))).resolves.toMatchObject({ executable: true });
    await expect(registered.route(intent({ module: "workouts", action: "log-set" }))).resolves.toMatchObject({ executable: true });
    await expect(registered.route(intent({ module: "timers", action: "start" }))).resolves.toMatchObject({ executable: true });
    await expect(registered.route(intent({ module: "progress", action: "workout" }))).resolves.toMatchObject({ executable: true });
    await expect(registered.route(intent({ module: "plans", action: "create" }))).resolves.toMatchObject({ executable: true });
    await expect(registered.route(intent({ module: "protocols", action: "evaluate" }))).resolves.toMatchObject({ executable: true });
  });
});
