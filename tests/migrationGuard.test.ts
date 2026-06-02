import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("migration guard", () => {
  it("creates, alters and updates only sara_ objects", () => {
    const sql = readFileSync("db/migrations/20260602_001_chatwoot_bootstrap.sql", "utf8");
    const objects = [...sql.matchAll(/\b(?:table|index|function)\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)]
      .map((match) => match[1])
      .filter((name) => name !== "if");
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.every((name) => name.startsWith("sara_"))).toBe(true);
  });
});
