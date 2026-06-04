import type { ActionExecutionInput, ActionExecutionResult, ModuleIntentResult } from "../contracts/pipeline.js";

export interface ModuleHandler {
  (input: ActionExecutionInput): Promise<ActionExecutionResult>;
}

export interface ActionExecutor {
  execute(input: ActionExecutionInput): Promise<ActionExecutionResult>;
}

type HandlerRegistry = Record<string, Record<string, ModuleHandler>>;

function validateContent(input: ActionExecutionInput): string | null {
  const content = input.entities?.content;
  if (!content || typeof content !== "string" || String(content).trim().length === 0) {
    return "content is required for notes.create";
  }
  return null;
}

function validateTitle(input: ActionExecutionInput): string | null {
  const title = input.entities?.title;
  if (!title || typeof title !== "string" || String(title).trim().length === 0) {
    return "title is required for tasks.create";
  }
  return null;
}

function validateCompleteIdentifier(input: ActionExecutionInput): string | null {
  const hasTaskId = input.entities?.taskId;
  const hasTitleMatch = input.entities?.titleMatch && typeof input.entities.titleMatch === "string" && input.entities.titleMatch.trim().length > 0;
  const position = Number(input.entities?.position);
  const hasPosition = !isNaN(position) && position > 0;
  if (!hasTaskId && !hasTitleMatch && !hasPosition) {
    return "taskId, titleMatch, or positive position required for tasks.complete";
  }
  return null;
}

function validateReminderCreate(input: ActionExecutionInput): string | null {
  const title = input.entities?.title;
  if (!title || typeof title !== "string" || String(title).trim().length === 0) {
    return "title is required for reminders.create";
  }
  const dueAt = input.entities?.dueAt;
  if (!dueAt || typeof dueAt !== "string") {
    return "dueAt is required for reminders.create";
  }
  const dueDate = new Date(dueAt as string);
  if (isNaN(dueDate.getTime()) || dueDate <= new Date()) {
    return "dueAt must be in the future for reminders.create";
  }
  return null;
}

function validateReminderCancel(input: ActionExecutionInput): string | null {
  const hasReminderId = input.entities?.reminderId;
  const hasTitleMatch = input.entities?.titleMatch && typeof input.entities.titleMatch === "string" && input.entities.titleMatch.trim().length > 0;
  const position = Number(input.entities?.position);
  const hasPosition = !isNaN(position) && position > 0;
  if (!hasReminderId && !hasTitleMatch && !hasPosition) {
    return "reminderId, titleMatch, or positive position required for reminders.cancel";
  }
  return null;
}

function validateDailyLogMorning(input: ActionExecutionInput): string | null {
  const hasWakeEnergy = input.entities?.wakeEnergy !== undefined && input.entities?.wakeEnergy !== null;
  const hasSleepHours = input.entities?.sleepHours !== undefined && input.entities?.sleepHours !== null;
  const hasIntention = input.entities?.morningIntention && typeof input.entities.morningIntention === "string" && input.entities.morningIntention.trim().length > 0;
  const hasNotes = Array.isArray(input.entities?.notes) && input.entities.notes.length > 0;

  if (!hasWakeEnergy && !hasSleepHours && !hasIntention && !hasNotes) {
    return "wakeEnergy, sleepHours, morningIntention, or notes required for daily-log.morning";
  }

  if (hasWakeEnergy) {
    const energy = Number(input.entities?.wakeEnergy);
    if (isNaN(energy) || energy < 1 || energy > 10) {
      return "wakeEnergy must be between 1 and 10 for daily-log.morning";
    }
  }

  if (hasSleepHours) {
    const hours = Number(input.entities?.sleepHours);
    if (isNaN(hours) || hours < 0) {
      return "sleepHours cannot be negative for daily-log.morning";
    }
  }

  return null;
}

function validateDailyLogEvening(input: ActionExecutionInput): string | null {
  const hasReview = input.entities?.eveningReview && typeof input.entities.eveningReview === "string" && input.entities.eveningReview.trim().length > 0;
  const hasMood = input.entities?.mood && typeof input.entities.mood === "string" && input.entities.mood.trim().length > 0;
  const hasNotes = Array.isArray(input.entities?.notes) && input.entities.notes.length > 0;

  if (!hasReview && !hasMood && !hasNotes) {
    return "eveningReview, mood, or notes required for daily-log.evening";
  }

  return null;
}

function guardConfidenceAndMissing(input: ActionExecutionInput): string | null {
  if (input.intentConfidence === undefined || input.intentConfidence < 0.75) {
    return `confidence insufficient for ${input.module}.${input.action}`;
  }
  if (!Array.isArray(input.intentMissingData) || input.intentMissingData.length > 0) {
    return `missing data prevents ${input.module}.${input.action}`;
  }
  return null;
}

function validateAreaCreate(input: ActionExecutionInput): string | null {
  const name = input.entities?.name;
  if (!name || typeof name !== "string" || String(name).trim().length === 0) {
    return "name is required for areas.create";
  }
  const slug = input.entities?.slug;
  if (!slug || typeof slug !== "string" || String(slug).trim().length === 0) {
    return "slug is required for areas.create";
  }
  return null;
}

function validateAreaArchive(input: ActionExecutionInput): string | null {
  const hasAreaId = input.entities?.areaId;
  const hasAreaSlug = input.entities?.areaSlug && typeof input.entities.areaSlug === "string" && input.entities.areaSlug.trim().length > 0;
  if (!hasAreaId && !hasAreaSlug) {
    return "areaId or areaSlug required for areas.archive";
  }
  return null;
}

function validateAreaAssignNote(input: ActionExecutionInput): string | null {
  const noteId = input.entities?.noteId;
  if (!noteId || typeof noteId !== "string" || String(noteId).trim().length === 0) {
    return "noteId is required for areas.assign-note";
  }
  const hasAreaId = input.entities?.areaId;
  const hasAreaSlug = input.entities?.areaSlug && typeof input.entities.areaSlug === "string" && input.entities.areaSlug.trim().length > 0;
  if (!hasAreaId && !hasAreaSlug) {
    return "areaId or areaSlug required for areas.assign-note";
  }
  return null;
}

function validateAreaAssignTask(input: ActionExecutionInput): string | null {
  const taskId = input.entities?.taskId;
  if (!taskId || typeof taskId !== "string" || String(taskId).trim().length === 0) {
    return "taskId is required for areas.assign-task";
  }
  const hasAreaId = input.entities?.areaId;
  const hasAreaSlug = input.entities?.areaSlug && typeof input.entities.areaSlug === "string" && input.entities.areaSlug.trim().length > 0;
  if (!hasAreaId && !hasAreaSlug) {
    return "areaId or areaSlug required for areas.assign-task";
  }
  return null;
}

function validateObjectiveCreate(input: ActionExecutionInput): string | null {
  const title = input.entities?.title;
  if (!title || typeof title !== "string" || String(title).trim().length === 0) {
    return "title is required for objectives.create";
  }
  const slug = input.entities?.slug;
  if (!slug || typeof slug !== "string" || String(slug).trim().length === 0) {
    return "slug is required for objectives.create";
  }
  return null;
}

function validateObjectiveAchieve(input: ActionExecutionInput): string | null {
  const hasObjectiveId = input.entities?.objectiveId;
  const hasObjectiveSlug = input.entities?.objectiveSlug && typeof input.entities.objectiveSlug === "string" && input.entities.objectiveSlug.trim().length > 0;
  if (!hasObjectiveId && !hasObjectiveSlug) {
    return "objectiveId or objectiveSlug required for objectives.achieve";
  }
  return null;
}

function validateObjectiveArchive(input: ActionExecutionInput): string | null {
  const hasObjectiveId = input.entities?.objectiveId;
  const hasObjectiveSlug = input.entities?.objectiveSlug && typeof input.entities.objectiveSlug === "string" && input.entities.objectiveSlug.trim().length > 0;
  if (!hasObjectiveId && !hasObjectiveSlug) {
    return "objectiveId or objectiveSlug required for objectives.archive";
  }
  return null;
}

function validateObjectiveAssignTask(input: ActionExecutionInput): string | null {
  const taskId = input.entities?.taskId;
  if (!taskId || typeof taskId !== "string" || String(taskId).trim().length === 0) {
    return "taskId is required for objectives.assign-task";
  }
  const hasObjectiveId = input.entities?.objectiveId;
  const hasObjectiveSlug = input.entities?.objectiveSlug && typeof input.entities.objectiveSlug === "string" && input.entities.objectiveSlug.trim().length > 0;
  if (!hasObjectiveId && !hasObjectiveSlug) {
    return "objectiveId or objectiveSlug required for objectives.assign-task";
  }
  return null;
}

function validateSlugOrId(input: ActionExecutionInput, label: string): string | null {
  const id = input.entities?.[`${label}Id`];
  const slug = input.entities?.slug ?? input.entities?.[`${label}Slug`];
  if (!id && !(typeof slug === "string" && slug.trim().length > 0)) {
    return `${label}Id or slug required for ${input.module}.${input.action}`;
  }
  return null;
}

function validateRoutineCreate(input: ActionExecutionInput): string | null {
  const name = input.entities?.name;
  const slug = input.entities?.slug;
  if (!name || typeof name !== "string" || name.trim().length === 0) return "name is required for routines.create";
  if (!slug || typeof slug !== "string" || slug.trim().length === 0) return "slug is required for routines.create";
  return null;
}

function validateWorkoutLogSet(input: ActionExecutionInput): string | null {
  if (!input.entities?.sessionId) return "sessionId is required for workouts.log-set";
  const exerciseName = input.entities?.exerciseName;
  if (!exerciseName || typeof exerciseName !== "string" || exerciseName.trim().length === 0) return "exerciseName is required for workouts.log-set";
  if (input.entities?.actualReps === undefined && input.entities?.durationSeconds === undefined) return "actualReps or durationSeconds required for workouts.log-set";
  return null;
}

function validateWorkoutSession(input: ActionExecutionInput): string | null {
  if (!input.entities?.sessionId) return `sessionId is required for workouts.${input.action}`;
  return null;
}

function validateTimerStart(input: ActionExecutionInput): string | null {
  const title = input.entities?.title;
  const duration = Number(input.entities?.durationSeconds);
  if (!title || typeof title !== "string" || title.trim().length === 0) return "title is required for timers.start";
  if (isNaN(duration) || duration <= 0) return "positive durationSeconds is required for timers.start";
  return null;
}

function validateTimerCancel(input: ActionExecutionInput): string | null {
  if (!input.entities?.timerId) return "timerId is required for timers.cancel";
  return null;
}

function validatePlanCreate(input: ActionExecutionInput): string | null {
  const title = input.entities?.title;
  const slug = input.entities?.slug;
  const steps = input.entities?.steps;
  if (!title || typeof title !== "string" || title.trim().length === 0) return "title is required for plans.create";
  if (!slug || typeof slug !== "string" || slug.trim().length === 0) return "slug is required for plans.create";
  if (!Array.isArray(steps) || steps.length === 0) return "steps are required for plans.create";
  return null;
}

function validatePlanCompleteStep(input: ActionExecutionInput): string | null {
  const stepId = input.entities?.stepId;
  const planSlug = input.entities?.planSlug;
  const stepPosition = Number(input.entities?.stepPosition);
  if (!stepId && (!(typeof planSlug === "string" && planSlug.trim()) || isNaN(stepPosition) || stepPosition <= 0)) {
    return "stepId or planSlug plus positive stepPosition required for plans.complete-step";
  }
  return null;
}

function validateProtocolCreate(input: ActionExecutionInput): string | null {
  const name = input.entities?.name;
  const slug = input.entities?.slug;
  const rules = input.entities?.rules;
  if (!name || typeof name !== "string" || name.trim().length === 0) return "name is required for protocols.create";
  if (!slug || typeof slug !== "string" || slug.trim().length === 0) return "slug is required for protocols.create";
  if (!Array.isArray(rules)) return "rules array is required for protocols.create";
  return null;
}

function guardAction(input: ActionExecutionInput): string | null {
  const mutatingActions = new Set([
    "create",
    "complete",
    "cancel",
    "morning",
    "evening",
    "archive",
    "achieve",
    "assign-note",
    "assign-task",
    "activate",
    "pause",
    "start",
    "log-set",
    "finish",
    "complete-step",
  ]);

  if (mutatingActions.has(input.action)) {
    const cm = guardConfidenceAndMissing(input);
    if (cm) return cm;
  }

  if (input.module === "notes" && input.action === "create") {
    return validateContent(input);
  }

  if (input.module === "tasks" && input.action === "create") {
    return validateTitle(input);
  }

  if (input.module === "tasks" && input.action === "complete") {
    return validateCompleteIdentifier(input);
  }

  if (input.module === "reminders" && input.action === "create") {
    return validateReminderCreate(input);
  }

  if (input.module === "reminders" && input.action === "cancel") {
    return validateReminderCancel(input);
  }

  if (input.module === "daily-log" && input.action === "morning") {
    return validateDailyLogMorning(input);
  }

  if (input.module === "daily-log" && input.action === "evening") {
    return validateDailyLogEvening(input);
  }

  if (input.module === "areas" && input.action === "create") {
    return validateAreaCreate(input);
  }

  if (input.module === "areas" && input.action === "archive") {
    return validateAreaArchive(input);
  }

  if (input.module === "areas" && input.action === "assign-note") {
    return validateAreaAssignNote(input);
  }

  if (input.module === "areas" && input.action === "assign-task") {
    return validateAreaAssignTask(input);
  }

  if (input.module === "objectives" && input.action === "create") {
    return validateObjectiveCreate(input);
  }

  if (input.module === "objectives" && input.action === "achieve") {
    return validateObjectiveAchieve(input);
  }

  if (input.module === "objectives" && input.action === "archive") {
    return validateObjectiveArchive(input);
  }

  if (input.module === "objectives" && input.action === "assign-task") {
    return validateObjectiveAssignTask(input);
  }

  if (input.module === "routines" && input.action === "create") return validateRoutineCreate(input);
  if (input.module === "routines" && (input.action === "activate" || input.action === "pause" || input.action === "archive")) return validateSlugOrId(input, "routine");

  if (input.module === "workouts" && input.action === "log-set") return validateWorkoutLogSet(input);
  if (input.module === "workouts" && (input.action === "finish" || input.action === "cancel")) return validateWorkoutSession(input);

  if (input.module === "timers" && input.action === "start") return validateTimerStart(input);
  if (input.module === "timers" && input.action === "cancel") return validateTimerCancel(input);

  if (input.module === "plans" && input.action === "create") return validatePlanCreate(input);
  if (input.module === "plans" && input.action === "archive") return validateSlugOrId(input, "plan");
  if (input.module === "plans" && input.action === "complete-step") return validatePlanCompleteStep(input);

  if (input.module === "protocols" && input.action === "create") return validateProtocolCreate(input);
  if (input.module === "protocols" && (input.action === "activate" || input.action === "archive" || input.action === "evaluate")) return validateSlugOrId(input, "protocol");

  return null;
}

export function createActionExecutor(handlers: HandlerRegistry = {}): ActionExecutor {
  return {
    async execute(input) {
      if (input.requiresConfirmation) {
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "needs_confirmation",
          evidence: { reason: "Confirmation required before execution." },
          stateChanges: [],
        };
      }

      const moduleHandlers = handlers[input.module];
      if (!moduleHandlers) {
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "skipped",
          evidence: { reason: `Module "${input.module}" has no registered handlers.` },
          stateChanges: [],
        };
      }

      const handler = moduleHandlers[input.action];
      if (!handler) {
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "skipped",
          evidence: { reason: `Action "${input.action}" not implemented for module "${input.module}".` },
          stateChanges: [],
        };
      }

      const guardError = guardAction(input);
      if (guardError) {
        return {
          schemaVersion: "action_execution_result.v1",
          traceId: input.traceId,
          status: "failed",
          evidence: { reason: guardError },
          stateChanges: [],
          error: guardError,
        };
      }

      return handler(input);
    },
  };
}

export function intentConfidenceSufficient(intent: ModuleIntentResult): boolean {
  return intent.confidence >= 0.75 && intent.missingData.length === 0;
}
