export type NormalizedMessage = {
  id: string;
  content: string;
  originalContent: string;
  createdAt: string;
  normalization: {
    removedChatwootGroupHeader: boolean;
  };
};

export interface MessageNormalizer {
  normalize(messages: Array<{ id: number; content: string; createdAt: string }>): NormalizedMessage[];
}

const CHATWOOT_GROUP_HEADER_REGEX = /^\*\*.+?\*\*\s*/;

export function createMessageNormalizer(): MessageNormalizer {
  return {
    normalize(messages) {
      return messages.map((m) => {
        const cleaned = m.content.replace(CHATWOOT_GROUP_HEADER_REGEX, "").trim();
        const removed = cleaned !== m.content.trim();
        return {
          id: String(m.id),
          content: cleaned,
          originalContent: m.content,
          createdAt: m.createdAt,
          normalization: {
            removedChatwootGroupHeader: removed,
          },
        };
      });
    },
  };
}
