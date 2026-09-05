# AGENTS.md — SARA Personal (hilos Codex)

## Propósito

Este archivo es la puerta de entrada para que cualquier hilo Codex abierto sobre
`C:\Users\Fito\Documents\CODEX\SARA` sepa cómo enrutar órdenes personales de
Fito hacia el almacén local privado de SARA Personal.

## Alcance local

- Todo SARA Personal vive en este checkout, bajo `data/personal/`.
- No usa Supabase, WhatsApp, Chatwoot, VPS ni red.
- No se modifican otros proyectos (BARBEROX, SPORTEX, DELTA, etc.).
- No se guardan contraseñas, PIN, tokens, MFA, secretos ni material de recuperación.

## ¿Qué enrutar aquí?

Una declaración inequívoca de gasto o una orden explícita de recordar, olvidar o
gestionar un caso personal:

| Intención de Fito | Ejemplo | Acción CLI |
|---|---|---|
| Registrar gasto | "gasté UYU 1.200,50 en supermercado personal" | `expense.create` |
| Listar gastos | "mostrá los gastos personales" | `expense.list` |
| Corregir gasto | "cambiá el gasto X a UYU 300" | `expense.update` |
| Reclasificar gasto | "ese gasto es de DELTA" | `expense.reclassify` |
| Recordar algo durable | "guardá que prioridad es focus" | `context.save` |
| Listar contexto | "qué tengo guardado" | `context.list` |
| Corregir contexto | "cambiá prioridad a descansar" | `context.correct` |
| Olvidar algo guardado | "olvidá el dato de prioridad" | `context.forget` |
| Abrir caso | "abrir caso SimpleBox" | `case.create` |
| Listar casos | "mostrá los casos abiertos" | `case.list` |
| Ver eventos de caso | "qué eventos tiene SimpleBox" | `case.events` |
| Agregar evento a caso | "en SimpleBox anotar pedir documento" | `case.event` |
| Resumen | "resumen personal" | `summary` |

## Cómo invocar la CLI

Desde la raíz del proyecto:

```bash
node scripts/sara-personal.mjs '{"action":"expense.create","payload":{"text":"gasto personal UYU 200 cafe","traceId":"t1"}}'
```

O por stdin:

```bash
echo '{"action":"context.save","payload":{"key":"prioridad","value":"focus","kind":"durable","source":"manual","traceId":"t2"}}' | node scripts/sara-personal.mjs
```

La CLI siempre responde JSON con `ok`, `action`, `id` (cuando aplica) y
`persisted`. Si `ok` es `false`, incluye `error`.

## Reglas de protección de datos

1. `recordá` / `guardá` / `tené en cuenta` → persiste solo contexto **durable no
   sensible**.
2. Contexto **sensible** (finanzas exactas, salud, familia, documentos, etc.)
   requiere explicar qué se guardará y obtener consentimiento explícito
   (`consent: true`).
3. Datos **forbidden** (contraseñas, PIN, tokens, MFA, secretos, recuperación)
   se rechazan antes de tocar disco, log o respuesta.
4. Contexto **ephemeral** se usa solo en el turno actual y no se persiste.
5. `olvidá` elimina el valor y deja solo auditoría no reveladora.
6. Todo gasto **BUSINESS** requiere empresa (DELTA, BARBEROX, etc.); la
   ambigüedad se aclara sin escribir.

## Archivos relevantes

- `scripts/sara-personal.mjs` — CLI JSON.
- `src/modules/personalAssistant/personalAssistantParser.ts` — parser de gastos.
- `src/modules/personalAssistant/personalAssistantModule.ts` — reglas de dominio.
- `src/infra/personalAssistantFileStore.ts` — repositorio local atómico con lock
  y journal.
- `data/personal/` — datos personales reales (ignorados por Git).
- `docs/PERSONAL/CODEX_THREADS.md` — documentación detallada para hilos Codex.
- `docs/PERSONAL/PERSONAL_CONTEXT_POLICY.md` — política de contexto personal.

## Qué NO hacer

- No invocar la CLI para conversación casual no accionable.
- No inferir que toda conversación debe persistirse.
- No modificar archivos dentro de `data/personal/` a mano salvo para
  recuperación controlada.
- No commitear datos reales: `data/personal/` está en `.gitignore`.
