import { describe, expect, it } from "vitest";
import { parseWorkoutsInput } from "../src/modules/workouts/workoutsParser.js";

describe("workoutsParser - start", () => {
  it("parses arrancar gym", () => {
    const result = parseWorkoutsInput("arrancar gym");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
  });

  it("parses arrancar gym piernas", () => {
    const result = parseWorkoutsInput("arrancar gym piernas");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.title).toBe("piernas");
  });

  it("parses empezar entrenamiento", () => {
    const result = parseWorkoutsInput("empezar entrenamiento");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
  });

  it("parses iniciar gym pecho", () => {
    const result = parseWorkoutsInput("iniciar gym pecho");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("start");
    expect(result.title).toBe("pecho");
  });
});

describe("workoutsParser - log-set", () => {
  it("parses sentadilla serie 1 8 reps 60kg", () => {
    const result = parseWorkoutsInput("sentadilla serie 1 8 reps 60kg");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("sentadilla");
    expect(result.setNumber).toBe(1);
    expect(result.actualReps).toBe(8);
    expect(result.weightKg).toBe(60);
  });

  it("parses listo sentadilla 8 reps 60kg", () => {
    const result = parseWorkoutsInput("listo sentadilla 8 reps 60kg");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("sentadilla");
    expect(result.setNumber).toBe(1);
    expect(result.actualReps).toBe(8);
    expect(result.weightKg).toBe(60);
  });

  it("parses listo sentadilla 8 reps", () => {
    const result = parseWorkoutsInput("listo sentadilla 8 reps");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("sentadilla");
    expect(result.setNumber).toBe(1);
    expect(result.actualReps).toBe(8);
  });

  it("parses sentadilla 8 reps 60kg", () => {
    const result = parseWorkoutsInput("sentadilla 8 reps 60kg");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("sentadilla");
    expect(result.setNumber).toBe(1);
    expect(result.actualReps).toBe(8);
    expect(result.weightKg).toBe(60);
  });

  it("parses dominadas 4 reps", () => {
    const result = parseWorkoutsInput("dominadas 4 reps");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("dominadas");
    expect(result.setNumber).toBe(1);
    expect(result.actualReps).toBe(4);
  });

  it("parses press banca serie 2 10 reps 80kg", () => {
    const result = parseWorkoutsInput("press banca serie 2 10 reps 80kg");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("press banca");
    expect(result.setNumber).toBe(2);
    expect(result.actualReps).toBe(10);
    expect(result.weightKg).toBe(80);
  });

  it("parses plano 10min", () => {
    const result = parseWorkoutsInput("plano 10min");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("plano");
    expect(result.setNumber).toBe(1);
    expect(result.durationSeconds).toBe(600);
  });

  it("parses listo plano 5min", () => {
    const result = parseWorkoutsInput("listo plano 5min");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("plano");
    expect(result.setNumber).toBe(1);
    expect(result.durationSeconds).toBe(300);
  });

  it("returns unknown for numbers-only input", () => {
    const result = parseWorkoutsInput("8 reps 60kg");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("unknown");
    expect(result.missingData).toContain("workouts_command");
  });

  it("returns missing workoutEffort for listo with only exercise name", () => {
    const result = parseWorkoutsInput("listo sentadilla");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("unknown");
    expect(result.missingData).toContain("workouts_command");
  });

  it("returns missing workoutEffort for log-set without reps or duration", () => {
    const result = parseWorkoutsInput("sentadilla serie 1");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("log-set");
    expect(result.exerciseName).toBe("sentadilla");
    expect(result.missingData).toContain("workoutEffort");
  });
});

describe("workoutsParser - finish", () => {
  it("parses terminar gym", () => {
    const result = parseWorkoutsInput("terminar gym");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("finish");
  });

  it("parses terminar entrenamiento", () => {
    const result = parseWorkoutsInput("terminar entrenamiento");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("finish");
  });

  it("parses finalizar gym", () => {
    const result = parseWorkoutsInput("finalizar gym");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("finish");
  });
});

describe("workoutsParser - cancel", () => {
  it("parses cancelar gym", () => {
    const result = parseWorkoutsInput("cancelar gym");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("cancel");
  });

  it("parses cancelar entrenamiento", () => {
    const result = parseWorkoutsInput("cancelar entrenamiento");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("cancel");
  });
});

describe("workoutsParser - list", () => {
  it("parses que entrenamientos tengo", () => {
    const result = parseWorkoutsInput("que entrenamientos tengo");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses listar entrenamientos", () => {
    const result = parseWorkoutsInput("listar entrenamientos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses mis entrenamientos", () => {
    const result = parseWorkoutsInput("mis entrenamientos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses ver entrenamientos", () => {
    const result = parseWorkoutsInput("ver entrenamientos");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });

  it("parses historial gym", () => {
    const result = parseWorkoutsInput("historial gym");
    expect(result.success).toBe(true);
    expect(result.intent).toBe("list");
  });
});

describe("workoutsParser - unknown", () => {
  it("returns unknown for empty string", () => {
    const result = parseWorkoutsInput("");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("unknown");
  });

  it("returns unknown for unrelated text", () => {
    const result = parseWorkoutsInput("crear tarea comprar pan");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("unknown");
  });

  it("returns unknown for exercise name without reps or duration", () => {
    const result = parseWorkoutsInput("sentadilla");
    expect(result.success).toBe(false);
    expect(result.intent).toBe("unknown");
    expect(result.missingData).toContain("workouts_command");
  });
});
