import { describe, expect, it } from "vitest";
import { createPlansModule } from "../src/modules/plans/plansModule.js";
import type {
  CreatePlanInput,
  CreatePlanResult,
  ListPlansInput,
  ListPlansResult,
  ArchivePlanInput,
  ArchivePlanResult,
  CompletePlanStepInput,
  CompletePlanStepResult,
  PlansRepository,
} from "../src/contracts/plans.js";

function fakeRepo(): PlansRepository {
  return {
    async createPlan(input: CreatePlanInput): Promise<CreatePlanResult> {
      return {
        schemaVersion: "plans_create_result.v1",
        traceId: input.traceId,
        status: "created",
        planId: "plan-uuid-1",
        eventId: "event-uuid-1",
        title: input.title,
        slug: input.slug,
        objectiveId: input.objectiveId,
        stepTitles: input.steps.map((s) => s.title),
        evidence: {
          planId: "plan-uuid-1",
          eventId: "event-uuid-1",
          eventType: "plan_created",
        },
      };
    },
    async listPlans(input: ListPlansInput): Promise<ListPlansResult> {
      return {
        schemaVersion: "plans_list_result.v1",
        traceId: input.traceId,
        status: "success",
        plans: [
          {
            id: "p1",
            title: "mejorar energia",
            slug: "mejorar-energia",
            status: "active",
            steps: [
              { id: "s1", planId: "p1", position: 1, title: "caminar 20 minutos", status: "pending", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
              { id: "s2", planId: "p1", position: 2, title: "dormir antes de 23", status: "pending", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
            ],
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
        count: 1,
      };
    },
    async archivePlan(input: ArchivePlanInput): Promise<ArchivePlanResult> {
      return {
        schemaVersion: "plans_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        planId: input.planId ?? "plan-uuid-1",
        eventId: "event-uuid-1",
        title: "mejorar energia",
        slug: input.slug ?? "mejorar-energia",
        evidence: {
          planId: input.planId ?? "plan-uuid-1",
          eventId: "event-uuid-1",
          eventType: "plan_archived",
        },
      };
    },
    async completePlanStep(input: CompletePlanStepInput): Promise<CompletePlanStepResult> {
      return {
        schemaVersion: "plans_complete_step_result.v1",
        traceId: input.traceId,
        status: "completed",
        stepId: "step-uuid-1",
        eventId: "event-uuid-1",
        planId: "plan-uuid-1",
        position: input.stepPosition ?? 1,
        title: "caminar 20 minutos",
        evidence: {
          stepId: "step-uuid-1",
          eventId: "event-uuid-1",
          eventType: "plan_step_completed",
        },
      };
    },
  };
}

describe("plansModule - create", () => {
  it("creates a plan with valid input", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "plans_create_input.v1",
      traceId: "trace-1",
      title: "mejorar energia",
      slug: "mejorar-energia",
      steps: [{ title: "caminar 20 minutos" }, { title: "dormir antes de 23" }],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.planId).toBe("plan-uuid-1");
    expect(result.evidence.eventType).toBe("plan_created");
    expect(result.stepTitles).toEqual(["caminar 20 minutos", "dormir antes de 23"]);
  });

  it("rejects empty title", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "plans_create_input.v1",
      traceId: "trace-1",
      title: "",
      slug: "some-slug",
      steps: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("title");
  });

  it("rejects empty slug", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "plans_create_input.v1",
      traceId: "trace-1",
      title: "valid title",
      slug: "",
      steps: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("slug");
  });

  it("creates a plan with optional objectiveId", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "plans_create_input.v1",
      traceId: "trace-1",
      title: "mejorar energia",
      slug: "mejorar-energia",
      objectiveId: "obj-uuid-1",
      steps: [{ title: "caminar 20 minutos" }],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.objectiveId).toBe("obj-uuid-1");
  });
});

describe("plansModule - list", () => {
  it("lists plans via repository", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.list({
      schemaVersion: "plans_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.plans.length).toBe(1);
    expect(result.count).toBe(1);
    expect(result.plans[0].steps.length).toBe(2);
  });
});

describe("plansModule - archive", () => {
  it("archives a plan by slug", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "plans_archive_input.v1",
      traceId: "trace-1",
      slug: "mejorar-energia",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.evidence.eventType).toBe("plan_archived");
  });

  it("archives a plan by planId", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "plans_archive_input.v1",
      traceId: "trace-1",
      planId: "plan-uuid-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.planId).toBe("plan-uuid-1");
  });

  it("fails to archive without identifier", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "plans_archive_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("planId or slug");
  });
});

describe("plansModule - completeStep", () => {
  it("completes a step by stepId", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.completeStep({
      schemaVersion: "plans_complete_step_input.v1",
      traceId: "trace-1",
      stepId: "step-uuid-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("completed");
    expect(result.evidence.eventType).toBe("plan_step_completed");
  });

  it("completes a step by planSlug and position", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.completeStep({
      schemaVersion: "plans_complete_step_input.v1",
      traceId: "trace-1",
      planSlug: "mejorar-energia",
      stepPosition: 1,
      source: "chatwoot",
    });

    expect(result.status).toBe("completed");
    expect(result.position).toBe(1);
  });

  it("fails to complete step without identifiers", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.completeStep({
      schemaVersion: "plans_complete_step_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("stepId or (planSlug + stepPosition)");
  });

  it("fails to complete step with only planSlug but no position", async () => {
    const mod = createPlansModule(fakeRepo());
    const result = await mod.completeStep({
      schemaVersion: "plans_complete_step_input.v1",
      traceId: "trace-1",
      planSlug: "mejorar-energia",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("stepId or (planSlug + stepPosition)");
  });
});
