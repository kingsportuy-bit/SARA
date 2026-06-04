import { describe, expect, it } from "vitest";
import { createProtocolsModule } from "../src/modules/protocols/protocolsModule.js";
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
  ProtocolRecord,
  ProtocolSuggestion,
} from "../src/contracts/protocols.js";

function fakeRepo(): ProtocolsRepository {
  const protocols: ProtocolRecord[] = [
    {
      id: "p1",
      name: "energia baja",
      slug: "energia-baja",
      status: "active",
      scope: "daily",
      rules: [{ condition: "dormi menos de 6 horas", action: "bajar carga y priorizar rutina liviana" }],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "p2",
      name: "descanso activo",
      slug: "descanso-activo",
      status: "active",
      scope: "fitness",
      rules: [{ condition: "energia entre 1 y 5", action: "hacer ejercicios de movilidad" }],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];

  return {
    async createProtocol(input: CreateProtocolInput): Promise<CreateProtocolResult> {
      return {
        schemaVersion: "protocols_create_result.v1",
        traceId: input.traceId,
        status: "created",
        protocolId: "p-uuid-1",
        eventId: "ev-uuid-1",
        name: input.name,
        slug: input.slug,
        scope: input.scope,
        evidence: {
          protocolId: "p-uuid-1",
          eventId: "ev-uuid-1",
          eventType: "protocol_created",
        },
      };
    },
    async listProtocols(input: ListProtocolsInput): Promise<ListProtocolsResult> {
      const filtered = protocols.filter((p) => {
        if (input.status && p.status !== input.status) return false;
        if (input.scope && p.scope !== input.scope) return false;
        return true;
      });
      return {
        schemaVersion: "protocols_list_result.v1",
        traceId: input.traceId,
        status: "success",
        protocols: filtered,
        count: filtered.length,
      };
    },
    async activateProtocol(input: ActivateProtocolInput): Promise<ActivateProtocolResult> {
      return {
        schemaVersion: "protocols_activate_result.v1",
        traceId: input.traceId,
        status: "activated",
        protocolId: input.protocolId ?? "p-uuid-1",
        eventId: "ev-uuid-1",
        name: "energia baja",
        slug: input.slug ?? "energia-baja",
        scope: "daily",
        evidence: {
          protocolId: input.protocolId ?? "p-uuid-1",
          eventId: "ev-uuid-1",
          eventType: "protocol_activated",
        },
      };
    },
    async archiveProtocol(input: ArchiveProtocolInput): Promise<ArchiveProtocolResult> {
      return {
        schemaVersion: "protocols_archive_result.v1",
        traceId: input.traceId,
        status: "archived",
        protocolId: input.protocolId ?? "p-uuid-1",
        eventId: "ev-uuid-1",
        name: "energia baja",
        slug: input.slug ?? "energia-baja",
        scope: "daily",
        evidence: {
          protocolId: input.protocolId ?? "p-uuid-1",
          eventId: "ev-uuid-1",
          eventType: "protocol_archived",
        },
      };
    },
    async evaluateProtocol(input: EvaluateProtocolInput): Promise<EvaluateProtocolResult> {
      const suggestions: ProtocolSuggestion[] = [
        {
          rule: { condition: "dormi menos de 6 horas", action: "bajar carga y priorizar rutina liviana" },
          applies: true,
          suggestion: "bajar carga y priorizar rutina liviana",
          evidence: "sleepHours: 5 < 6 horas",
        },
      ];
      return {
        schemaVersion: "protocols_evaluate_result.v1",
        traceId: input.traceId,
        status: "evaluated",
        protocolId: input.protocolId ?? "p-uuid-1",
        eventId: "ev-uuid-1",
        name: "energia baja",
        slug: input.slug ?? "energia-baja",
        scope: "daily",
        suggestions,
        evidence: {
          protocolId: input.protocolId ?? "p-uuid-1",
          eventId: "ev-uuid-1",
          eventType: "protocol_evaluated",
          rulesCount: 1,
          rulesMatched: 1,
        },
      };
    },
  };
}

describe("protocolsModule - create", () => {
  it("creates a protocol with valid input", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "protocols_create_input.v1",
      traceId: "trace-1",
      name: "energia baja",
      slug: "energia-baja",
      scope: "daily",
      rules: [{ condition: "dormi menos de 6 horas", action: "bajar carga" }],
      source: "chatwoot",
    });

    expect(result.status).toBe("created");
    expect(result.protocolId).toBe("p-uuid-1");
    expect(result.evidence.eventType).toBe("protocol_created");
  });

  it("rejects empty name", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "protocols_create_input.v1",
      traceId: "trace-1",
      name: "",
      slug: "some-slug",
      scope: "daily",
      rules: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("name");
  });

  it("rejects empty slug", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "protocols_create_input.v1",
      traceId: "trace-1",
      name: "valid name",
      slug: "",
      scope: "daily",
      rules: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("slug");
  });

  it("rejects invalid scope", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "protocols_create_input.v1",
      traceId: "trace-1",
      name: "valid",
      slug: "valid",
      scope: "invalid" as "daily",
      rules: [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("scope");
  });

  it("rejects non-array rules", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.create({
      schemaVersion: "protocols_create_input.v1",
      traceId: "trace-1",
      name: "valid",
      slug: "valid",
      scope: "daily",
      rules: null as unknown as [],
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
  });
});

describe("protocolsModule - list", () => {
  it("lists active protocols via repository", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.list({
      schemaVersion: "protocols_list_input.v1",
      traceId: "trace-1",
    });

    expect(result.status).toBe("success");
    expect(result.protocols.length).toBe(2);
    expect(result.count).toBe(2);
  });
});

describe("protocolsModule - activate", () => {
  it("activates a protocol by slug", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.activate({
      schemaVersion: "protocols_activate_input.v1",
      traceId: "trace-1",
      slug: "energia-baja",
      source: "chatwoot",
    });

    expect(result.status).toBe("activated");
    expect(result.evidence.eventType).toBe("protocol_activated");
  });

  it("fails to activate without identifier", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.activate({
      schemaVersion: "protocols_activate_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("protocolId or slug");
  });
});

describe("protocolsModule - archive", () => {
  it("archives a protocol by slug", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "protocols_archive_input.v1",
      traceId: "trace-1",
      slug: "energia-baja",
      source: "chatwoot",
    });

    expect(result.status).toBe("archived");
    expect(result.evidence.eventType).toBe("protocol_archived");
  });

  it("fails to archive without identifier", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.archive({
      schemaVersion: "protocols_archive_input.v1",
      traceId: "trace-1",
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("protocolId or slug");
  });
});

describe("protocolsModule - evaluate", () => {
  it("evaluates a protocol by slug with context", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.evaluate({
      schemaVersion: "protocols_evaluate_input.v1",
      traceId: "trace-1",
      slug: "energia-baja",
      context: { sleepHours: 5 },
      source: "chatwoot",
    });

    expect(result.status).toBe("evaluated");
    expect(result.evidence.eventType).toBe("protocol_evaluated");
    expect(result.evidence.rulesMatched).toBe(1);
  });

  it("fails to evaluate without identifier", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.evaluate({
      schemaVersion: "protocols_evaluate_input.v1",
      traceId: "trace-1",
      context: {},
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("protocolId or slug");
  });

  it("fails to evaluate when protocol not found", async () => {
    const mod = createProtocolsModule(fakeRepo());
    const result = await mod.evaluate({
      schemaVersion: "protocols_evaluate_input.v1",
      traceId: "trace-1",
      slug: "protocolo-inexistente",
      context: {},
      source: "chatwoot",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("not found");
  });
});
