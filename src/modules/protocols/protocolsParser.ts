import type { ProtocolRule, ProtocolScope } from "../../contracts/protocols.js";

export interface ParsedProtocolsInput {
  intent: "create" | "list" | "activate" | "archive" | "evaluate" | "unknown";
  name?: string;
  slug?: string;
  scope?: ProtocolScope;
  rules: ProtocolRule[];
  description?: string;
  success: boolean;
  missingData: string[];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractProtocolName(raw: string): string {
  return raw.replace(/^(?:al\s+|a\s+la?\s+)?\s*protocolo\s+/i, "").trim();
}

const PROTOCOL_CREATE_PATTERNS = [
  /^crear\s+protocolo\s+(.+)/i,
  /^crea\s+protocolo\s+(.+)/i,
  /^nuevo\s+protocolo\s+(.+)/i,
  /^agregar\s+protocolo\s+(.+)/i,
];

const PROTOCOL_CREATE_BARE_PATTERNS = [
  /^crear\s+protocolo\s*$/i,
  /^crea\s+protocolo\s*$/i,
  /^nuevo\s+protocolo\s*$/i,
  /^agregar\s+protocolo\s*$/i,
];

const PROTOCOL_LIST_PATTERNS = [
  /^(?:que|mis)\s+protocolos\s+(?:tengo|hay|tienes|existen)/i,
  /^listar?\s*protocolos/i,
  /^lista\s*(?:mis\s*)?protocolos/i,
  /^mis\s*protocolos/i,
  /^protocolos\s*$/i,
  /^ver\s*protocolos/i,
  /^mostrar\s*protocolos/i,
];

const PROTOCOL_ACTIVATE_PATTERNS = [
  /^activar\s+protocolo\s+(.+)/i,
  /^activa\s+protocolo\s+(.+)/i,
];

const PROTOCOL_ACTIVATE_BARE_PATTERNS = [
  /^activar\s+protocolo\s*$/i,
  /^activa\s+protocolo\s*$/i,
];

const PROTOCOL_ARCHIVE_PATTERNS = [
  /^archivar\s+protocolo\s+(.+)/i,
  /^archiva\s+protocolo\s+(.+)/i,
];

const PROTOCOL_ARCHIVE_BARE_PATTERNS = [
  /^archivar\s+protocolo\s*$/i,
  /^archiva\s+protocolo\s*$/i,
];

const PROTOCOL_EVALUATE_PATTERNS = [
  /^evaluar\s+protocolo\s+(.+)/i,
  /^eval[u\u00fa]a\s+protocolo\s+(.+)/i,
  /^revisar\s+protocolo\s+(.+)/i,
];

const PROTOCOL_EVALUATE_BARE_PATTERNS = [
  /^evaluar\s+protocolo\s*$/i,
  /^eval[u\u00fa]a\s+protocolo\s*$/i,
];

function parseRulesFromName(rawName: string): { cleanName: string; rules: ProtocolRule[] } {
  // Pattern: "protocol name: rule text" or "protocol name: if condition, action"
  const colonIdx = rawName.indexOf(":");
  if (colonIdx === -1) {
    return { cleanName: rawName, rules: [] };
  }

  const cleanName = rawName.substring(0, colonIdx).trim();
  const ruleText = rawName.substring(colonIdx + 1).trim();

  if (!ruleText || !cleanName) {
    return { cleanName, rules: [] };
  }

  // Try to parse "si condition, action" pattern
  const siMatch = ruleText.match(/^si\s+(.+?),\s*(.+)$/i);
  if (siMatch && siMatch[1] && siMatch[2]) {
    return {
      cleanName,
      rules: [{ condition: siMatch[1].trim(), action: siMatch[2].trim() }],
    };
  }

  // Fallback: store the whole text as a single rule with condition=ruleText
  return {
    cleanName,
    rules: [{ condition: ruleText, action: "" }],
  };
}

export function parseProtocolsInput(text: string): ParsedProtocolsInput {
  if (!text) {
    return { intent: "unknown", success: false, missingData: ["protocols_command"], rules: [] };
  }

  const trimmed = text.trim();

  // Create bare - missing name
  for (const pattern of PROTOCOL_CREATE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "create", success: false, missingData: ["protocolName"], rules: [] };
    }
  }

  // Create with name
  for (const pattern of PROTOCOL_CREATE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = match[1].trim();
      const { cleanName, rules } = parseRulesFromName(raw);
      const slug = slugify(cleanName);
      if (!slug) {
        return { intent: "create", name: cleanName, success: false, missingData: ["protocolName"], rules };
      }
      return { intent: "create", name: cleanName, slug, rules, success: true, missingData: [] };
    }
  }

  // List
  for (const pattern of PROTOCOL_LIST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "list", success: true, missingData: [], rules: [] };
    }
  }

  // Activate bare - missing name
  for (const pattern of PROTOCOL_ACTIVATE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "activate", success: false, missingData: ["protocol"], rules: [] };
    }
  }

  // Activate with name
  for (const pattern of PROTOCOL_ACTIVATE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractProtocolName(match[1].trim());
      const slug = slugify(raw);
      if (!slug) {
        return { intent: "activate", success: false, missingData: ["protocol"], rules: [] };
      }
      return { intent: "activate", slug, success: true, missingData: [], rules: [] };
    }
  }

  // Archive bare - missing name
  for (const pattern of PROTOCOL_ARCHIVE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "archive", success: false, missingData: ["protocol"], rules: [] };
    }
  }

  // Archive with name
  for (const pattern of PROTOCOL_ARCHIVE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractProtocolName(match[1].trim());
      const slug = slugify(raw);
      if (!slug) {
        return { intent: "archive", success: false, missingData: ["protocol"], rules: [] };
      }
      return { intent: "archive", slug, success: true, missingData: [], rules: [] };
    }
  }

  // Evaluate bare - missing name
  for (const pattern of PROTOCOL_EVALUATE_BARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "evaluate", success: false, missingData: ["protocol"], rules: [] };
    }
  }

  // Evaluate with name
  for (const pattern of PROTOCOL_EVALUATE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1] && match[1].trim()) {
      const raw = extractProtocolName(match[1].trim());
      const slug = slugify(raw);
      if (!slug) {
        return { intent: "evaluate", success: false, missingData: ["protocol"], rules: [] };
      }
      return { intent: "evaluate", slug, success: true, missingData: [], rules: [] };
    }
  }

  return { intent: "unknown", success: false, missingData: ["protocols_command"], rules: [] };
}
