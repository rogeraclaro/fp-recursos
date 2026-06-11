# Plan 001: Unificar el nom del secret de service-role a totes les Edge Functions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- supabase/functions/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / dx
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

Tres Edge Functions llegeixen la clau de service-role amb `Deno.env.get('SERVICE_ROLE_KEY')` mentre una quarta usa `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`. `SUPABASE_SERVICE_ROLE_KEY` és el nom **reservat estàndard de Supabase**, sempre disponible a l'entorn de les funcions sense configurar res. `SERVICE_ROLE_KEY` és un secret personalitzat que algú ha d'haver definit manualment; si en algun desplegament futur no existeix, les funcions `create-editor`, `delete-editor` i `change-user-password` fallaran en runtime amb un client construït amb una clau `undefined` (el `!` de TypeScript silencia el problema en compilació). Unificar el nom elimina aquest punt de fallada silenciosa i fa que les quatre funcions depenguin del secret garantit per plataforma.

## Current state

Les funcions afectades i la línia exacta on llegeixen la clau:

- `supabase/functions/create-editor/index.ts:58`
  ```ts
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SERVICE_ROLE_KEY')!
      )
  ```
- `supabase/functions/delete-editor/index.ts:69`
  ```ts
        Deno.env.get('SERVICE_ROLE_KEY')!
  ```
- `supabase/functions/change-user-password/index.ts:56`
  ```ts
        Deno.env.get('SERVICE_ROLE_KEY')!
  ```

La que ja usa el nom correcte (referència del patró desitjat) — **no la toquis**:

- `supabase/functions/handle-editor-request/index.ts:55`
  ```ts
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
  ```

`SUPABASE_SERVICE_ROLE_KEY` és un secret injectat automàticament per Supabase a totes les Edge Functions; no cal afegir-lo manualment.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Cap match antic | `grep -rn "SERVICE_ROLE_KEY" supabase/functions/` | només línies amb `SUPABASE_SERVICE_ROLE_KEY` |
| Estat git | `git status --porcelain` | només els 3 fitxers en scope |

(No hi ha `deno` instal·lat al repo per defecte; la verificació és per `grep`. El desplegament real el fa l'operador amb `supabase functions deploy`.)

## Scope

**In scope** (els únics fitxers que pots modificar):
- `supabase/functions/create-editor/index.ts`
- `supabase/functions/delete-editor/index.ts`
- `supabase/functions/change-user-password/index.ts`

**Out of scope** (NO tocar):
- `supabase/functions/handle-editor-request/index.ts` — ja usa el nom correcte.
- `supabase/functions/suggest-resource/index.ts` — no usa service-role.
- Qualsevol fitxer fora de `supabase/functions/`.

## Git workflow

- Branch: `advisor/001-unificar-secret-service-role`
- Un sol commit. Estil de missatge (conventional commits, com al repo): `fix(security): unificar nom secret service-role a SUPABASE_SERVICE_ROLE_KEY`
- No facis push ni obris PR si l'operador no t'ho ha demanat.

## Steps

### Step 1: Reemplaçar el nom a les 3 funcions

A cada un dels 3 fitxers en scope, substitueix `Deno.env.get('SERVICE_ROLE_KEY')` per `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`. És un canvi de string idèntic a cada lloc; mantén el `!` i la resta de la línia exactament igual.

**Verify**: `grep -rn "Deno.env.get('SERVICE_ROLE_KEY')" supabase/functions/` → cap resultat (exit 1).

### Step 2: Confirmar que totes usen el nom unificat

**Verify**: `grep -rn "SERVICE_ROLE_KEY" supabase/functions/` → totes les línies contenen `SUPABASE_SERVICE_ROLE_KEY` (4 funcions: create-editor, delete-editor, change-user-password, handle-editor-request).

## Test plan

No hi ha tests automatitzats per a Edge Functions en aquest repo. Verificació funcional manual (responsabilitat de l'operador, documenta-la al PR):

- Després de desplegar, des de la UI d'admin: crear un editor, eliminar-lo, i canviar-li la contrasenya — totes tres han de funcionar.
- `supabase secrets list` ha de mostrar que `SUPABASE_SERVICE_ROLE_KEY` està disponible (és automàtic). El secret personalitzat `SERVICE_ROLE_KEY` ja no és necessari i es pot eliminar després de verificar.

## Done criteria

ALL must hold:

- [ ] `grep -rn "Deno.env.get('SERVICE_ROLE_KEY')" supabase/functions/` retorna 0 matches
- [ ] `grep -rln "SUPABASE_SERVICE_ROLE_KEY" supabase/functions/` llista 4 fitxers
- [ ] `git status --porcelain` mostra només els 3 fitxers en scope modificats
- [ ] Fila d'estat de 001 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- El codi a les línies de "Current state" no coincideix amb els excerpts (deriva del codebase).
- Trobes una quarta funció que també usa `SERVICE_ROLE_KEY` no llistada aquí (investiga abans de canviar).
- Descobreixes que `SERVICE_ROLE_KEY` apunta a una clau **diferent** de `SUPABASE_SERVICE_ROLE_KEY` (p. ex. una clau de projecte diferent) — en aquest cas la unificació podria canviar el comportament.

## Maintenance notes

- Qualsevol Edge Function nova ha d'usar `SUPABASE_SERVICE_ROLE_KEY` (no inventar nous noms de secret).
- En revisió del PR: comprovar que no s'ha tocat `handle-editor-request` i que el `!` es manté (no introduir comprovacions de null fora d'scope).
- Follow-up diferit: eliminar el secret personalitzat `SERVICE_ROLE_KEY` de Supabase un cop verificat el deploy (acció de dashboard, no de codi).
