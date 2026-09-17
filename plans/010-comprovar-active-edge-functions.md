# Plan 010: Rebutjar crides d'admins/editors desactivats a les Edge Functions privilegiades

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e28e51..HEAD -- supabase/functions/create-editor supabase/functions/delete-editor supabase/functions/change-user-password supabase/functions/handle-editor-request`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (authz)
- **Planned at**: commit `6e28e51`, 2026-09-17

## Why this matters

El pla 007 (ja aplicat) va fer que desactivar un editor/admin (`profiles.active = false`) l'expulsi al login i li bloquegi l'escriptura via RLS a `bookmarks`/`categories`. Però 4 Edge Functions que fan servir la `service_role` key (que **bypassa RLS**) només comproven `callerProfile?.role === 'admin'` i mai `active`: `create-editor`, `delete-editor`, `change-user-password`, `handle-editor-request`. Un admin desactivat pot seguir invocant aquestes funcions mentre el seu JWT sigui vàlid (fins que expiri o es refresqui), i des d'aquí crear editors nous, esborrar-ne, canviar la contrasenya de qualsevol usuari (inclòs un altre admin) o aprovar/rebutjar sol·licituds — és a dir, conserva capacitat d'admin completa malgrat estar "desactivat". Aquest pla tanca el forat afegint la mateixa comprovació `active` que ja existeix a les policies RLS de 005, ara al caller d'aquestes 4 funcions.

## Current state

Les 4 funcions comparteixen literalment el mateix patró (verificat als 4 fitxers sencers):

**`supabase/functions/create-editor/index.ts:37-46`**
```ts
    const { data: callerProfile } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Només els administradors poden crear editors' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
```

**`supabase/functions/delete-editor/index.ts:36-45`** — mateix patró, missatge `'Només els administradors poden eliminar editors'`.

**`supabase/functions/change-user-password/index.ts:36-45`** — mateix patró, missatge `'Només els administradors poden canviar contrasenyes'`.

**`supabase/functions/handle-editor-request/index.ts:48-57`** — mateix patró, missatge `'Forbidden'`, status 403 (aquesta gestiona `action: 'approve' | 'reactivate' | 'reject'`; el check és sobre el *caller* (l'admin que truca), no sobre l'usuari objectiu — no toquis la lògica de `reactivate`, que legítimament actua sobre un usuari amb `active=false`).

Conveni existent a aplicar (ja usat a `supabase/migrations/005_enforce_active_on_writes.sql`): comprovar `active` juntament amb `role`, no substituir-lo.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|-----------------------------------|---------------------|
| Typecheck (frontend, no cobreix Edge Functions Deno) | `npx tsc -b` | exit 0 |
| Grep de verificació | `grep -rn "callerProfile?.role !== 'admin'" supabase/functions/` | ha de tornar 0 resultats en acabar |
| Desplegar (acció manual de l'operador, NO ho facis tu) | `supabase functions deploy <nom>` | — |

No hi ha manera de testejar Edge Functions Deno localment sense el CLI de Supabase amb `supabase start`; la verificació d'aquest pla és per lectura de codi + grep, no per execució.

## Scope

**In scope** (els únics fitxers a modificar):
- `supabase/functions/create-editor/index.ts`
- `supabase/functions/delete-editor/index.ts`
- `supabase/functions/change-user-password/index.ts`
- `supabase/functions/handle-editor-request/index.ts`

**Out of scope** (no toquis, encara que sembli relacionat):
- `supabase/functions/suggest-resource/index.ts` — no és una funció privilegiada d'admin, no aplica.
- La lògica de `action === 'reactivate'` dins `handle-editor-request/index.ts` (les línies que criden `getUserById`/`generateLink`/Resend per l'usuari objectiu) — actua legítimament sobre un usuari amb `active=false`; només toca el check del *caller*.
- Qualsevol migració SQL — aquest pla és només de les Edge Functions, no de RLS.

## Git workflow

- Branch: `advisor/010-active-edge-functions`
- Un commit per funció o un sol commit agrupant els 4 (a criteri de l'executor, seguint l'estil del repo). Missatge: `fix(authz): rebutjar admins desactivats a les Edge Functions privilegiades` (conventional commits, català, com a `git log` — p. ex. `e1abbbe fix(authz): expulsar editors desactivats al login`).
- No facis push ni PR sense instrucció explícita.

## Steps

### Step 1: `create-editor`

Canvia la selecció i el check a `supabase/functions/create-editor/index.ts:37-46`:

```ts
    const { data: callerProfile } = await supabaseUser
      .from('profiles')
      .select('role, active')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin' || callerProfile?.active === false) {
      return new Response(JSON.stringify({ error: 'Només els administradors actius poden crear editors' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
```

**Verify**: `grep -n "select('role, active')" supabase/functions/create-editor/index.ts` → 1 resultat.

### Step 2: `delete-editor`

Mateix canvi a `supabase/functions/delete-editor/index.ts:36-45`, missatge `'Només els administradors actius poden eliminar editors'`. No toquis el check posterior (`targetProfile?.role === 'admin'`, línies ~53-59) que impedeix esborrar un altre admin — és una regla diferent, correcta com està.

**Verify**: `grep -n "select('role, active')" supabase/functions/delete-editor/index.ts` → 1 resultat.

### Step 3: `change-user-password`

Mateix canvi a `supabase/functions/change-user-password/index.ts:36-45`, missatge `'Només els administradors actius poden canviar contrasenyes'`.

**Verify**: `grep -n "select('role, active')" supabase/functions/change-user-password/index.ts` → 1 resultat.

### Step 4: `handle-editor-request`

Mateix canvi a `supabase/functions/handle-editor-request/index.ts:48-57`, missatge `'Forbidden'` (manté el mateix missatge que ja hi és, no cal canviar-lo — aquesta funció no exposa detall com les altres 3). No toquis res després d'aquest bloc.

**Verify**: `grep -n "select('role, active')" supabase/functions/handle-editor-request/index.ts` → 1 resultat.

### Step 5: Verificació global

**Verify**: `grep -rn "callerProfile?.role !== 'admin'" supabase/functions/` → 0 resultats (totes les ocurrències han passat a comprovar `active` també).

**Verify**: `npx tsc -b` → exit 0 (les Edge Functions Deno no entren al `tsconfig` del frontend, així que això només confirma que no has tocat per error cap fitxer TS del frontend).

## Test plan

No hi ha framework de test per a Edge Functions Deno en aquest repo (no hi ha `supabase/functions/*/index.test.ts`, i no es pot desplegar en revisió). Verificació manual documentada per a l'operador, no per l'executor:

1. Desactivar un compte admin/editor de prova (`profiles.active = false`).
2. Amb el JWT d'aquest compte encara vàlid (abans que expiri la sessió), invocar cadascuna de les 4 funcions.
3. Confirmar 403 amb el nou missatge en totes.

No afegeixis tests automatitzats en aquest pla — és fora d'abast (el finding de cobertura de tests té el seu propi pla separat).

## Done criteria

- [ ] `grep -rn "callerProfile?.role !== 'admin'" supabase/functions/` retorna 0 resultats
- [ ] Les 4 funcions seleccionen `'role, active'` i comproven `callerProfile?.active === false` a més del rol
- [ ] `npx tsc -b` surt amb exit 0
- [ ] Cap fitxer fora de l'abast s'ha modificat (`git status`)
- [ ] `plans/README.md` actualitzat amb aquest pla i el seu estat

## STOP conditions

Atura't i informa (no improvisis) si:
- El codi actual de qualsevol dels 4 fitxers no coincideix amb els excerpts de "Current state" (ha canviat des que es va escriure aquest pla).
- Trobes una cinquena Edge Function amb el mateix patró de check que no estigui llistada aquí — informa-ho, no la toquis sense confirmació.
- La comprovació `active` sembla ja existir en algun dels 4 fitxers (contradiria l'auditoria) — atura't i verifica abans de "corregir" res.

## Maintenance notes

- Si en el futur s'afegeix una cinquena Edge Function privilegiada (usa `service_role`), ha de portar aquest mateix check `role === 'admin' && active !== false` des del primer dia.
- El pla considerat (no seleccionat encara) d'extreure aquest bloc a `supabase/functions/_shared/auth.ts` (finding TECH-01 de l'auditoria) eliminaria aquesta duplicació de soca-rel; aquest pla no ho fa perquè és un canvi més gran (M) i no bloqueja el fix de seguretat, que és urgent i S.
- Cap acció manual de l'operador més enllà de `supabase functions deploy <cada-funció>` després del merge.
