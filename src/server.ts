import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createChatwootClient } from "./infra/chatwootClient.js";
import { createDeepseekClient } from "./infra/deepseekClient.js";
import { createSupabaseStore } from "./infra/supabaseStore.js";
import { createBootstrapProcessor } from "./modules/bootstrapProcessor.js";

const config = loadConfig();
const store = createSupabaseStore(config.supabase.url, config.supabase.serviceRoleKey);
const app = buildApp(config, store);
const processor = createBootstrapProcessor(
  store,
  createDeepseekClient(config.deepseek.apiKey, config.deepseek.model),
  createChatwootClient(config.chatwoot.url, config.chatwoot.accountId, config.chatwoot.userToken),
  app.log,
);

setInterval(() => void processor.processDue(), config.workerIntervalMs).unref();

await app.listen({ host: "0.0.0.0", port: config.port });
