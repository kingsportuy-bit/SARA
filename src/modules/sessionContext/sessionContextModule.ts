import type {
  SessionContextRecord,
  GetSessionContextInput,
  GetSessionContextResult,
  UpsertSessionContextInput,
  UpsertSessionContextResult,
  ClearSessionContextInput,
  ClearSessionContextResult,
  SessionContextRepository,
} from "../../contracts/sessionContext.js";

export interface SessionContextModule {
  get(input: GetSessionContextInput): Promise<GetSessionContextResult>;
  upsert(input: UpsertSessionContextInput): Promise<UpsertSessionContextResult>;
  clear(input: ClearSessionContextInput): Promise<ClearSessionContextResult>;
}

export function createSessionContextModule(repository: SessionContextRepository): SessionContextModule {
  return {
    async get(input) {
      if (!input.accountId || !input.inboxId || !input.conversationId) {
        return { context: null };
      }
      return repository.get(input);
    },

    async upsert(input) {
      if (!input.accountId || !input.inboxId || !input.conversationId) {
        throw new Error("accountId, inboxId, and conversationId are required");
      }
      return repository.upsert(input);
    },

    async clear(input) {
      if (!input.accountId || !input.inboxId || !input.conversationId) {
        return { cleared: false, reason: "accountId, inboxId, and conversationId are required" };
      }
      return repository.clear(input);
    },
  };
}
