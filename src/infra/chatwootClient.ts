import type { OutboundChatwoot } from "../contracts.js";

export function createChatwootClient(url: string, accountId: number, userToken: string): OutboundChatwoot {
  return {
    async send(conversationId, content) {
      const response = await fetch(`${url}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "api_access_token": userToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, message_type: "outgoing", private: false, content_type: "text" }),
      });
      if (!response.ok) {
        throw new Error(`Chatwoot HTTP ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as { id?: number };
      if (!body.id) throw new Error("Chatwoot returned an invalid outbound message");
      return { id: body.id };
    },
  };
}
