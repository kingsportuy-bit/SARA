import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function integer(name: string, fallback?: number): number {
  const raw = process.env[name]?.trim();
  if (!raw && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`Environment variable ${name} must be true or false`);
}

export interface AppConfig {
  port: number;
  bufferSeconds: number;
  workerIntervalMs: number;
  remindersDispatcherIntervalMs: number;
  chatwoot: {
    url: string;
    accountId: number;
    inboxId: number;
    conversationId: number;
    userToken: string;
    webhookSecret?: string;
    verifySignature: boolean;
  };
  deepseek: {
    apiKey: string;
    model: string;
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
}

export function loadConfig(): AppConfig {
  const verifySignature = boolean("CHATWOOT_VERIFY_SIGNATURE", true);
  const webhookSecret = process.env.CHATWOOT_WEBHOOK_SECRET?.trim();
  if (verifySignature && !webhookSecret) {
    throw new Error("CHATWOOT_WEBHOOK_SECRET is required when signature verification is enabled");
  }

  return {
    port: integer("PORT", 3000),
    bufferSeconds: integer("SARA_BUFFER_SECONDS", 20),
    workerIntervalMs: integer("SARA_WORKER_INTERVAL_MS", 2000),
    remindersDispatcherIntervalMs: integer("SARA_REMINDERS_DISPATCHER_INTERVAL_MS", 30000),
    chatwoot: {
      url: required("CHATWOOT_URL").replace(/\/$/, ""),
      accountId: integer("CHATWOOT_ACCOUNT_ID"),
      inboxId: integer("CHATWOOT_INBOX_ID"),
      conversationId: integer("CHATWOOT_CONVERSATION_ID"),
      userToken: required("CHATWOOT_USER_TOKEN"),
      webhookSecret,
      verifySignature,
    },
    deepseek: {
      apiKey: required("DEEPSEEK_API_KEY"),
      model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
    },
    supabase: {
      url: required("SUPABASE_URL").replace(/\/$/, ""),
      serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    },
  };
}
