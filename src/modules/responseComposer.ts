import type { ResponseCompositionInput, ResponseCompositionResult } from "../contracts/pipeline.js";
import { formatDueAt } from "./reminders/reminderTimeParser.js";

export interface ResponseComposer {
  compose(input: ResponseCompositionInput): Promise<ResponseCompositionResult>;
}

function formatNoteLine(note: { noteType: string; content: string }, index: number): string {
  const preview = note.content.length > 60 ? note.content.slice(0, 57) + "..." : note.content;
  return `${index + 1}. [${note.noteType}] ${preview}`;
}

function formatTaskLine(task: { title: string }, index: number): string {
  return `${index + 1}. ${task.title}`;
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
        const module = classification.coarse.module;

        if (module === "tasks") {
          if (action === "create") {
            const taskId = actionResult.evidence?.taskId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title ?? classification.intent.entities?.title;
            if (taskId && eventId) {
              content = title ? `Tarea creada: ${title}` : "Tarea creada.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "list") {
            const tasks = actionResult.evidence?.tasks as Array<{ title: string }> | undefined;
            const count = actionResult.evidence?.count as number | undefined;
            if (!tasks || count === 0) {
              content = "No encontre tareas pendientes.";
            } else {
              const lines = tasks.map(formatTaskLine).join("\n");
              content = `Estas son tus tareas pendientes:\n${lines}`;
            }
          } else if (action === "complete") {
            const taskId = actionResult.evidence?.taskId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title;
            if (taskId && eventId) {
              content = title ? `Tarea completada: ${title}` : "Tarea completada.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (module === "reminders") {
          if (action === "create") {
            const reminderId = actionResult.evidence?.reminderId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title ?? classification.intent.entities?.title;
            const dueAt = actionResult.evidence?.dueAt ?? classification.intent.entities?.dueAt;
            if (reminderId && eventId) {
              const formattedDue = dueAt ? formatDueAt(String(dueAt)) : "fecha pendiente";
              content = title
                ? `Recordatorio creado para ${formattedDue}: ${title}`
                : `Recordatorio creado para ${formattedDue}.`;
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "list") {
            const reminders = actionResult.evidence?.reminders as Array<{ title: string; dueAt: string }> | undefined;
            const count = actionResult.evidence?.count as number | undefined;
            if (!reminders || count === 0) {
              content = "No encontre recordatorios pendientes.";
            } else {
              const lines = reminders.map((r, i) => {
                const formattedDue = r.dueAt ? formatDueAt(r.dueAt) : "fecha pendiente";
                return `${i + 1}. ${formattedDue} - ${r.title}`;
              }).join("\n");
              content = `Estos son tus recordatorios pendientes:\n${lines}`;
            }
          } else if (action === "cancel") {
            const reminderId = actionResult.evidence?.reminderId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title;
            if (reminderId && eventId) {
              content = title ? `Recordatorio cancelado: ${title}` : "Recordatorio cancelado.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (module === "daily-log") {
          if (action === "morning") {
            const dailyLogId = actionResult.evidence?.dailyLogId;
            const eventId = actionResult.evidence?.eventId;
            const date = actionResult.evidence?.date ?? classification.intent.entities?.date;
            if (dailyLogId && eventId) {
              content = date ? `Registro de manana actualizado para ${date}.` : "Registro de manana actualizado.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "evening") {
            const dailyLogId = actionResult.evidence?.dailyLogId;
            const eventId = actionResult.evidence?.eventId;
            const date = actionResult.evidence?.date ?? classification.intent.entities?.date;
            if (dailyLogId && eventId) {
              content = date ? `Cierre del dia actualizado para ${date}.` : "Cierre del dia actualizado.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "summary") {
            const dailyLog = actionResult.evidence?.dailyLog as {
              date?: string;
              wakeEnergy?: number;
              sleepHours?: number;
              morningIntention?: string;
              eveningReview?: string;
            } | undefined;
            const date = actionResult.evidence?.date ?? classification.intent.entities?.date;
            if (dailyLog) {
              const energy = dailyLog.wakeEnergy !== undefined ? String(dailyLog.wakeEnergy) : "sin dato";
              const sueno = dailyLog.sleepHours !== undefined ? String(dailyLog.sleepHours) : "sin dato";
              const intencion = dailyLog.morningIntention || "sin dato";
              const cierre = dailyLog.eveningReview || "sin dato";
              content = `Resumen de ${date || dailyLog.date || "hoy"}:\nEnergia: ${energy}\nSueno: ${sueno}\nIntencion: ${intencion}\nCierre: ${cierre}`;
            } else {
              content = date ? `No encontre registro diario para ${date}.` : "No encontre registro diario para hoy.";
            }
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (module === "areas") {
          if (action === "create") {
            const areaId = actionResult.evidence?.areaId;
            const eventId = actionResult.evidence?.eventId;
            const name = actionResult.evidence?.name ?? classification.intent.entities?.name;
            if (areaId && eventId) {
              content = name ? `Area creada: ${name}` : "Area creada.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "list") {
            const areas = actionResult.evidence?.areas as Array<{ name: string }> | undefined;
            const count = actionResult.evidence?.count as number | undefined;
            if (!areas || count === 0) {
              content = "No encontre areas activas.";
            } else {
              const lines = areas.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
              content = `Estas son tus areas activas:\n${lines}`;
            }
          } else if (action === "archive") {
            const areaId = actionResult.evidence?.areaId;
            const eventId = actionResult.evidence?.eventId;
            const name = actionResult.evidence?.name ?? classification.intent.entities?.name;
            if (areaId && eventId) {
              content = name ? `Area archivada: ${name}` : "Area archivada.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "assign-note") {
            const noteId = actionResult.evidence?.noteId;
            const areaId = actionResult.evidence?.areaId;
            const eventId = actionResult.evidence?.eventId;
            const areaName = actionResult.evidence?.areaName as string | undefined;
            if (noteId && areaId && eventId) {
              content = areaName ? `Nota asociada al area ${areaName}.` : "Nota asociada al area.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "assign-task") {
            const taskId = actionResult.evidence?.taskId;
            const areaId = actionResult.evidence?.areaId;
            const eventId = actionResult.evidence?.eventId;
            const areaName = actionResult.evidence?.areaName as string | undefined;
            const title = actionResult.evidence?.title as string | undefined;
            if (taskId && areaId && eventId) {
              if (areaName && title) {
                content = `Tarea asociada al area ${areaName}: ${title}`;
              } else if (areaName) {
                content = `Tarea asociada al area ${areaName}.`;
              } else {
                content = "Tarea asociada al area.";
              }
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (module === "objectives") {
          if (action === "create") {
            const objectiveId = actionResult.evidence?.objectiveId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title ?? classification.intent.entities?.title;
            if (objectiveId && eventId) {
              content = title ? `Objetivo creado: ${title}` : "Objetivo creado.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "list") {
            const objectives = actionResult.evidence?.objectives as Array<{ title: string }> | undefined;
            const count = actionResult.evidence?.count as number | undefined;
            if (!objectives || count === 0) {
              content = "No encontre objetivos activos.";
            } else {
              const lines = objectives.map((o, i) => `${i + 1}. ${o.title}`).join("\n");
              content = `Estos son tus objetivos activos:\n${lines}`;
            }
          } else if (action === "achieve") {
            const objectiveId = actionResult.evidence?.objectiveId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title ?? classification.intent.entities?.title;
            if (objectiveId && eventId) {
              content = title ? `Objetivo logrado: ${title}` : "Objetivo logrado.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "archive") {
            const objectiveId = actionResult.evidence?.objectiveId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title ?? classification.intent.entities?.title;
            if (objectiveId && eventId) {
              content = title ? `Objetivo archivado: ${title}` : "Objetivo archivado.";
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else if (action === "assign-task") {
            const taskId = actionResult.evidence?.taskId;
            const objectiveId = actionResult.evidence?.objectiveId;
            const eventId = actionResult.evidence?.eventId;
            const objectiveTitle = actionResult.evidence?.objectiveTitle as string | undefined;
            const taskTitle = actionResult.evidence?.taskTitle as string | undefined;
            if (taskId && objectiveId && eventId) {
              if (objectiveTitle && taskTitle) {
                content = `Tarea asociada al objetivo ${objectiveTitle}: ${taskTitle}`;
              } else if (objectiveTitle) {
                content = `Tarea asociada al objetivo ${objectiveTitle}.`;
              } else {
                content = "Tarea asociada al objetivo.";
              }
            } else {
              content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
            }
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (action === "list" || action === "search") {
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
