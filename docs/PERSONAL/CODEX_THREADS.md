# SARA Personal — Guía para hilos Codex

## Alcance

SARA Personal es la cara local y privada del asistente para Fito. Funciona
únicamente dentro del checkout de `C:\Users\Fito\Documents\CODEX\SARA` y
persiste en archivos bajo `data/personal/`.

No requiere ni utiliza:

- Supabase, Postgres, migraciones remotas.
- WhatsApp, Chatwoot, Telegram, email ni ningún servicio de mensajería.
- VPS, Docker, Traefik, deploy ni red.
- Otros proyectos o repos (BARBEROX, SPORTEX, DELTA, etc.).

## Cuándo actuar

Actuar solo ante una intención explícita de Fito:

1. **Gasto**: "gasté", "pagué", "anotame un gasto".
2. **Recordar**: "recordá", "guardá", "tené en cuenta".
3. **Olvidar**: "olvidá", "borrá", "eliminá el dato".
4. **Caso personal**: "abrir caso", "en X anotar ...", "caso X".
5. **Resumen**: "resumen personal", "qué tengo en SARA Personal".

La conversación casual, preguntas generales o reflexiones sin orden explícita se
manejan de forma efímera: no se invoca la CLI.

## Contrato de entrada/salida de la CLI

La CLI lee un único JSON y responde un único JSON.

### Entrada

```json
{
  "action": "expense.create | context.save | context.forget | case.create | case.event | summary",
  "payload": { ... }
}
```

### Salida

Toda mutación devuelve:

```json
{
  "ok": true,
  "action": "expense.create",
  "id": "uuid-del-recurso",
  "persisted": true,
  ...
}
```

Si falla:

```json
{
  "ok": false,
  "action": "expense.create",
  "persisted": false,
  "error": "missing data: currency"
}
```

### Acciones

#### `expense.create`

El payload puede contener:

- `text`: texto libre que será parseado; o
- campos explícitos: `scope`, `amount`, `currency`, `concept`, `entity`,
  `source`, `traceId`.

```bash
node scripts/sara-personal.mjs '{"action":"expense.create","payload":{"text":"gasto personal UYU 1.200,50 supermercado","traceId":"t1"}}'
```

Reglas:

- `PERSONAL` no requiere empresa.
- `BUSINESS` requiere empresa explícita (`DELTA`, `BARBEROX`, etc.).
- `$` solo es ambiguo: si no hay moneda explícita, se pide aclaración sin
  escribir nada.

#### `context.save`

```json
{
  "action": "context.save",
  "payload": {
    "key": "prioridad",
    "value": "focus",
    "kind": "durable",
    "source": "manual",
    "traceId": "t2"
  }
}
```

Valores de `kind`:

- `durable`: se persiste sin consentimiento explícito, siempre que no sea
  forbidden.
- `sensitive`: requiere `consent: true` y una explicación previa a Fito.
- `ephemeral`: no se persiste.
- `forbidden`: se rechaza antes de tocar disco.

#### `context.forget`

```json
{
  "action": "context.forget",
  "payload": { "id": "uuid-de-la-entrada", "traceId": "t3" }
}
```

Elimina el valor del estado y deja en el journal solo una marca redacted con la
clave y el tipo.

#### `case.create`

```json
{
  "action": "case.create",
  "payload": { "name": "SimpleBox", "description": "...", "traceId": "t4" }
}
```

#### `case.event`

```json
{
  "action": "case.event",
  "payload": {
    "caseId": "uuid-del-caso",
    "type": "note | pending | reference | status",
    "content": "pedir documento",
    "traceId": "t5"
  }
}
```

#### `summary`

```bash
echo '{"action":"summary"}' | node scripts/sara-personal.mjs
```

Devuelve conteos de gastos, entradas de contexto, casos y eventos.

## Reglas de protección de datos personales

1. **Forbidden**: nunca persistir contraseñas, PIN, tokens, MFA, secretos ni
   material de recuperación. El rechazo ocurre antes de escribir archivo,
   journal o respuesta.
2. **Sensible**: finanzas exactas, salud, familia, documentos e información
   íntima requieren explicar qué se guardará, para qué sirve y obtener
   `consent: true`.
3. **Durable**: preferencias, prioridades, formas de trabajo y otros datos no
   sensibles que ayuden a decidir mejor.
4. **Ephemeral**: contexto del turno actual, no se persiste.

## Implementación local

- `src/infra/personalAssistantFileStore.ts` mantiene el estado en
  `data/personal/state.json` y un journal append-only en
  `data/personal/journal.jsonl`.
- Cada mutación adquiere un lock multiproceso (`data/personal/lock/`), escribe
  el journal, actualiza el estado de forma atómica (archivo temporal + rename) y
  libera el lock.
- Los datos reales nunca se commitean: `data/personal/` está en `.gitignore`.

## Qué NO hacer

- No conectar este módulo a Supabase, Chatwoot ni a ningún otro sistema.
- No modificar `package.json`.
- No crear tablas, migraciones ni RPCs.
- No inferir intenciones de persistencia.
- No guardar datos forbidden bajo ninguna excusa.
- No exponer datos personales en logs o respuestas sin necesidad.
