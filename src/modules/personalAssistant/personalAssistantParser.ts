import type { ExpenseInput, PersonalScope } from "../../contracts/personalAssistant.js";

export interface ParsedExpense extends Omit<ExpenseInput, "traceId" | "source"> { source: "manual"; }

const money = /(?:\$|usd|uyu|ars|eur)\s*([0-9][0-9.,]*)/i;
// `$` alone is ambiguous; only a stated currency or an explicit local rule may resolve it.
function parseNumber(raw: string): number | undefined {
  const value = raw.replace(/\s/g, "");
  const separators = [...value.matchAll(/[.,]/g)].map((match) => match.index!);
  const lastSeparator = separators.at(-1);
  const fractionalDigits = lastSeparator === undefined ? 0 : value.length - lastSeparator - 1;
  const hasThousandsGrouping = fractionalDigits === 3 && separators.length > 1;
  const normalized = lastSeparator !== undefined && fractionalDigits > 0 && fractionalDigits < 3 && !hasThousandsGrouping
    ? `${value.slice(0, lastSeparator).replace(/[.,]/g, "")}.${value.slice(lastSeparator + 1)}`
    : value.replace(/[.,]/g, "");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : undefined;
}

function extractEntity(value: string): string | undefined {
  const explicit = /\b(?:empresa|entidad)\s*[:=]?\s*(DELTA|BARBEROX)\b/i.exec(value);
  if (explicit) return explicit[1].toUpperCase();
  const afterEn = /\ben\s+(DELTA|BARBEROX)\b/i.exec(value);
  if (afterEn) return afterEn[1].toUpperCase();
  const knownEntity = /\b(DELTA|BARBEROX)\b/i.exec(value);
  return knownEntity?.[1].toUpperCase();
}

export function parseExpenseCommand(text: string): ParsedExpense | { missingData: string[] } {
  const value = text.trim();
  const scopeMatch = /\b(personal|negocio|empresa|business)\b/i.exec(value);
  const scope: PersonalScope | undefined = scopeMatch
    ? (/personal/i.test(scopeMatch[1]) ? "PERSONAL" : "BUSINESS") : undefined;
  const amountMatch = money.exec(value) ?? /\b([0-9]+(?:[.,][0-9]{1,2})?)\b/.exec(value);
  const amount = amountMatch ? parseNumber(amountMatch[1]) : undefined;
  const entity = extractEntity(value);
  const concept = value.replace(/^\s*(?:gasto|registrar gasto)\s*[:=-]?\s*/i, "").trim();
  const missing: string[] = [];
  if (!scope) missing.push("scope");
  if (!amount || amount <= 0) missing.push("amount");
  if (!concept) missing.push("concept");
  if (scope === "BUSINESS" && !entity) missing.push("entity");
  const currencyMatch = /\b(uyu|ars|eur|usd)\b/i.exec(value);
  if (!currencyMatch && /\$/.test(value) && !/\b(?:dólares?|dollars?|pesos?)\b/i.test(value)) missing.push("currency");
  if (missing.length) return { missingData: missing };
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : /dólares?|dollars?/i.test(value) ? "USD" : /pesos?/i.test(value) ? "UYU" : undefined;
  return { scope: scope!, amount: amount!, currency, occurredOn: new Date().toISOString().slice(0, 10), concept, entity, source: "manual", confidence: scope === "BUSINESS" && entity ? 0.95 : 0.9 };
}
