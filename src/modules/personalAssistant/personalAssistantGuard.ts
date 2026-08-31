// src/modules/personalAssistant/personalAssistantGuard.ts
// Filtro fail-closed para material forbidden en SARA Personal.
// No refleja el valor sospechoso en errores, logs ni journal.

// Fail-closed terms with Unicode-aware word boundaries so ordinary words such as
// "pintura", "opinión", "shopping" or "espinaca" are not rejected.
const LETTER = "a-zA-Z\\u00e1\\u00e9\\u00ed\\u00f3\\u00fa\\u00c1\\u00c9\\u00cd\\u00d3\\u00da\\u00f1\\u00d1";
const FORBIDDEN_RE = new RegExp(
  `(?<![${LETTER}])(?:password|contraseña|pin|token|mfa|secretos?|secrets?|recovery|recuperaci[óo]n|passcode|cvv|cvc|2fa|otp)(?![${LETTER}])`,
  "i",
);

export function containsForbiddenMaterial(text: string): boolean {
  return FORBIDDEN_RE.test(text);
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function scanForForbidden(payload: unknown): { forbidden: false } | { forbidden: true; path: string } {
  function walk(value: unknown, path: string): { forbidden: false } | { forbidden: true; path: string } {
    if (isScalar(value)) {
      if (containsForbiddenMaterial(String(value))) return { forbidden: true, path };
      return { forbidden: false };
    }
    if (value === null || value === undefined) return { forbidden: false };
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const found = walk(value[i], `${path}[${i}]`);
        if (found.forbidden) return found;
      }
      return { forbidden: false };
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        // Keys themselves can carry forbidden terms (e.g. "my_password").
        if (containsForbiddenMaterial(key)) return { forbidden: true, path: path ? `${path}.${key}` : key };
        const found = walk(child, path ? `${path}.${key}` : key);
        if (found.forbidden) return found;
      }
      return { forbidden: false };
    }
    return { forbidden: false };
  }

  return walk(payload, "payload");
}
