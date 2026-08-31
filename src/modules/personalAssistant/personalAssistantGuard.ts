// src/modules/personalAssistant/personalAssistantGuard.ts
// Filtro fail-closed para material forbidden en SARA Personal.
// No refleja el valor sospechoso en errores, logs ni journal.

const FORBIDDEN_RE = /(?:password|contraseña|pin|token|mfa|secret|secreto|recovery|recuperaci[oó]n|passcode|cvv|cvc|2fa|otp)/i;

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
