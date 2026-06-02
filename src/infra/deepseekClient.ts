import type { ResponseGenerator } from "../contracts.js";

export function createDeepseekClient(apiKey: string, model: string): ResponseGenerator {
  return {
    async generate(messages) {
      const content = messages.map((message) => message.content).join("\n");
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Sos SARA, un asistente personal en fase bootstrap. Responde en espanol, de forma breve y util. Todavia no podes ejecutar acciones: no afirmes haber guardado, cambiado o realizado nada. Si te piden una accion, explica que el modulo aun no esta habilitado.",
            },
            { role: "user", content },
          ],
          temperature: 0.4,
        }),
      });
      if (!response.ok) {
        throw new Error(`DeepSeek HTTP ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const answer = body.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error("DeepSeek returned an empty response");
      return answer;
    },
  };
}
