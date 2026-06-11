# Plan 007: Fer que la desactivació d'un editor s'apliqui realment (login + RLS)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- src/context/AuthContext.tsx supabase/migrations/`
> If any in-scope file changed since this plan was written, compare against the
> "Current state" excerpts before proceeding; on a mismatch, treat it as a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug / security (authz)
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

L'app té un flux per "desactivar" un editor (`AdminView` → `setUserActive(id, false)`, que posa `profiles.active = false`). Però la desactivació és purament cosmètica: enlloc es bloqueja l'accés d'un editor desactivat. En concret (1) `AuthContext` no comprova `active` en carregar la sessió, així que un editor desactivat segueix iniciant sessió amb normalitat, i (2) les polítiques RLS de `bookmarks` i `categories` només comproven `auth.uid() = user_id` o el rol, **mai** `active`, així que un editor desactivat conserva permís per crear/editar/esborrar els seus recursos i gestionar categories. La desactivació, doncs, no revoca res. Aquest pla la fa efectiva a les dues capes: expulsió al login (UX immediata) i denegació a RLS (la barrera real).

## Current state

**Capa client — `src/context/AuthContext.tsx:44-52`** carrega el perfil sense mirar `active`:
```tsx
  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }
```
`Profile` (a `src/types/database.ts:1-7`) inclou `active: boolean`.

**Acció de desactivació — `src/pages/AdminView.tsx:45-52`** (referència, NO la toques):
```tsx
  async function handleToggleActive(id: string, active: boolean) {
    try {
      await setUserActive(id, active)
      ...
```

**Capa servidor — `supabase/migrations/001_initial_schema.sql:85-102`**, polítiques d'escriptura de `bookmarks` (cap comprova `active`):
```sql
create policy "Editors can insert own bookmarks"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

create policy "Editors can update own bookmarks"
  on public.bookmarks for update
  using (auth.uid() = user_id);

create policy "Editors can delete own bookmarks"
  on public.bookmarks for delete
  using (auth.uid() = user_id);
```
I la de categories (`001:74-79`):
```sql
create policy "Admins can manage categories"
  on public.categories for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));
```

**Important sobre RLS no versionada:** les taules `messages`, `editor_highlights`, `editor_requests`, `contact_requests` s'usen però les seves polítiques **no estan a cap migració** (es van crear al dashboard). Aquest pla **només** endureix les polítiques versionades i verificables (`bookmarks`, `categories`). Veure STOP conditions per a la resta.

**Stack:** React 19 + Vite + npm. Typecheck: `npx tsc -b`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b` | exit 0 |
| Build | `npm run build` | exit 0 |
| Check client | `grep -n "active" src/context/AuthContext.tsx` | ≥1 match nou |
| Check migració | `grep -c "active" supabase/migrations/005_enforce_active_on_writes.sql` | ≥4 |

## Scope

**In scope** (modificar/crear):
- `src/context/AuthContext.tsx` — expulsar usuaris amb `active = false` al carregar el perfil.
- `supabase/migrations/005_enforce_active_on_writes.sql` — **crear**: endurir les polítiques d'escriptura de `bookmarks` i `categories` perquè exigeixin que el perfil del caller estigui actiu.

**Out of scope** (NO tocar):
- `supabase/migrations/001_initial_schema.sql` — migració aplicada, immutable; els canvis van a 005.
- `src/pages/AdminView.tsx`, `src/services/profiles.ts` — el flux de desactivació ja funciona; només cal que tingui efecte.
- Les polítiques RLS de `messages`/`editor_highlights`/etc. — no versionades; fora d'abast (veure STOP).

## Git workflow

- Branch: `advisor/007-aplicar-desactivacio`
- Dos commits: un per al client, un per a la migració. Estil: `fix(authz): expulsar editors desactivats al login` / `fix(authz): exigir perfil actiu a les polítiques d'escriptura RLS`
- No push ni PR sense instrucció.

## Steps

### Step 1: Expulsar usuaris desactivats a `AuthContext`

A `src/context/AuthContext.tsx`, dins `loadProfile`, després d'obtenir `data` i abans de `setProfile(data)`, afegeix: si el perfil existeix i `active === false`, tanca la sessió i no el deixis entrar.

Forma objectiu:
```tsx
  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data && data.active === false) {
      await supabase.auth.signOut()
      setProfile(null)
      setUser(null)
      setSession(null)
      setLoading(false)
      return
    }

    setProfile(data)
    setLoading(false)
  }
```

**Verify**: `grep -n "active === false" src/context/AuthContext.tsx` → 1 match. `npx tsc -b` → exit 0.

### Step 2: Crear la migració que endureix RLS

Crea `supabase/migrations/005_enforce_active_on_writes.sql`. Per a cada política d'escriptura existent, fes `DROP POLICY IF EXISTS` (amb el nom exacte de 001) i recrea-la afegint la condició que el perfil del caller estigui actiu. Un helper a la condició: `EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active)`.

```sql
-- Exigeix que el perfil del caller estigui actiu per escriure.
-- Sense això, profiles.active = false no revoca cap permís (era cosmètic).

-- bookmarks: insert
DROP POLICY IF EXISTS "Editors can insert own bookmarks" ON public.bookmarks;
CREATE POLICY "Editors can insert own bookmarks"
  ON public.bookmarks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active)
  );

-- bookmarks: update (propi)
DROP POLICY IF EXISTS "Editors can update own bookmarks" ON public.bookmarks;
CREATE POLICY "Editors can update own bookmarks"
  ON public.bookmarks FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active)
  );

-- bookmarks: delete (propi)
DROP POLICY IF EXISTS "Editors can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Editors can delete own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active)
  );

-- categories: gestió (admins). Un admin desactivat tampoc no hauria de gestionar.
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin' AND p.active)
  );
```

> Les polítiques d'admin sobre `bookmarks` ("Admin can update/delete any bookmark") de 001 NO s'inclouen aquí perquè un admin no s'autodesactiva en el flux normal; si vols cobrir-les també, afegeix `AND p.active` a la subconsulta d'admin de la mateixa manera. Decisió de l'operador; per defecte no s'hi toca per minimitzar canvis.

**Verify**: `grep -c "p.active" supabase/migrations/005_enforce_active_on_writes.sql` → ≥4.

### Step 3: Build complet

**Verify**: `npm run build` → exit 0.

## Test plan

**Client (manual o test):**
- Marcar un perfil d'editor com `active = false` a la DB; iniciar sessió amb aquell compte → ha de quedar desloguejat immediatament (no veu la vista d'editor).

**RLS (operador, contra DB després d'aplicar 005):**
- Amb un editor `active = false`, intentar `insert`/`update`/`delete` sobre `bookmarks` propis via l'API → ha de fallar per RLS (0 files afectades / error de política).
- Amb un editor `active = true`, les mateixes operacions han de continuar funcionant.
- Reactivar l'editor (`setUserActive(id, true)`) → recupera els permisos.

Recomanat (follow-up, el repo encara no té tests a `src/`): un test que mocki `supabase` i comprovi que `loadProfile` amb `active:false` provoca `signOut`.

## Done criteria

ALL must hold:

- [ ] `grep -n "active === false" src/context/AuthContext.tsx` → 1 match
- [ ] `supabase/migrations/005_enforce_active_on_writes.sql` existeix i conté `AND ... p.active` a ≥4 polítiques
- [ ] `npx tsc -b` exit 0 i `npm run build` exit 0
- [ ] `git status --porcelain` mostra només els fitxers en scope
- [ ] Fila d'estat de 007 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- Els noms de les polítiques a 001 no coincideixen exactament amb els del `DROP POLICY` (el `DROP IF EXISTS` no fallaria, però recrearies amb nom nou i quedarien duplicades) — verifica els noms amb `grep "create policy" supabase/migrations/001_initial_schema.sql`.
- Vols endurir també `messages`/`editor_highlights`/`editor_requests`/`contact_requests`: les seves polítiques NO estan versionades, així que no pots saber-ne el nom/forma des del codi. Això requereix primer versionar-les (un pla separat, equivalent a V8 de `SEGURETAT.md`). Reporta-ho en lloc d'inventar polítiques.
- En provar, un editor **actiu** legítim perd permisos (la subconsulta `p.active` falla per algun motiu de tipus/NULL) — `active` és `NOT NULL DEFAULT true` a 001, però verifica-ho.

## Maintenance notes

- A partir d'ara, "desactivar" un editor revoca accés de debò. Si s'afegeixen taules noves amb escriptura per editors, les seves polítiques RLS han d'incloure la mateixa comprovació `AND p.active`.
- En revisió del PR: confirmar que la migració usa els noms EXACTES de les polítiques de 001 (per substituir-les, no duplicar-les) i que 001 queda intacte.
- L'expulsió al client és UX/defensa en profunditat; la barrera real és RLS. No confiïs només en el client.
- Follow-up explícitament diferit: versionar i endurir la RLS de `messages`/`editor_highlights`/`editor_requests`/`contact_requests` (no verificable des del codi actual).
