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

  it("sara_reminders has RLS enabled and anon/authenticated access revoked", () => {
    const sql = readFileSync("db/migrations/20260603_010_reminders.sql", "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on sara_reminders from anon, authenticated");
  });

  it("sara_reminders has status check constraint", () => {
    const sql = readFileSync("db/migrations/20260603_010_reminders.sql", "utf8");
    expect(sql).toContain("sara_reminders_status_check");
    expect(sql).toContain("status in ('pending', 'processing', 'sent', 'canceled', 'failed')");
  });

  it("sara_create_reminder rejects empty title", () => {
    const sql = readFileSync("db/migrations/20260603_010_reminders.sql", "utf8");
    expect(sql).toContain("title cannot be empty");
  });

  it("sara_create_reminder rejects past due_at", () => {
    const sql = readFileSync("db/migrations/20260603_010_reminders.sql", "utf8");
    expect(sql).toContain("due_at must be in the future");
  });

  it("sara_cancel_reminder fails when titleMatch is ambiguous", () => {
    const sql = readFileSync("db/migrations/20260603_010_reminders.sql", "utf8");
    expect(sql).toContain("multiple matching pending reminders found");
  });

  it("sara_claim_due_reminders claims only pending with due_at <= now", () => {
    const sql = readFileSync("db/migrations/20260603_010_reminders.sql", "utf8");
    expect(sql).toContain("where status = 'pending'");
    expect(sql).toContain("and due_at <= now()");
    expect(sql).toContain("status = 'processing'");
    expect(sql).toContain("and account_id = p_account_id");
    expect(sql).toContain("and inbox_id = p_inbox_id");
    expect(sql).toContain("and conversation_id = p_conversation_id");
    expect(sql).toContain("limit greatest(coalesce(p_limit, 10), 1)");
    expect(sql).toContain("for update skip locked");
  });

  it("sara_reminders RPC signatures do not put defaults before required params", () => {
    const sql = readFileSync("db/migrations/20260603_010_reminders.sql", "utf8");
    expect(sql).not.toMatch(/p_message\s+text\s+default[\s\S]*p_due_at\s+timestamptz/i);
    expect(sql).not.toMatch(/p_reminder_id\s+uuid\s+default[\s\S]*p_account_id\s+bigint/i);
  });

  it("sara_mark_reminder_sent only works on processing status", () => {
    const sql = readFileSync("db/migrations/20260603_010_reminders.sql", "utf8");
    expect(sql).toContain("status = 'processing'");
  });

  it("sara_daily_log has unique constraint on date", () => {
    const sql = readFileSync("db/migrations/20260603_011_daily_log.sql", "utf8");
    expect(sql).toContain("sara_daily_log_date_unique");
    expect(sql).toContain("unique (date)");
  });

  it("sara_daily_log has RLS enabled and anon/authenticated access revoked", () => {
    const sql = readFileSync("db/migrations/20260603_011_daily_log.sql", "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on sara_daily_log from anon, authenticated");
  });

  it("sara_daily_log validates wake_energy between 1 and 10", () => {
    const sql = readFileSync("db/migrations/20260603_011_daily_log.sql", "utf8");
    expect(sql).toContain("sara_daily_log_wake_energy_check");
    expect(sql).toContain("wake_energy >= 1 and wake_energy <= 10");
  });

  it("sara_daily_log validates sleep_hours >= 0", () => {
    const sql = readFileSync("db/migrations/20260603_011_daily_log.sql", "utf8");
    expect(sql).toContain("sara_daily_log_sleep_hours_check");
    expect(sql).toContain("sleep_hours >= 0");
  });

  it("sara_upsert_daily_log_morning emits daily_log_created for new records", () => {
    const sql = readFileSync("db/migrations/20260603_011_daily_log.sql", "utf8");
    expect(sql).toContain("daily_log_created");
    expect(sql).toContain("daily_log_morning_updated");
  });

  it("sara_upsert_daily_log_evening emits daily_log_created for new records and daily_log_evening_updated for updates", () => {
    const sql = readFileSync("db/migrations/20260603_011_daily_log.sql", "utf8");
    expect(sql).toContain("daily_log_created");
    expect(sql).toContain("daily_log_evening_updated");
  });

  it("daily_log RPCs are restricted to service_role", () => {
    const sql = readFileSync("db/migrations/20260603_011_daily_log.sql", "utf8");
    expect(sql).toContain("revoke execute on function sara_upsert_daily_log_morning");
    expect(sql).toContain("grant execute on function sara_upsert_daily_log_morning");
    expect(sql).toContain("revoke execute on function sara_upsert_daily_log_evening");
    expect(sql).toContain("grant execute on function sara_upsert_daily_log_evening");
    expect(sql).toContain("to service_role");
  });

  it("sara_areas has unique constraint on slug", () => {
    const sql = readFileSync("db/migrations/20260603_012_areas.sql", "utf8");
    expect(sql).toContain("sara_areas_slug_unique");
    expect(sql).toContain("unique (slug)");
  });

  it("sara_areas has RLS enabled and anon/authenticated access revoked", () => {
    const sql = readFileSync("db/migrations/20260603_012_areas.sql", "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table sara_areas from anon, authenticated");
  });

  it("sara_areas has status check constraint", () => {
    const sql = readFileSync("db/migrations/20260603_012_areas.sql", "utf8");
    expect(sql).toContain("sara_areas_status_valid");
    expect(sql).toContain("status in ('active', 'paused', 'archived')");
  });

  it("sara_create_area rejects empty name", () => {
    const sql = readFileSync("db/migrations/20260603_012_areas.sql", "utf8");
    expect(sql).toContain("area name cannot be empty");
  });

  it("sara_create_area rejects duplicate slug", () => {
    const sql = readFileSync("db/migrations/20260603_012_areas.sql", "utf8");
    expect(sql).toContain("already exists");
  });

  it("sara_archive_area fails if area not found", () => {
    const sql = readFileSync("db/migrations/20260603_012_areas.sql", "utf8");
    expect(sql).toContain("area not found");
  });

  it("areas RPCs are restricted to service_role", () => {
    const sql = readFileSync("db/migrations/20260603_012_areas.sql", "utf8");
    expect(sql).toContain("revoke execute on function sara_create_area");
    expect(sql).toContain("grant execute on function sara_create_area");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("revoke execute on function sara_archive_area");
    expect(sql).toContain("grant execute on function sara_archive_area");
    expect(sql).toContain("revoke execute on function sara_assign_note_area");
    expect(sql).toContain("grant execute on function sara_assign_note_area");
    expect(sql).toContain("revoke execute on function sara_assign_task_area");
    expect(sql).toContain("grant execute on function sara_assign_task_area");
  });

  it("sara_objectives validates success_criteria as json array", () => {
    const sql = readFileSync("db/migrations/20260603_013_objectives.sql", "utf8");
    expect(sql).toContain("sara_objectives_success_criteria_array");
    expect(sql).toContain("jsonb_typeof(success_criteria) = 'array'");
  });

  it("sara_start_timer RPC signatures match parameter order", () => {
    const sql = readFileSync("db/migrations/20260603_016_timers.sql", "utf8");
    const signature =
      sql.match(/create or replace function sara_start_timer\(([\s\S]*?)\)\s*returns jsonb/i)?.[1] ?? "";
    expect(signature).toContain("p_account_id bigint");
    expect(signature).toContain("p_related_entity_type text default null");
    expect(signature.indexOf("p_conversation_id bigint")).toBeLessThan(
      signature.indexOf("p_related_entity_type text default null"),
    );
    expect(signature).not.toMatch(/p_related_entity_type\s+text\s+default[\s\S]*p_account_id\s+bigint/i);
    expect(sql).toContain("sara_start_timer(uuid, text, text, integer, bigint, bigint, bigint, text, uuid, text)");
  });
});
