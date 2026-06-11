# Plan 002: Versionar `supabase/config.toml` amb `verify_jwt` explícit per funció

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- supabase/`
> If `supabase/config.toml` now exists or any function changed since this plan
> was written, compare against "Current state" before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / dx
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

No existeix cap `supabase/config.toml` versionat. Sense aquest fitxer, la verificació de JWT a nivell de plataforma (la barrera de Supabase abans que la teva funció s'executi) depèn de l'estat per-funció del dashboard, que no és reproduïble ni revisable a git. Versionar la configuració fixa el comportament esperat: les 4 funcions administratives han d'exigir un JWT vàlid a la plataforma, i `suggest-resource` també (ja valida el JWT al codi). Això documenta la intenció de seguretat i evita que un desplegament futur deixi accidentalment una funció amb `verify_jwt = false`.

## Current state

- `supabase/config.toml` — **no existeix**. (`ls supabase/config.toml` → error.)
- Funcions existents (cadascuna ja valida `Authorization` al codi, però la barrera de plataforma no està versionada):
  - `supabase/functions/create-editor/index.ts`
  - `supabase/functions/delete-editor/index.ts`
  - `supabase/functions/change-user-password/index.ts`
  - `supabase/functions/handle-editor-request/index.ts`
  - `supabase/functions/suggest-resource/index.ts`
- `supabase/.temp/project-ref` conté la referència del projecte enllaçat (ja al repo).

**Important sobre el format**: el format de `config.toml` depèn de la versió de la Supabase CLI. La forma estàndard per fixar verificació JWT per funció és:

```toml
[functions.<nom-funcio>]
verify_jwt = true
```

Si el repo usa una versió de CLI on cal `enabled`/`entrypoint`, afegeix-los també. Consulta `supabase --version` (si la CLI està disponible) i la documentació oficial de Supabase CLI per al format exacte de la teva versió abans d'escriure el fitxer.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Confirmar que no existeix | `ls supabase/config.toml` | error "No such file" (abans de crear-lo) |
| Versió CLI (si disponible) | `supabase --version` | un número de versió, o "command not found" |
| Validar config (si CLI disponible) | `supabase config show` o `supabase functions list` | sense errors de parseig |

## Scope

**In scope** (crear):
- `supabase/config.toml`

**Out of scope** (NO tocar):
- Cap fitxer dins `supabase/functions/` — aquest pla només afegeix configuració versionada, no canvia codi.
- `supabase/.temp/` — fitxers generats per la CLI; no editar.
- Les migracions SQL.

## Git workflow

- Branch: `advisor/002-config-toml-verify-jwt`
- Un sol commit: `chore(security): versionar config.toml amb verify_jwt per funció`
- No facis push ni PR si no t'ho han demanat.

## Steps

### Step 1: Determinar el format correcte per a la versió de CLI

Executa `supabase --version`. Si la CLI no està instal·lada, usa el format estàndard documentat (bloc `[functions.<nom>]` amb `verify_jwt = true`) i deixa una nota al PR que el format s'ha de validar contra la versió de CLI que usa l'operador.

**Verify**: tens clar el format a escriure (de la sortida de `--version` + docs, o del format estàndard documentat).

### Step 2: Crear `supabase/config.toml`

Crea el fitxer amb un bloc `[functions.<nom>]` per a cadascuna de les 5 funcions, totes amb `verify_jwt = true`. Inclou la línia `project_id` apuntant al ref del projecte (llegeix-lo de `supabase/.temp/project-ref` si la CLI ho requereix; si no, omet-la — `supabase link` la gestiona).

Estructura objectiu (ajusta al format de la teva versió de CLI):

```toml
project_id = "<contingut de supabase/.temp/project-ref>"

[functions.create-editor]
verify_jwt = true

[functions.delete-editor]
verify_jwt = true

[functions.change-user-password]
verify_jwt = true

[functions.handle-editor-request]
verify_jwt = true

[functions.suggest-resource]
verify_jwt = true
```

**Verify**: `grep -c "verify_jwt = true" supabase/config.toml` → `5`. I `grep -c "verify_jwt = false" supabase/config.toml` → `0`.

### Step 3: Validar el parseig (si la CLI està disponible)

Si `supabase` està instal·lat: `supabase config show` (o el comando equivalent de la teva versió) ha de parsejar el fitxer sense error. Si no està disponible, salta aquest pas i nota-ho al PR.

**Verify**: comando de validació surt 0, o pas saltat amb nota explícita.

## Test plan

No hi ha tests automatitzats. Verificació funcional (operador, al desplegar):

- Després de `supabase functions deploy`, una crida HTTP directa a qualsevol funció administrativa **sense** capçalera `Authorization` ha de ser rebutjada per la plataforma (401) abans d'arribar al codi.

## Done criteria

ALL must hold:

- [ ] `supabase/config.toml` existeix
- [ ] `grep -c "verify_jwt = true" supabase/config.toml` retorna `5`
- [ ] `grep -c "verify_jwt = false" supabase/config.toml` retorna `0`
- [ ] `git status --porcelain` mostra només `supabase/config.toml` afegit
- [ ] Fila d'estat de 002 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- `supabase/config.toml` **ja existeix** quan fas el drift check (revisa'l: si ja té `verify_jwt` per a totes les funcions, marca aquest pla com a ja resolt; si en falta alguna, només afegeix les que falten).
- La versió de CLI requereix camps obligatoris que no pots determinar amb certesa (p. ex. `entrypoint` amb una ruta concreta) — reporta el format requerit en lloc d'endevinar-lo.
- `suggest-resource` resulta necessitar accés anònim per disseny (no és el cas actual: el seu codi ja exigeix JWT a `suggest-resource/index.ts:61-67`, però confirma-ho abans de posar `verify_jwt = true`).

## Maintenance notes

- Cada Edge Function nova ha d'afegir el seu bloc `[functions.<nom>]` aquí amb `verify_jwt` explícit.
- En revisió del PR: confirmar que cap funció queda amb `verify_jwt = false`. La validació del JWT al codi (dins de cada `index.ts`) és la segona capa; aquesta config és la primera.
- Si en el futur s'afegeix una funció pública (webhook entrant, etc.), serà l'única excepció legítima a `verify_jwt = true`, i ha de validar la signatura del webhook pel seu compte.
