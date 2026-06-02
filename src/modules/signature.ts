import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyChatwootSignature(
  rawBody: Buffer,
  timestamp: string | undefined,
  receivedSignature: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!timestamp || !receivedSignature) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowSeconds - sentAt) > 300) return false;

  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]);
  const expected = `sha256=${createHmac("sha256", secret).update(signedPayload).digest("hex")}`;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(receivedSignature);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}
