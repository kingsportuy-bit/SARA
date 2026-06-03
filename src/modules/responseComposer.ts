import type { ResponseCompositionInput, ResponseCompositionResult } from "../contracts/pipeline.js";

export interface ResponseComposer {
  compose(input: ResponseCompositionInput): Promise<ResponseCompositionResult>;
}

function formatNoteLine(note: { noteType: string; content: string }, index: number): string {
  const preview = note.content.length > 60 ? note.content.slice(0, 57) + "..." : note.content;
  return `${index + 1}. [${note.noteType}] ${preview}`;
}

export function createResponseComposer(): ResponseComposer {
  return {
    async compose(input) {
      const { classification, actionResult } = input;
      let content: string;

      if (classification.intent.missingData.length > 0) {
        content = "No tengo suficiente informacion para procesar tu mensaje. " + classification.intent.reasoningSummary;
      } else if (classification.coarse.confidence < 0.75) {
        content = "No estoy segura de haber entendido bien. " + classification.coarse.reasoningSummary;
      } else if (actionResult.status === "needs_confirmation") {
        content = "Esta accion requiere confirmacion explicita antes de ejecutarse.";
      } else if (actionResult.status === "skipped") {
        content = "El modulo solicitado aun no esta disponible. Estoy en fase de construccion.";
      } else if (actionResult.status === "failed") {
        content = actionResult.error
          ? `La accion no pudo completarse: ${actionResult.error}`
          : "La accion no pudo completarse por un error inesperado.";
      } else if (actionResult.status === "executed") {
        const action = classification.intent.action;

        if (action === "list" || action === "search") {
          const notes = actionResult.evidence?.notes as Array<{ noteType: string; content: string }> | undefined;
          const count = actionResult.evidence?.count as number | undefined;
          const searchQuery = actionResult.evidence?.query as string | undefined;

          if (!notes || count === 0) {
            content = searchQuery
              ? `No encontre notas para "${searchQuery}".`
              : "No encontre notas todavia.";
          } else if (action === "search") {
            const lines = notes.map(formatNoteLine).join("\n");
            content = `Resultados de busqueda para "${searchQuery || ""}":\n${lines}`;
          } else {
            const lines = notes.map(formatNoteLine).join("\n");
            content = `Estas son tus ultimas notas:\n${lines}`;
          }
        } else {
          const noteId = actionResult.evidence?.noteId;
          const eventId = actionResult.evidence?.eventId;
          if (noteId && eventId) {
            content = "Accion ejecutada correctamente.";
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        }
      } else {
        content = "Recibi tu mensaje pero no pude procesarlo en este momento.";
      }

      return {
        schemaVersion: "response_composition_result.v1",
        traceId: input.traceId,
        content,
        evidenceUsed: {
          classification: {
            module: classification.coarse.module,
            action: classification.intent.action,
            confidence: classification.intent.confidence,
          },
          actionStatus: actionResult.status,
        },
      };
    },
  };
}
