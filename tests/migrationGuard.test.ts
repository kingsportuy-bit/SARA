import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("migration guard", () => {
  it("creates, alters and updates only sara_ objects", () => {
    const sql = readdirSync("db/migrations")
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFileSync(`db/migrations/${file}`, "utf8"))
      .join("\n");
    const objects = [...sql.matchAll(/\b(?:table|index|function)\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)]
      .map((match) => match[1])
      .filter((name) => name !== "if");
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.every((name) => name.startsWith("sara_"))).toBe(true);
  });

  it("tasks complete by title fails when match is ambiguous", () => {
    const sql = readFileSync("db/migrations/20260603_008_tasks.sql", "utf8");
    expect(sql).toContain("multiple matching pending tasks found");
    expect(sql).toContain("v_match_count > 1");
  });

  it("sara_session_contexts has unique constraint on account/inbox/conversation", () => {
    const sql = readFileSync("db/migrations/20260603_009_session_context.sql", "utf8");
    expect(sql).toContain("sara_session_contexts_unique_conversation");
    expect(sql).toContain("unique (account_id, inbox_id, conversation_id)");
  });

  it("sara_session_contexts has RLS enabled and anon/authenticated access revoked", () => {
    const sql = readFileSync("db/migrations/20260603_009_session_context.sql", "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on sara_session_contexts from anon, authenticated");
  });

  it("session context upsert can clear focus and renews TTL", () => {
    const sql = readFileSync("db/migrations/20260603_009_session_context.sql", "utf8");
    expect(sql).toContain("focused_entity_type = p_focused_entity_type");
    expect(sql).toContain("focused_entity_id = p_focused_entity_id");
    expect(sql).toContain("expires_at = now() + (coalesce(p_ttl_minutes, 30) || ' minutes')::interval");
  });
});
