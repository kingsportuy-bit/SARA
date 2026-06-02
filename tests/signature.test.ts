import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyChatwootSignature } from "../src/modules/signature.js";

describe("verifyChatwootSignature", () => {
  it("accepts a valid signature", () => {
    const body = Buffer.from('{"event":"message_created"}');
    const timestamp = "1000";
    const secret = "secret";
    const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
    expect(verifyChatwootSignature(body, timestamp, signature, secret, 1000)).toBe(true);
  });

  it("rejects expired signatures", () => {
    const body = Buffer.from("{}");
    const timestamp = "1000";
    const signature = `sha256=${createHmac("sha256", "secret").update(`${timestamp}.${body}`).digest("hex")}`;
    expect(verifyChatwootSignature(body, timestamp, signature, "secret", 1400)).toBe(false);
  });
});
