import { describe, expect, it, vi } from "vitest";
import type { MessageStore } from "../src/contracts.js";
import { createBootstrapProcessor } from "../src/modules/bootstrapProcessor.js";

describe("bootstrapProcessor", () => {
  it("generates, sends and records a response after claiming a buffer", async () => {
    const complete = vi.fn();
    const store: MessageStore = {
      async ingest() { return { accepted: true, duplicate: false }; },
      async claimDue() {
        return [{ buffer_id: "b1", trace_id: "t1", account_id: 6, inbox_id: 44, conversation_id: 20, messages: [{ id: 1, content: "hola", created_at: "now" }] }];
      },
      complete,
      async fail() {},
    };
    const processor = createBootstrapProcessor(
      store,
      { async generate() { return "respuesta"; } },
      { async send() { return { id: 99 }; } },
      { info: vi.fn(), error: vi.fn() },
    );
    await processor.processDue();
    expect(complete).toHaveBeenCalledWith("b1", "respuesta", 99);
  });
});
