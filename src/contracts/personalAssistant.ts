export type PersonalScope = "PERSONAL" | "BUSINESS";
export type ExpenseSource = "manual" | "import" | "system";
export type ContextKind = "ephemeral" | "durable" | "sensitive" | "forbidden";

export interface ExpenseRecord {
  id: string;
  scope: PersonalScope;
  amount: number;
  currency: string;
  occurredOn: string;
  concept: string;
  category?: string;
  entity?: string;
  source: ExpenseSource;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  traceId?: string;
}

export interface ExpenseInput {
  scope: PersonalScope;
  amount: number;
  currency?: string;
  occurredOn?: string;
  concept: string;
  category?: string;
  entity?: string;
  source: ExpenseSource;
  confidence?: number;
  traceId: string;
}

export interface ExpenseResult { status: "created" | "updated" | "failed"; expense?: ExpenseRecord; eventId?: string; traceId?: string; schemaVersion?: string; error?: string; }
export interface ExpenseListResult { status: "success" | "failed"; expenses: ExpenseRecord[]; error?: string; }

export interface ContextEntry {
  id: string;
  key: string;
  value: string;
  kind: Exclude<ContextKind, "ephemeral" | "forbidden">;
  source: string;
  declaredAt: string;
  reviewAt?: string;
  consented: boolean;
}
export interface ContextInput { key: string; value: string; kind: ContextKind; source: string; consent?: boolean; traceId: string; reviewAt?: string; }
export interface ContextResult { status: "stored" | "no_persisted" | "forgotten" | "rejected" | "failed"; entry?: ContextEntry; eventId?: string; traceId?: string; schemaVersion?: string; error?: string; }

export interface PersonalCase { id: string; name: string; description?: string; status: "open" | "closed"; createdAt: string; updatedAt: string; }
export interface CaseEvent { id: string; caseId: string; type: "note" | "pending" | "reference" | "status"; content: string; createdAt: string; }
export interface PersonalCaseInput { name: string; description?: string; traceId: string; }
export interface CaseEventInput { caseId: string; type: CaseEvent["type"]; content: string; traceId: string; }

export interface PersonalAssistantRepository {
  createExpense(input: ExpenseInput): Promise<ExpenseResult>;
  listExpenses(limit?: number): Promise<ExpenseListResult>;
  updateExpense(id: string, patch: Partial<ExpenseInput>, traceId: string): Promise<ExpenseResult>;
  reclassifyExpense(id: string, scope: PersonalScope, entity: string | undefined, traceId: string): Promise<ExpenseResult>;
  saveContext(input: ContextInput): Promise<ContextResult>;
  correctContext(id: string, input: ContextInput): Promise<ContextResult>;
  listContext(): Promise<ContextEntry[]>;
  forgetContext(id: string, traceId: string): Promise<ContextResult>;
  createCase(input: PersonalCaseInput): Promise<{ status: "created" | "failed"; case?: PersonalCase; eventId?: string; traceId?: string; schemaVersion?: string; error?: string }>;
  addCaseEvent(input: CaseEventInput): Promise<{ status: "created" | "failed"; event?: CaseEvent; eventId?: string; traceId?: string; schemaVersion?: string; error?: string }>;
  listCaseEvents(caseId: string): Promise<CaseEvent[]>;
  listCases(): Promise<PersonalCase[]>;
}

export interface GuidanceInput { decision: string; context: string[]; options?: string[]; }
export interface GuidanceResult { recommendation: string; objection: string; uncertainties: string[]; nextSteps: string[]; externalActionExecuted: false; }
