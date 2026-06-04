export interface ParsedWorkoutsInput {
  intent: "start" | "log-set" | "finish" | "cancel" | "list" | "unknown";
  title?: string;
  exerciseName?: string;
  setNumber?: number;
  actualReps?: number;
  weightKg?: number;
  durationSeconds?: number;
  success: boolean;
  missingData: string[];
}

const WORKOUT_START_PATTERNS = [
  /^arrancar\s+gym\s*$/i,
  /^arranca[r]?\s+gym\s*$/i,
  /^empezar\s+(?:entrenamiento|gym)\s*$/i,
  /^iniciar\s+(?:entrenamiento|gym)\s*$/i,
];

const WORKOUT_START_TITLE_PATTERNS = [
  /^arrancar\s+gym\s+(.+)/i,
  /^arranca[r]?\s+gym\s+(.+)/i,
  /^empezar\s+(?:entrenamiento|gym)\s+(.+)/i,
  /^iniciar\s+(?:entrenamiento|gym)\s+(.+)/i,
];

const WORKOUT_LOG_SET_BARE_PATTERNS = [
  /^(.+?)\s+serie\s+(\d+)\s*$/i,
];

const WORKOUT_LOG_SET_PATTERNS = [
  /^listo\s+(.+?)\s+(\d+)\s+reps\s+(\d+(?:\.\d+)?)\s*kg$/i,
  /^listo\s+(.+?)\s+(\d+)\s+reps\s*$/i,
  /^listo\s+(.+?)\s+(\d+(?:\.\d+)?)\s*min\s*$/i,
  /^(.+?)\s+serie\s+(\d+)\s+(\d+)\s+reps\s+(\d+(?:\.\d+)?)\s*kg$/i,
  /^(.+?)\s+serie\s+(\d+)\s+(\d+)\s+reps\s*$/i,
  /^(.+?)\s+(\d+)\s+reps\s+(\d+(?:\.\d+)?)\s*kg$/i,
  /^(.+?)\s+(\d+)\s+reps\s*$/i,
  /^(.+?)\s+(\d+(?:\.\d+)?)\s*min\s*$/i,
];

const WORKOUT_FINISH_PATTERNS = [
  /^terminar\s+gym\s*$/i,
  /^termina[r]?\s+gym\s*$/i,
  /^terminar\s+entrenamiento\s*$/i,
  /^termina[r]?\s+entrenamiento\s*$/i,
  /^finalizar\s+gym\s*$/i,
  /^finalizar\s+entrenamiento\s*$/i,
];

const WORKOUT_CANCEL_PATTERNS = [
  /^cancelar\s+gym\s*$/i,
  /^cancela[r]?\s+gym\s*$/i,
  /^cancelar\s+entrenamiento\s*$/i,
  /^cancela[r]?\s+entrenamiento\s*$/i,
];

const WORKOUT_LIST_PATTERNS = [
  /^que\s+entrenamientos\s+tengo\s*$/i,
  /^que\s+entrenamientos\s+hay\s*$/i,
  /^listar\s*entrenamientos\s*$/i,
  /^mis\s*entrenamientos\s*$/i,
  /^ver\s*entrenamientos\s*$/i,
  /^mostrar\s*entrenamientos\s*$/i,
  /^entrenamientos\s*$/i,
  /^historial\s+gym\s*$/i,
];

function parseWeightKg(value: string): number | undefined {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseSetNumber(value: string): number | undefined {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseReps(value: string): number | undefined {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseDurationMinutes(value: string): number | undefined {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 60);
}

export function parseWorkoutsInput(text: string): ParsedWorkoutsInput {
  if (!text) {
    return { intent: "unknown", success: false, missingData: ["workouts_command"] };
  }

  const trimmed = text.trim();

  // Start without title
  for (const pattern of WORKOUT_START_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "start", success: true, missingData: [] };
    }
  }

  // Start with title
  for (const pattern of WORKOUT_START_TITLE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const title = match[1].trim();
      return { intent: "start", title, success: true, missingData: [] };
    }
  }

  // Finish
  for (const pattern of WORKOUT_FINISH_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "finish", success: true, missingData: [] };
    }
  }

  // Cancel
  for (const pattern of WORKOUT_CANCEL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "cancel", success: true, missingData: [] };
    }
  }

  // List
  for (const pattern of WORKOUT_LIST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "list", success: true, missingData: [] };
    }
  }

  // Log-set bare: exercise + serie without reps/duration
  for (const pattern of WORKOUT_LOG_SET_BARE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const exerciseName = match[1].trim();
      const setNumber = parseSetNumber(match[2]);
      if (!exerciseName) {
        return { intent: "log-set", missingData: ["exerciseName"], success: false };
      }
      return { intent: "log-set", exerciseName, setNumber: setNumber ?? 1, missingData: ["workoutEffort"], success: false };
    }
  }

  // Log-set: "listo <exercise> <reps> reps <weight>kg"
  const listoWithWeight = /^listo\s+(.+?)\s+(\d+)\s+reps\s+(\d+(?:\.\d+)?)\s*kg$/i.exec(trimmed);
  if (listoWithWeight) {
    const exerciseName = listoWithWeight[1].trim();
    const reps = parseReps(listoWithWeight[2]);
    const weight = parseWeightKg(listoWithWeight[3]);
    if (!exerciseName) {
      return { intent: "log-set", missingData: ["exerciseName"], success: false };
    }
    if (reps === undefined) {
      return { intent: "log-set", exerciseName, missingData: ["workoutEffort"], success: false };
    }
    return { intent: "log-set", exerciseName, setNumber: 1, actualReps: reps, weightKg: weight, success: true, missingData: [] };
  }

  // Log-set: "listo <exercise> <reps> reps"
  const listoRepsOnly = /^listo\s+(.+?)\s+(\d+)\s+reps\s*$/i.exec(trimmed);
  if (listoRepsOnly) {
    const exerciseName = listoRepsOnly[1].trim();
    const reps = parseReps(listoRepsOnly[2]);
    if (!exerciseName) {
      return { intent: "log-set", missingData: ["exerciseName"], success: false };
    }
    if (reps === undefined) {
      return { intent: "log-set", exerciseName, missingData: ["workoutEffort"], success: false };
    }
    return { intent: "log-set", exerciseName, setNumber: 1, actualReps: reps, success: true, missingData: [] };
  }

  // Log-set: "listo <exercise> <duration>min"
  const listoDuration = /^listo\s+(.+?)\s+(\d+(?:\.\d+)?)\s*min\s*$/i.exec(trimmed);
  if (listoDuration) {
    const exerciseName = listoDuration[1].trim();
    const duration = parseDurationMinutes(listoDuration[2]);
    if (!exerciseName) {
      return { intent: "log-set", missingData: ["exerciseName"], success: false };
    }
    if (duration === undefined) {
      return { intent: "log-set", exerciseName, missingData: ["workoutEffort"], success: false };
    }
    return { intent: "log-set", exerciseName, setNumber: 1, durationSeconds: duration, success: true, missingData: [] };
  }

  // Log-set: "<exercise> serie <set> <reps> reps <weight>kg"
  const fullSetWithWeight = /^(.+?)\s+serie\s+(\d+)\s+(\d+)\s+reps\s+(\d+(?:\.\d+)?)\s*kg$/i.exec(trimmed);
  if (fullSetWithWeight) {
    const exerciseName = fullSetWithWeight[1].trim();
    const setNumber = parseSetNumber(fullSetWithWeight[2]);
    const reps = parseReps(fullSetWithWeight[3]);
    const weight = parseWeightKg(fullSetWithWeight[4]);
    if (!exerciseName) {
      return { intent: "log-set", missingData: ["exerciseName"], success: false };
    }
    if (reps === undefined) {
      return { intent: "log-set", exerciseName, setNumber, missingData: ["workoutEffort"], success: false };
    }
    return { intent: "log-set", exerciseName, setNumber: setNumber ?? 1, actualReps: reps, weightKg: weight, success: true, missingData: [] };
  }

  // Log-set: "<exercise> serie <set> <reps> reps"
  const fullSetRepsOnly = /^(.+?)\s+serie\s+(\d+)\s+(\d+)\s+reps\s*$/i.exec(trimmed);
  if (fullSetRepsOnly) {
    const exerciseName = fullSetRepsOnly[1].trim();
    const setNumber = parseSetNumber(fullSetRepsOnly[2]);
    const reps = parseReps(fullSetRepsOnly[3]);
    if (!exerciseName) {
      return { intent: "log-set", missingData: ["exerciseName"], success: false };
    }
    if (reps === undefined) {
      return { intent: "log-set", exerciseName, setNumber, missingData: ["workoutEffort"], success: false };
    }
    return { intent: "log-set", exerciseName, setNumber: setNumber ?? 1, actualReps: reps, success: true, missingData: [] };
  }

  // Log-set: "<exercise> <reps> reps <weight>kg" (no serie keyword, auto set 1)
  const simpleWithWeight = /^(.+?)\s+(\d+)\s+reps\s+(\d+(?:\.\d+)?)\s*kg$/i.exec(trimmed);
  if (simpleWithWeight) {
    const exerciseName = simpleWithWeight[1].trim();
    const reps = parseReps(simpleWithWeight[2]);
    const weight = parseWeightKg(simpleWithWeight[3]);
    if (!exerciseName) {
      return { intent: "log-set", missingData: ["exerciseName"], success: false };
    }
    if (reps === undefined) {
      return { intent: "log-set", exerciseName, missingData: ["workoutEffort"], success: false };
    }
    return { intent: "log-set", exerciseName, setNumber: 1, actualReps: reps, weightKg: weight, success: true, missingData: [] };
  }

  // Log-set: "<exercise> <reps> reps" (no serie keyword, auto set 1)
  const simpleRepsOnly = /^(.+?)\s+(\d+)\s+reps\s*$/i.exec(trimmed);
  if (simpleRepsOnly) {
    const exerciseName = simpleRepsOnly[1].trim();
    const reps = parseReps(simpleRepsOnly[2]);
    if (!exerciseName) {
      return { intent: "log-set", missingData: ["exerciseName"], success: false };
    }
    if (reps === undefined) {
      return { intent: "log-set", exerciseName, missingData: ["workoutEffort"], success: false };
    }
    return { intent: "log-set", exerciseName, setNumber: 1, actualReps: reps, success: true, missingData: [] };
  }

  // Log-set: "<exercise> <duration>min" (no serie keyword, auto set 1)
  const simpleDuration = /^(.+?)\s+(\d+(?:\.\d+)?)\s*min\s*$/i.exec(trimmed);
  if (simpleDuration) {
    const exerciseName = simpleDuration[1].trim();
    const duration = parseDurationMinutes(simpleDuration[2]);
    if (!exerciseName) {
      return { intent: "log-set", missingData: ["exerciseName"], success: false };
    }
    if (duration === undefined) {
      return { intent: "log-set", exerciseName, missingData: ["workoutEffort"], success: false };
    }
    return { intent: "log-set", exerciseName, setNumber: 1, durationSeconds: duration, success: true, missingData: [] };
  }

  return { intent: "unknown", success: false, missingData: ["workouts_command"] };
}
