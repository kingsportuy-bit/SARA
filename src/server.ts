import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createChatwootClient } from "./infra/chatwootClient.js";
import { createDeepseekClient } from "./infra/deepseekClient.js";
import { createSupabaseClient, createSupabaseStore } from "./infra/supabaseStore.js";
import { createNotesStore } from "./infra/notesStore.js";
import { createNotesModule } from "./modules/notes/notesModule.js";
import { createCoarseClassifier } from "./modules/coarseClassifier.js";
import { createModuleIntentClassifier } from "./modules/moduleIntentClassifier.js";
import { createModuleRouter, registerModule } from "./modules/moduleRouter.js";
import { createActionExecutor } from "./modules/actionExecutor.js";
import { createResponseComposer } from "./modules/responseComposer.js";
import { createBufferProcessor } from "./modules/bufferProcessor.js";
import type { CreateNoteInput } from "./contracts/notes.js";
import type { ActionExecutionInput, ActionExecutionResult } from "./contracts/pipeline.js";

const config = loadConfig();
const supabase = createSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey);
const store = createSupabaseStore(supabase);
const app = buildApp(config, store);

const notesStore = createNotesStore(supabase);
const notesModule = createNotesModule(notesStore);

registerModule("notes", ["create"]);

function notesCreateHandler(input: ActionExecutionInput): Promise<ActionExecutionResult> {
  const createInput: CreateNoteInput = {
    schemaVersion: "notes_create_input.v1",
    traceId: input.traceId,
    content: String(input.entities.content ?? ""),
    noteType: (input.entities.noteType as CreateNoteInput["noteType"]) || "observacion",
    source: "chatwoot",
    tags: Array.isArray(input.entities.tags) ? (input.entities.tags as string[]) : [],
  };
  return notesModule.create(createInput).then((noteResult) => {
    if (noteResult.status === "created") {
      return {
        schemaVersion: "action_execution_result.v1",
        traceId: input.traceId,
        status: "executed",
        evidence: {
          noteId: noteResult.noteId,
          eventId: noteResult.eventId,
        },
        stateChanges: [
          {
            entityType: "note",
            entityId: noteResult.noteId,
            eventType: "note_created",
            payload: {},
          },
        ],
      };
    }
    return {
      schemaVersion: "action_execution_result.v1",
      traceId: input.traceId,
      status: "failed",
      evidence: {},
      stateChanges: [],
      error: noteResult.error,
    };
  });
}

const processor = createBufferProcessor({
  store,
  coarseClassifier: createCoarseClassifier(),
  intentClassifier: createModuleIntentClassifier(),
  router: createModuleRouter(),
  executor: createActionExecutor({ notes: { create: notesCreateHandler } }),
  composer: createResponseComposer(),
  fallbackGenerator: createDeepseekClient(config.deepseek.apiKey, config.deepseek.model),
  outbound: createChatwootClient(config.chatwoot.url, config.chatwoot.accountId, config.chatwoot.userToken),
  logger: app.log,
});

setInterval(() => void processor.processDue(), config.workerIntervalMs).unref();

await app.listen({ host: "0.0.0.0", port: config.port });
