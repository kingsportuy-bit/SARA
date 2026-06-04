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
        } else if (module === "routines") {
          if (action === "create") {
            const routineId = actionResult.evidence?.routineId;
            const eventId = actionResult.evidence?.eventId;
            const name = actionResult.evidence?.name ?? classification.intent.entities?.name;
            content = routineId && eventId ? `Rutina creada: ${name || "sin nombre"}` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "list") {
            const routines = actionResult.evidence?.routines as Array<{ name: string; status?: string }> | undefined;
            const count = actionResult.evidence?.count as number | undefined;
            content = !routines || count === 0
              ? "No encontre rutinas."
              : `Estas son tus rutinas:\n${routines.map((r, i) => `${i + 1}. ${r.name}${r.status ? ` (${r.status})` : ""}`).join("\n")}`;
          } else if (action === "activate" || action === "pause" || action === "archive") {
            const routineId = actionResult.evidence?.routineId;
            const eventId = actionResult.evidence?.eventId;
            const name = actionResult.evidence?.name;
            const label = action === "activate" ? "activada" : action === "pause" ? "pausada" : "archivada";
            content = routineId && eventId ? `Rutina ${label}: ${name || "rutina"}` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (module === "workouts") {
          if (action === "start") {
            const sessionId = actionResult.evidence?.sessionId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title;
            content = sessionId && eventId ? `Sesion de gym iniciada${title ? `: ${title}` : "."}` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "log-set") {
            const setId = actionResult.evidence?.setId;
            const eventId = actionResult.evidence?.eventId;
            const exerciseName = actionResult.evidence?.exerciseName;
            const setNumber = actionResult.evidence?.setNumber;
            content = setId && eventId ? `Serie registrada: ${exerciseName || "ejercicio"}${setNumber ? ` serie ${setNumber}` : ""}.` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "finish") {
            const sessionId = actionResult.evidence?.sessionId;
            const eventId = actionResult.evidence?.eventId;
            const setCount = actionResult.evidence?.setCount;
            content = sessionId && eventId ? `Sesion de gym terminada${typeof setCount === "number" ? ` con ${setCount} series registradas` : ""}.` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "cancel") {
            const sessionId = actionResult.evidence?.sessionId;
            const eventId = actionResult.evidence?.eventId;
            content = sessionId && eventId ? "Sesion de gym cancelada." : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "list") {
            const sessions = actionResult.evidence?.sessions as Array<{ title?: string; status: string; startedAt: string }> | undefined;
            const count = actionResult.evidence?.count as number | undefined;
            content = !sessions || count === 0
              ? "No encontre sesiones de gym."
              : `Estas son tus sesiones de gym:\n${sessions.map((s, i) => `${i + 1}. ${s.title || "Gym"} (${s.status})`).join("\n")}`;
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (module === "timers") {
          if (action === "start") {
            const timerId = actionResult.evidence?.timerId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title;
            const dueAt = actionResult.evidence?.dueAt;
            content = timerId && eventId ? `Timer iniciado: ${title || "temporizador"}${dueAt ? ` hasta ${formatDueAt(String(dueAt))}` : ""}.` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "cancel") {
            const timerId = actionResult.evidence?.timerId;
            const eventId = actionResult.evidence?.eventId;
            content = timerId && eventId ? "Timer cancelado." : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (module === "progress") {
          if (action === "workout") {
            const progress = actionResult.evidence?.progress as { exerciseName?: string; totalSessions?: number; totalSets?: number; lastWeightKg?: number | null; lastReps?: number | null; maxWeightKg?: number | null } | undefined;
            content = progress
              ? `Progreso ${progress.exerciseName || ""}:\nSesiones: ${progress.totalSessions ?? 0}\nSeries: ${progress.totalSets ?? 0}\nUltimo peso: ${progress.lastWeightKg ?? "sin dato"}\nUltimas reps: ${progress.lastReps ?? "sin dato"}\nMax peso: ${progress.maxWeightKg ?? "sin dato"}`
              : "No encontre progreso para ese ejercicio.";
          } else if (action === "objective") {
            const progress = actionResult.evidence?.progress as { objectiveTitle?: string; totalTasks?: number; completedTasks?: number; pendingTasks?: number } | undefined;
            content = progress
              ? `Progreso objetivo ${progress.objectiveTitle || ""}:\nTareas totales: ${progress.totalTasks ?? 0}\nCompletadas: ${progress.completedTasks ?? 0}\nPendientes: ${progress.pendingTasks ?? 0}`
              : "No encontre progreso para ese objetivo.";
          } else if (action === "summary") {
            const summary = actionResult.evidence?.summary as { totalDays?: number; streak?: number; averageWakeEnergy?: number | null; averageSleepHours?: number | null } | undefined;
            content = summary
              ? `Resumen de progreso:\nDias registrados: ${summary.totalDays ?? 0}\nRacha: ${summary.streak ?? 0}\nEnergia promedio: ${summary.averageWakeEnergy ?? "sin dato"}\nSueno promedio: ${summary.averageSleepHours ?? "sin dato"}`
              : "No encontre datos suficientes de progreso.";
          } else {
            content = "No encontre datos suficientes de progreso.";
          }
        } else if (module === "plans") {
          if (action === "create") {
            const planId = actionResult.evidence?.planId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title ?? classification.intent.entities?.title;
            content = planId && eventId ? `Plan creado: ${title || "plan"}` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "list") {
            const plans = actionResult.evidence?.plans as Array<{ title: string; status: string }> | undefined;
            const count = actionResult.evidence?.count as number | undefined;
            content = !plans || count === 0 ? "No encontre planes activos." : `Estos son tus planes:\n${plans.map((p, i) => `${i + 1}. ${p.title} (${p.status})`).join("\n")}`;
          } else if (action === "archive") {
            const planId = actionResult.evidence?.planId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title;
            content = planId && eventId ? `Plan archivado: ${title || "plan"}` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "complete-step") {
            const stepId = actionResult.evidence?.stepId;
            const eventId = actionResult.evidence?.eventId;
            const title = actionResult.evidence?.title;
            content = stepId && eventId ? `Paso completado: ${title || "paso"}` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else {
            content = "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          }
        } else if (module === "protocols") {
          if (action === "create") {
            const protocolId = actionResult.evidence?.protocolId;
            const eventId = actionResult.evidence?.eventId;
            const name = actionResult.evidence?.name ?? classification.intent.entities?.name;
            content = protocolId && eventId ? `Protocolo creado: ${name || "protocolo"}` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "list") {
            const protocols = actionResult.evidence?.protocols as Array<{ name: string; status: string; scope: string }> | undefined;
            const count = actionResult.evidence?.count as number | undefined;
            content = !protocols || count === 0 ? "No encontre protocolos." : `Estos son tus protocolos:\n${protocols.map((p, i) => `${i + 1}. ${p.name} (${p.scope}, ${p.status})`).join("\n")}`;
          } else if (action === "activate" || action === "archive") {
            const protocolId = actionResult.evidence?.protocolId;
            const eventId = actionResult.evidence?.eventId;
            const name = actionResult.evidence?.name;
            content = protocolId && eventId ? `Protocolo ${action === "activate" ? "activado" : "archivado"}: ${name || "protocolo"}` : "La accion se reporto como ejecutada pero no se puede verificar la evidencia.";
          } else if (action === "evaluate") {
            const protocolId = actionResult.evidence?.protocolId;
            const eventId = actionResult.evidence?.eventId;
            const suggestions = actionResult.evidence?.suggestions as Array<{ applies: boolean; suggestion: string; evidence: string }> | undefined;
            if (protocolId && eventId) {
              const matched = suggestions?.filter((s) => s.applies) ?? [];
              content = matched.length === 0
                ? "Protocolo evaluado: no se activaron reglas con la evidencia actual."
                : `Protocolo evaluado:\n${matched.map((s, i) => `${i + 1}. ${s.suggestion || "Regla activa"} (${s.evidence})`).join("\n")}`;
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
