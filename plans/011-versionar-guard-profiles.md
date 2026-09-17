# Plan 011: Versionar la protecció anti-auto-promoció de `profiles`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: consulta la BD en viu (via l'MCP de Supabase o
> `supabase db diff`) per confirmar que el trigger `trg_guard_profile_privileged_columns`
> i les policies llistades a "Current state" encara existeixen igual que
> quan es va escriure aquest pla (2026-09-17). Si no hi són, o difereixen,
> és una condició de STOP — no inventis la migració a partir de suposicions.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security (migration)
- **Planned at**: commit `6e28e51`, 2026-09-17

## Why this matters

`supabase/migrations/001_initial_schema.sql:63-65` defineix l'única policy versionada d'UPDATE sobre `profiles`: `USING (auth.uid() = id)`, **sense `WITH CHECK`**. Llegit tal com està al repo, qualsevol usuari autenticat podria fer `UPDATE profiles SET role='admin', active=true WHERE id=auth.uid()` i auto-promocionar-se a admin. En producció això **no passa** perquè hi ha un trigger (`trg_guard_profile_privileged_columns`) i dues policies addicionals que bloquegen el canvi de `role`/`active` tret que el caller ja sigui un admin actiu — però cap d'aquests tres objectes existeix a `supabase/migrations/`. Si algú restaura l'entorn només amb els fitxers versionats (un `supabase db reset`, un projecte nou, disaster recovery, CI), obtindria una BD amb un forat crític d'escalada de privilegis, sense cap avís. Aquest pla versiona exactament el que ja protegeix producció, i de pas neteja una policy duplicada més laxa que l'altra.

## Current state

**Migració existent, incompleta — `supabase/migrations/001_initial_schema.sql:63-65`**:
```sql
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
```

**El que realment protegeix producció (confirmat en viu via consulta SQL de només lectura a `wmnomhexggvrdvyznini`, `grep` a `supabase/migrations/` confirma 0 coincidències — no versionat enlloc):**

Trigger:
```sql
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_privileged_columns();
```

Funció:
```sql
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.active IS NOT DISTINCT FROM OLD.active THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin' AND p.active
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'No autoritzat a modificar role/active del perfil'
    USING ERRCODE = 'insufficient_privilege';
END;
$function$
```

Policies UPDATE actuals sobre `profiles` (consulta a `pg_policy`), **dues d'elles no versionades i una tercera duplicada/més laxa**:

| Policy | USING | WITH CHECK | Versionada? |
|---|---|---|---|
| `Users can update own profile` | `auth.uid() = id` | — | Sí (001) |
| `Admin pot actualitzar perfils` | `role='admin'` (sense `active`) | `true` | **No** — i és més laxa que la següent |
| `Admins can update any profile` | `role='admin' AND active` | — | **No** |

`Admin pot actualitzar perfils` i `Admins can update any profile` fan essencialment el mateix (permetre que un admin actualitzi qualsevol perfil), però la primera no exigeix `active` — és una duplicada obsoleta i més permissiva. Com que PostgreSQL fa `OR` entre policies permissives del mateix `cmd`, mentre existeixin totes dues, un admin *desactivat* podria seguir passant el filtre RLS (encara que el trigger seguiria bloquejant el canvi de `role`/`active` concret). Cal eliminar la duplicada.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Consultar BD en viu (read-only) | Eina MCP `execute_sql` amb `project_id=wmnomhexggvrdvyznini` | retorna les definicions de dalt |
| Verificar que la migració nova és vàlida sintàcticament | `supabase db lint` (si el CLI hi és) o revisió manual | sense errors de sintaxi |
| Comprovar que no hi ha cap altra migració `006_*` | `ls supabase/migrations/` | només fins a `005_*` abans d'aquest pla |

Aquest repo no té un entorn Supabase local (`supabase start`) configurat per l'executor en aquesta tasca — **no apliquis la migració contra producció**; només crea el fitxer. Aplicar-la a producció és una acció manual de l'operador (ja documentada, vegeu "Maintenance notes").

## Scope

**In scope**:
- `supabase/migrations/006_guard_profile_privileged_columns.sql` (crear)

**Out of scope** (no ho toquis):
- Qualsevol altra taula (`bookmarks`, `categories`, etc.) — ja versionades a 005.
- Aplicar la migració contra la BD de producció — és una acció manual de l'operador, no de l'executor.
- El codi client (`src/context/AuthContext.tsx`, `src/services/profiles.ts`) — no canvia, aquest pla és només SQL.

## Git workflow

- Branch: `advisor/011-guard-profiles-migration`
- Un commit: `fix(security): versionar la protecció anti-auto-promoció de perfils`
- No facis push ni PR sense instrucció explícita. **No apliquis la migració a la BD** (ni local ni remota) — només crea el fitxer.

## Steps

### Step 1: Crear la migració 006

Crea `supabase/migrations/006_guard_profile_privileged_columns.sql` amb aquest contingut (reprodueix exactament el trigger/funció en viu, i substitueix les dues policies UPDATE no versionades/duplicades per una sola):

```sql
-- Versiona la protecció que ja existeix en producció: sense això, un
-- `supabase db reset` recrearia una BD on qualsevol usuari autenticat es
-- podria auto-promocionar a admin via `UPDATE profiles SET role='admin', active=true`.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.active IS NOT DISTINCT FROM OLD.active THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin' AND p.active
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'No autoritzat a modificar role/active del perfil'
    USING ERRCODE = 'insufficient_privilege';
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- Elimina la policy duplicada i més laxa (sense comprovació `active`);
-- manté només la versió que ja exigeix `active` com les altres policies
-- d'aquest projecte (veure 005_enforce_active_on_writes.sql).
DROP POLICY IF EXISTS "Admin pot actualitzar perfils" ON public.profiles;

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin' AND p.active)
  );
```

**Verify**: `ls supabase/migrations/006_guard_profile_privileged_columns.sql` → existeix. Revisió manual de sintaxi (balanceig de `$function$`, punt i coma finals).

### Step 2: Confirmar que no s'ha tocat cap altra cosa

**Verify**: `git status --short` → només mostra el fitxer nou de la migració.

## Test plan

No hi ha test automatitzat de policies RLS en aquest repo. Verificació manual per a l'operador (documenta-la a `plans/README.md` o al missatge de PR, no l'executis tu):

1. Contra un projecte Supabase de prova (mai producció): `supabase db reset` amb aquesta migració inclosa.
2. Com a usuari autenticat no-admin, intentar `UPDATE profiles SET role='admin' WHERE id=auth.uid()` → ha de fallar amb `insufficient_privilege`.
3. Com a admin actiu, actualitzar el `role`/`active` d'un altre perfil → ha de funcionar.
4. Com a admin amb `active=false`, intentar el mateix → ha de fallar (ni la policy ni el trigger l'hi deixen).

## Done criteria

- [ ] `supabase/migrations/006_guard_profile_privileged_columns.sql` existeix i conté el trigger, la funció i la policy consolidada
- [ ] `grep -rn "Admin pot actualitzar perfils" supabase/migrations/` només apareix dins un `DROP POLICY IF EXISTS` (no torna a crear-se)
- [ ] Cap altre fitxer modificat (`git status`)
- [ ] La migració **no s'ha aplicat** a cap BD (ni local ni remota) — només creada
- [ ] `plans/README.md` actualitzat amb aquest pla i el seu estat, amb una nota clara que l'aplicació a producció és manual

## STOP conditions

Atura't i informa (no improvisis) si:
- La consulta a la BD en viu retorna una definició del trigger/funció diferent de la de "Current state" (algú l'ha modificat des que es va escriure aquest pla).
- Existeix ja un fitxer `006_*.md` amb un altre propòsit — renumera seguint la convenció d'aquest repo (vegeu la nota de `plans/README.md` sobre numeració monòtona de migracions).
- No tens accés a la BD en viu per confirmar el drift check — informa-ho i demana confirmació abans de crear la migració a cegues.

## Maintenance notes

- **Acció manual obligatòria de l'operador després del merge**: aplicar aquesta migració contra producció amb `supabase db push` (o el flux que l'operador ja usa — vegeu `deploy-manual-steps.md`). Com que el trigger i les policies **ja existeixen** en viu de forma idèntica, aplicar-la hauria de ser un no-op (el `CREATE OR REPLACE`/`DROP POLICY IF EXISTS ... CREATE POLICY` són idempotents); si `supabase db push` reporta canvis inesperats, atura't i revisa abans de continuar.
- Si en el futur s'afegeix una altra columna privilegiada a `profiles` (p. ex. un futur camp de permisos granulars), ha d'entrar dins la comprovació `IF NEW.x IS NOT DISTINCT FROM OLD.x` d'aquesta funció, no en una policy nova separada.
