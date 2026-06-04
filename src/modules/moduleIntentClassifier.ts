import type { ModuleIntentInput, ModuleIntentResult } from "../contracts/pipeline.js";
import { matchesNotePrefix, extractNoteContent, matchesNoteListQuery, matchesNoteSearchQuery, extractSearchQuery, matchesTaskCreate, matchesTaskListQuery, matchesTaskComplete, extractTaskTitle, extractCompleteTaskIdentifier, matchesTaskReference, resolveTaskReference, resolveNoteReference, matchesReminderCreate, matchesReminderListQuery, matchesReminderCancel, extractCancelReminderIdentifier, matchesReminderReference, resolveReminderReference, extractReminderTitle, matchesDailyLogMorning, matchesDailyLogEvening, matchesDailyLogSummary, matchesAreaCreate, matchesAreaListQuery, matchesAreaArchive, matchesAreaAssign, matchesObjectiveCreate, matchesObjectiveListQuery, matchesObjectiveAchieve, matchesObjectiveArchive, matchesObjectiveAssign } from "./patterns.js";
import { parseReminderTime } from "./reminders/reminderTimeParser.js";
import { parseDailyLog } from "./dailyLog/dailyLogParser.js";
import { parseAreasInput } from "./areas/areasParser.js";
import { parseObjectivesInput } from "./objectives/objectivesParser.js";
import { parseRoutinesInput } from "./routines/routinesParser.js";
import { parseWorkoutsInput } from "./workouts/workoutsParser.js";
import { parseTimersInput } from "./timers/timersParser.js";
import { parseProgressInput } from "./progress/progressParser.js";
import { parsePlansInput } from "./plans/plansParser.js";
import { parseProtocolsInput } from "./protocols/protocolsParser.js";

export interface ModuleIntentClassifier {
  classify(input: ModuleIntentInput): Promise<ModuleIntentResult>;
}

function detectTasksIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;

  if (matchesTaskComplete(text)) {
    const identifier = extractCompleteTaskIdentifier(text);
    if (identifier) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "tasks",
        action: "complete",
        confidence: 0.85,
        entities: identifier.position ? { position: identifier.position } : { titleMatch: identifier.titleMatch },
        missingData: [],
        requiresConfirmation: false,
        reasoningSummary: "Task complete intent detected.",
      };
    }

    if (matchesTaskReference(text)) {
      const resolved = resolveTaskReference(input.sessionContext);
      if (resolved) {
        if (resolved.taskId) {
          return {
            schemaVersion: "module_intent_result.v1",
            traceId: input.traceId,
            module: "tasks",
            action: "complete",
            confidence: 0.85,
            entities: { taskId: resolved.taskId },
            missingData: [],
            requiresConfirmation: false,
            reasoningSummary: "Task complete reference resolved from session context.",
          };
        }
        if (resolved.position) {
          return {
            schemaVersion: "module_intent_result.v1",
            traceId: input.traceId,
            module: "tasks",
            action: "complete",
            confidence: 0.85,
            entities: { position: resolved.position },
            missingData: [],
            requiresConfirmation: false,
            reasoningSummary: "Task complete reference resolved from session context.",
          };
        }
      }
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "tasks",
        action: "complete",
        confidence: 0.4,
        entities: {},
        missingData: ["task"],
        requiresConfirmation: false,
        reasoningSummary: "Task complete reference detected but no session context to resolve.",
      };
    }

    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "tasks",
      action: "complete",
      confidence: 0.4,
      entities: {},
      missingData: ["task"],
      requiresConfirmation: false,
      reasoningSummary: "Task complete intent detected but no identifier found.",
    };
  }

  if (matchesTaskListQuery(text)) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "tasks",
      action: "list",
      confidence: 0.85,
      entities: {},
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Task list intent detected.",
    };
  }

  if (!matchesTaskCreate(text)) return null;

  const title = extractTaskTitle(text);
  if (!title) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "tasks",
      action: "create",
      confidence: 0.4,
      entities: {},
      missingData: ["title"],
      requiresConfirmation: false,
      reasoningSummary: "Task create intent detected but no title provided.",
    };
  }

  return {
    schemaVersion: "module_intent_result.v1",
    traceId: input.traceId,
    module: "tasks",
    action: "create",
    confidence: 0.85,
    entities: { title },
    missingData: [],
    requiresConfirmation: false,
    reasoningSummary: "Task creation intent detected from explicit pattern.",
  };
}

function detectNotesIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;

  if (matchesNoteSearchQuery(text)) {
    const query = extractSearchQuery(text);
    if (query) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "notes",
        action: "search",
        confidence: 0.85,
        entities: { query },
        missingData: [],
        requiresConfirmation: false,
        reasoningSummary: "Note search intent detected.",
      };
    }
  }

  if (matchesNoteListQuery(text)) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "notes",
      action: "list",
      confidence: 0.85,
      entities: {},
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Note list intent detected.",
    };
  }

  if (!matchesNotePrefix(text)) return null;

  const cleaned = extractNoteContent(text);

  if (!cleaned) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "notes",
      action: "create",
      confidence: 0.4,
      entities: {},
      missingData: ["content"],
      requiresConfirmation: false,
      reasoningSummary: "Note intent detected but no content provided.",
    };
  }

  let noteType = "observacion";
  const lower = text.toLowerCase();
  const noteTypes = ["aprendizaje", "idea", "problema", "riesgo", "mejora", "observacion"] as const;
  for (const nt of noteTypes) {
    if (lower.startsWith(nt)) {
      noteType = nt;
      break;
    }
  }

  return {
    schemaVersion: "module_intent_result.v1",
    traceId: input.traceId,
    module: "notes",
    action: "create",
    confidence: 0.85,
    entities: {
      content: cleaned,
      noteType,
    },
    missingData: [],
    requiresConfirmation: false,
    reasoningSummary: "Note creation intent detected from explicit pattern.",
  };
}

function detectRemindersIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;

  if (matchesReminderCancel(text)) {
    const identifier = extractCancelReminderIdentifier(text);
    if (identifier) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "reminders",
        action: "cancel",
        confidence: 0.85,
        entities: identifier.position ? { position: identifier.position } : { titleMatch: identifier.titleMatch },
        missingData: [],
        requiresConfirmation: false,
        reasoningSummary: "Reminder cancel intent detected.",
      };
    }

    if (matchesReminderReference(text)) {
      const resolved = resolveReminderReference(input.sessionContext);
      if (resolved) {
        if (resolved.reminderId) {
          return {
            schemaVersion: "module_intent_result.v1",
            traceId: input.traceId,
            module: "reminders",
            action: "cancel",
            confidence: 0.85,
            entities: { reminderId: resolved.reminderId },
            missingData: [],
            requiresConfirmation: false,
            reasoningSummary: "Reminder cancel reference resolved from session context.",
          };
        }
        if (resolved.position) {
          return {
            schemaVersion: "module_intent_result.v1",
            traceId: input.traceId,
            module: "reminders",
            action: "cancel",
            confidence: 0.85,
            entities: { position: resolved.position },
            missingData: [],
            requiresConfirmation: false,
            reasoningSummary: "Reminder cancel reference resolved from session context.",
          };
        }
      }
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "reminders",
        action: "cancel",
        confidence: 0.4,
        entities: {},
        missingData: ["reminder"],
        requiresConfirmation: false,
        reasoningSummary: "Reminder cancel reference detected but no session context to resolve.",
      };
    }

    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "reminders",
      action: "cancel",
      confidence: 0.4,
      entities: {},
      missingData: ["reminder"],
      requiresConfirmation: false,
      reasoningSummary: "Reminder cancel intent detected but no identifier found.",
    };
  }

  if (matchesReminderListQuery(text)) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "reminders",
      action: "list",
      confidence: 0.85,
      entities: {},
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Reminder list intent detected.",
    };
  }

  if (!matchesReminderCreate(text)) return null;

  const title = extractReminderTitle(text);
  const timeResult = parseReminderTime(text);

  if (!timeResult.success) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "reminders",
      action: "create",
      confidence: 0.4,
      entities: title ? { title } : {},
      missingData: timeResult.missingData,
      requiresConfirmation: false,
      reasoningSummary: "Reminder create intent detected but time could not be parsed.",
    };
  }

  if (!title) {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "reminders",
      action: "create",
      confidence: 0.4,
      entities: { dueAt: timeResult.dueAtISO },
      missingData: ["title"],
      requiresConfirmation: false,
      reasoningSummary: "Reminder create intent detected but no title provided.",
    };
  }

  return {
    schemaVersion: "module_intent_result.v1",
    traceId: input.traceId,
    module: "reminders",
    action: "create",
    confidence: 0.85,
    entities: { title, dueAt: timeResult.dueAtISO },
    missingData: [],
    requiresConfirmation: false,
    reasoningSummary: "Reminder creation intent detected from explicit pattern.",
  };
}

function detectDailyLogIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;

  const parseResult = parseDailyLog(text);

  if (!parseResult.success) {
    const isMorning = matchesDailyLogMorning(text);
    const isEvening = matchesDailyLogEvening(text);
    const isSummary = matchesDailyLogSummary(text);

    if (isMorning) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "daily-log",
        action: "morning",
        confidence: 0.4,
        entities: {},
        missingData: parseResult.missingData,
        requiresConfirmation: false,
        reasoningSummary: "Daily log morning intent detected but no fields to update.",
      };
    }

    if (isEvening) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "daily-log",
        action: "evening",
        confidence: 0.4,
        entities: {},
        missingData: parseResult.missingData,
        requiresConfirmation: false,
        reasoningSummary: "Daily log evening intent detected but no fields to update.",
      };
    }

    if (isSummary) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "daily-log",
        action: "summary",
        confidence: 0.85,
        entities: {},
        missingData: [],
        requiresConfirmation: false,
        reasoningSummary: "Daily log summary intent detected.",
      };
    }

    return null;
  }

  const { parsed } = parseResult;

  if (parsed.intent === "morning") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "daily-log",
      action: "morning",
      confidence: 0.85,
      entities: {
        date: parsed.date,
        wakeEnergy: parsed.wakeEnergy,
        sleepHours: parsed.sleepHours,
        morningIntention: parsed.morningIntention,
      },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Daily log morning intent detected.",
    };
  }

  if (parsed.intent === "evening") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "daily-log",
      action: "evening",
      confidence: 0.85,
      entities: {
        date: parsed.date,
        eveningReview: parsed.eveningReview,
      },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Daily log evening intent detected.",
    };
  }

  if (parsed.intent === "summary") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "daily-log",
      action: "summary",
      confidence: 0.85,
      entities: {
        date: parsed.date,
      },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Daily log summary intent detected.",
    };
  }

  return null;
}

function detectAreasIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;

  const parseResult = parseAreasInput(text);

  if (!parseResult.success || parseResult.intent === "unknown") {
    // Check if any area pattern matched without a successful parse
    if (matchesAreaCreate(text) || matchesAreaArchive(text) || matchesAreaAssign(text)) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "areas",
        action: parseResult.intent === "assign-note" ? "assign-note" : parseResult.intent === "assign-task" ? "assign-task" : parseResult.intent === "archive" ? "archive" : "create",
        confidence: 0.4,
        entities: {},
        missingData: parseResult.missingData,
        requiresConfirmation: false,
        reasoningSummary: "Area intent detected but missing required data: " + parseResult.missingData.join(", "),
      };
    }
    return null;
  }

  const { intent } = parseResult;

  if (intent === "create") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "areas",
      action: "create",
      confidence: 0.85,
      entities: {
        name: parseResult.name,
        slug: parseResult.slug,
        description: parseResult.description,
      },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Area create intent detected.",
    };
  }

  if (intent === "list") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "areas",
      action: "list",
      confidence: 0.85,
      entities: {},
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Area list intent detected.",
    };
  }

  if (intent === "archive") {
    if (!parseResult.areaSlug) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "areas",
        action: "archive",
        confidence: 0.4,
        entities: {},
        missingData: ["area"],
        requiresConfirmation: false,
        reasoningSummary: "Area archive intent detected but area not identified.",
      };
    }
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "areas",
      action: "archive",
      confidence: 0.85,
      entities: { areaSlug: parseResult.areaSlug },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Area archive intent detected.",
    };
  }

  if (intent === "assign-note") {
    if (!parseResult.areaSlug) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "areas",
        action: "assign-note",
        confidence: 0.4,
        entities: { entityType: "note" },
        missingData: ["area"],
        requiresConfirmation: false,
        reasoningSummary: "Area assign-note intent detected but area not identified.",
      };
    }

    // Try to resolve note reference from session context
    let noteId: string | undefined;
    const sessionCtx = input.sessionContext;
    if (sessionCtx) {
      if (sessionCtx.focusedEntityType === "note" && sessionCtx.focusedEntityId) {
        noteId = sessionCtx.focusedEntityId;
      }
    }

    if (!noteId) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "areas",
        action: "assign-note",
        confidence: 0.4,
        entities: { areaSlug: parseResult.areaSlug, entityType: "note" },
        missingData: ["entity"],
        requiresConfirmation: false,
        reasoningSummary: "Area assign-note intent detected but note entity not resolved.",
      };
    }

    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "areas",
      action: "assign-note",
      confidence: 0.85,
      entities: { areaSlug: parseResult.areaSlug, noteId, entityType: "note" },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Area assign-note intent detected and entity resolved.",
    };
  }

  if (intent === "assign-task") {
    if (!parseResult.areaSlug) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "areas",
        action: "assign-task",
        confidence: 0.4,
        entities: { entityType: "task" },
        missingData: ["area"],
        requiresConfirmation: false,
        reasoningSummary: "Area assign-task intent detected but area not identified.",
      };
    }

    // Try to resolve task reference from session context
    const sessionCtx = input.sessionContext;
    const resolved = resolveTaskReference(sessionCtx);
    if (!resolved || !resolved.taskId) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "areas",
        action: "assign-task",
        confidence: 0.4,
        entities: { areaSlug: parseResult.areaSlug, entityType: "task" },
        missingData: ["entity"],
        requiresConfirmation: false,
        reasoningSummary: "Area assign-task intent detected but task entity not resolved.",
      };
    }

    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "areas",
      action: "assign-task",
      confidence: 0.85,
      entities: { areaSlug: parseResult.areaSlug, taskId: resolved.taskId, entityType: "task" },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Area assign-task intent detected and entity resolved.",
    };
  }

  return null;
}

function detectObjectivesIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;

  const parseResult = parseObjectivesInput(text);

  if (!parseResult.success || parseResult.intent === "unknown") {
    // Check if any objective pattern matched without a successful parse
    if (matchesObjectiveCreate(text) || matchesObjectiveAchieve(text) || matchesObjectiveArchive(text) || matchesObjectiveAssign(text)) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "objectives",
        action: parseResult.intent === "assign-task" ? "assign-task" : parseResult.intent === "achieve" ? "achieve" : parseResult.intent === "archive" ? "archive" : "create",
        confidence: 0.4,
        entities: {},
        missingData: parseResult.missingData,
        requiresConfirmation: false,
        reasoningSummary: "Objective intent detected but missing required data: " + parseResult.missingData.join(", "),
      };
    }
    return null;
  }

  const { intent } = parseResult;

  if (intent === "create") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "objectives",
      action: "create",
      confidence: 0.85,
      entities: {
        title: parseResult.title,
        slug: parseResult.slug,
        description: parseResult.description,
        areaSlug: parseResult.areaSlug,
        targetDate: parseResult.targetDate,
        successCriteria: parseResult.successCriteria,
      },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Objective create intent detected.",
    };
  }

  if (intent === "list") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "objectives",
      action: "list",
      confidence: 0.85,
      entities: {},
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Objective list intent detected.",
    };
  }

  if (intent === "achieve") {
    if (!parseResult.objectiveSlug) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "objectives",
        action: "achieve",
        confidence: 0.4,
        entities: {},
        missingData: ["objective"],
        requiresConfirmation: false,
        reasoningSummary: "Objective achieve intent detected but objective not identified.",
      };
    }
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "objectives",
      action: "achieve",
      confidence: 0.85,
      entities: { objectiveSlug: parseResult.objectiveSlug },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Objective achieve intent detected.",
    };
  }

  if (intent === "archive") {
    if (!parseResult.objectiveSlug) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "objectives",
        action: "archive",
        confidence: 0.4,
        entities: {},
        missingData: ["objective"],
        requiresConfirmation: false,
        reasoningSummary: "Objective archive intent detected but objective not identified.",
      };
    }
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "objectives",
      action: "archive",
      confidence: 0.85,
      entities: { objectiveSlug: parseResult.objectiveSlug },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Objective archive intent detected.",
    };
  }

  if (intent === "assign-task") {
    if (!parseResult.objectiveSlug) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "objectives",
        action: "assign-task",
        confidence: 0.4,
        entities: { entityType: "task" },
        missingData: ["objective"],
        requiresConfirmation: false,
        reasoningSummary: "Objective assign-task intent detected but objective not identified.",
      };
    }

    // Try to resolve task reference from session context
    const sessionCtx = input.sessionContext;
    const resolved = resolveTaskReference(sessionCtx);
    if (!resolved || !resolved.taskId) {
      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: "objectives",
        action: "assign-task",
        confidence: 0.4,
        entities: { objectiveSlug: parseResult.objectiveSlug, entityType: "task" },
        missingData: ["task"],
        requiresConfirmation: false,
        reasoningSummary: "Objective assign-task intent detected but task entity not resolved.",
      };
    }

    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "objectives",
      action: "assign-task",
      confidence: 0.85,
      entities: { objectiveSlug: parseResult.objectiveSlug, taskId: resolved.taskId, entityType: "task" },
      missingData: [],
      requiresConfirmation: false,
      reasoningSummary: "Objective assign-task intent detected and entity resolved.",
    };
  }

  return null;
}

function detectRoutinesIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;
  const parsed = parseRoutinesInput(text);
  if (parsed.intent === "unknown") return null;
  const base = {
    schemaVersion: "module_intent_result.v1" as const,
    traceId: input.traceId,
    module: "routines" as const,
    confidence: parsed.success ? 0.85 : 0.4,
    missingData: parsed.missingData,
    requiresConfirmation: false,
  };
  if (parsed.intent === "create") {
    return { ...base, action: "create", entities: { name: parsed.name, slug: parsed.slug, description: parsed.description, steps: parsed.steps }, reasoningSummary: "Routine create intent detected." };
  }
  if (parsed.intent === "list") {
    return { ...base, action: "list", entities: {}, reasoningSummary: "Routine list intent detected." };
  }
  if (parsed.intent === "activate") {
    return { ...base, action: "activate", entities: { slug: parsed.routineSlug }, reasoningSummary: "Routine activate intent detected." };
  }
  if (parsed.intent === "pause") {
    return { ...base, action: "pause", entities: { slug: parsed.routineSlug }, reasoningSummary: "Routine pause intent detected." };
  }
  if (parsed.intent === "archive") {
    return { ...base, action: "archive", entities: { slug: parsed.routineSlug }, reasoningSummary: "Routine archive intent detected." };
  }
  return null;
}

function focusedId(input: ModuleIntentInput, type: string): string | undefined {
  return input.sessionContext?.focusedEntityType === type ? input.sessionContext.focusedEntityId : undefined;
}

function detectWorkoutsIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;
  const parsed = parseWorkoutsInput(text);
  if (parsed.intent === "unknown") return null;
  const sessionId = focusedId(input, "workout_session");
  const base = {
    schemaVersion: "module_intent_result.v1" as const,
    traceId: input.traceId,
    module: "workouts" as const,
    confidence: parsed.success ? 0.85 : 0.4,
    missingData: [...parsed.missingData],
    requiresConfirmation: false,
  };
  if (parsed.intent === "start") {
    return { ...base, action: "start", entities: { title: parsed.title }, reasoningSummary: "Workout start intent detected." };
  }
  if (parsed.intent === "list") {
    return { ...base, action: "list", entities: {}, reasoningSummary: "Workout list intent detected." };
  }
  if (parsed.intent === "finish") {
    return {
      ...base,
      action: "finish",
      confidence: sessionId ? 0.85 : 0.4,
      entities: sessionId ? { sessionId } : {},
      missingData: sessionId ? [] : ["workoutSession"],
      reasoningSummary: "Workout finish intent detected.",
    };
  }
  if (parsed.intent === "cancel") {
    return {
      ...base,
      action: "cancel",
      confidence: sessionId ? 0.85 : 0.4,
      entities: sessionId ? { sessionId } : {},
      missingData: sessionId ? [] : ["workoutSession"],
      reasoningSummary: "Workout cancel intent detected.",
    };
  }
  if (parsed.intent === "log-set") {
    const missing = [...parsed.missingData];
    if (!sessionId) missing.push("workoutSession");
    return {
      ...base,
      action: "log-set",
      confidence: parsed.success && sessionId ? 0.85 : 0.4,
      entities: {
        sessionId,
        exerciseName: parsed.exerciseName,
        setNumber: parsed.setNumber,
        actualReps: parsed.actualReps,
        weightKg: parsed.weightKg,
        durationSeconds: parsed.durationSeconds,
      },
      missingData: missing,
      reasoningSummary: "Workout set logging intent detected.",
    };
  }
  return null;
}

function detectTimersIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;
  const parsed = parseTimersInput(text);
  if (parsed.intent === "unknown") return null;
  const timerId = focusedId(input, "timer");
  if (parsed.intent === "start") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "timers",
      action: "start",
      confidence: parsed.success ? 0.85 : 0.4,
      entities: { kind: parsed.kind, title: parsed.title, durationSeconds: parsed.durationSeconds },
      missingData: parsed.missingData,
      requiresConfirmation: false,
      reasoningSummary: "Timer start intent detected.",
    };
  }
  if (parsed.intent === "cancel") {
    return {
      schemaVersion: "module_intent_result.v1",
      traceId: input.traceId,
      module: "timers",
      action: "cancel",
      confidence: timerId ? 0.85 : 0.4,
      entities: timerId ? { timerId } : {},
      missingData: timerId ? [] : ["timerId"],
      requiresConfirmation: false,
      reasoningSummary: "Timer cancel intent detected.",
    };
  }
  return null;
}

function detectProgressIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;
  const parsed = parseProgressInput(text);
  if (parsed.intent === "unknown") return null;
  const action = parsed.intent === "workout" ? "workout" : parsed.intent === "objective" ? "objective" : "summary";
  return {
    schemaVersion: "module_intent_result.v1",
    traceId: input.traceId,
    module: "progress",
    action,
    confidence: parsed.success ? 0.85 : 0.4,
    entities: { exerciseName: parsed.exerciseName, objectiveSlug: parsed.objectiveSlug },
    missingData: parsed.missingData,
    requiresConfirmation: false,
    reasoningSummary: "Progress read-only intent detected.",
  };
}

function detectPlansIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;
  const parsed = parsePlansInput(text);
  if (parsed.intent === "unknown") return null;
  const action = parsed.intent;
  return {
    schemaVersion: "module_intent_result.v1",
    traceId: input.traceId,
    module: "plans",
    action,
    confidence: parsed.success && parsed.missingData.length === 0 ? 0.85 : 0.4,
    entities: {
      title: parsed.title,
      slug: parsed.slug,
      description: parsed.description,
      objectiveSlug: parsed.objectiveSlug,
      planSlug: parsed.planSlug,
      steps: parsed.steps,
      stepPosition: parsed.stepPosition,
    },
    missingData: parsed.missingData,
    requiresConfirmation: false,
    reasoningSummary: "Plan intent detected.",
  };
}

function detectProtocolsIntent(input: ModuleIntentInput): ModuleIntentResult | null {
  const text = input.messages.map((m) => m.content).join(" ").trim();
  if (!text) return null;
  const parsed = parseProtocolsInput(text);
  if (parsed.intent === "unknown") return null;
  return {
    schemaVersion: "module_intent_result.v1",
    traceId: input.traceId,
    module: "protocols",
    action: parsed.intent,
    confidence: parsed.success ? 0.85 : 0.4,
    entities: {
      name: parsed.name,
      slug: parsed.slug,
      scope: parsed.scope ?? "general",
      rules: parsed.rules,
      description: parsed.description,
      context: input.sessionContext?.context ?? {},
    },
    missingData: parsed.missingData,
    requiresConfirmation: false,
    reasoningSummary: "Protocol intent detected.",
  };
}

export function createModuleIntentClassifier(): ModuleIntentClassifier {
  return {
    async classify(input) {
      if (input.module === "tasks") {
        const detected = detectTasksIntent(input);
        if (detected) return detected;
      }

      if (input.module === "notes") {
        const detected = detectNotesIntent(input);
        if (detected) return detected;
      }

      if (input.module === "reminders") {
        const detected = detectRemindersIntent(input);
        if (detected) return detected;
      }

      if (input.module === "daily-log") {
        const detected = detectDailyLogIntent(input);
        if (detected) return detected;
      }

      if (input.module === "areas") {
        const detected = detectAreasIntent(input);
        if (detected) return detected;
      }

      if (input.module === "objectives") {
        const detected = detectObjectivesIntent(input);
        if (detected) return detected;
      }

      if (input.module === "routines") {
        const detected = detectRoutinesIntent(input);
        if (detected) return detected;
      }

      if (input.module === "workouts") {
        const detected = detectWorkoutsIntent(input);
        if (detected) return detected;
      }

      if (input.module === "timers") {
        const detected = detectTimersIntent(input);
        if (detected) return detected;
      }

      if (input.module === "progress") {
        const detected = detectProgressIntent(input);
        if (detected) return detected;
      }

      if (input.module === "plans") {
        const detected = detectPlansIntent(input);
        if (detected) return detected;
      }

      if (input.module === "protocols") {
        const detected = detectProtocolsIntent(input);
        if (detected) return detected;
      }

      return {
        schemaVersion: "module_intent_result.v1",
        traceId: input.traceId,
        module: input.module,
        action: "none",
        confidence: 0.1,
        entities: {},
        missingData: ["intent classification not implemented"],
        requiresConfirmation: false,
        reasoningSummary: "Skeleton classifier: intent detection not yet implemented.",
      };
    },
  };
}
