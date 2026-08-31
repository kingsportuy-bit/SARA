# data/personal — Datos personales de Fito

Este directorio contiene los datos reales de SARA Personal:

- `state.json` — estado actual (gastos, contexto, casos, eventos).
- `journal.jsonl` — journal append-only de auditoría.
- `lock/` — lock multiproceso (se crea y elimina en cada operación).

## Importante

- **No commitear** archivos de este directorio. Están en `.gitignore`.
- **No editar a mano** salvo en una recuperación controlada.
- La interfaz soportada es la CLI: `scripts/sara-personal.mjs`.
- No contiene contraseñas, PIN, tokens, MFA, secretos ni material de recuperación.
