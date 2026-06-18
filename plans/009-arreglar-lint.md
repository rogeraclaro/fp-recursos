# Plan 009: Deixar `npm run lint` en verd (exit 0) com a gate de CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- src/ eslint.config.js src/types/database.ts`
> If any in-scope file changed since this plan was written, compare against the
> "Current state" excerpts before proceeding; on a mismatch, treat it as a STOP
> condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (excepte els disables estructurals — veure pas 5)
- **Depends on**: executa'l **després** de 006/007/008 si els fas, perquè aquells toquen serveis i `database.ts`; si no, és independent
- **Category**: dx
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

`npm run lint` falla amb 26 errors, així que no pot servir de barrera de qualitat (ni a CI ni localment): un error nou es perd entre el soroll dels existents. Els errors són de tres menes amb tractament diferent: (1) **mecànics i segurs** — 15 `no-explicit-any` i 3 `no-unused-vars`, que es resolen tipant correctament; (2) **de configuració** — l'ESLint d'arrel (config de React, globals de navegador) està lintant també l'extensió (Deno/altra runtime) i les Edge Functions (Deno), que tenen el seu propi entorn i no haurien d'avaluar-se amb aquesta config; (3) **estructurals** — uns quants errors de `react-hooks` a `App.tsx` que assenyalen patrons reals de React 19 (setState dins d'effect, crear components durant el render) la correcció dels quals és el refactor d'`App.tsx` (un treball separat i arriscat). Aquest pla resol (1) i (2) de soca-rel i neutralitza (3) amb desactivacions puntuals i marcades amb `TODO`, de manera que el lint queda en verd **sense amagar silenciosament** els problemes estructurals.

## Current state

`eslint.config.js` (arrel) linta `**/*.{ts,tsx}` amb config de React + globals de navegador, ignorant només `dist`:
```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [ js.configs.recommended, tseslint.configs.recommended,
               reactHooks.configs.flat.recommended, reactRefresh.configs.vite ],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
  },
])
```

`npx eslint .` produeix (26 errors + 2 warnings). Desglossament per regla i ubicació:

- **`@typescript-eslint/no-explicit-any` (15)**:
  - `src/services/contacts.ts:4`, `src/services/editorRequests.ts:5`, `src/services/profiles.ts:54` — casts `supabase.from('...') as any` SENSE `eslint-disable` → surten com a error.
  - `src/services/editorRequests.ts:44` — `(error as any).context?.json?.()` (no és cast de taula; és gestió d'error d'una Edge Function).
  - `src/pages/AdminView.tsx:38,49,59,78` — `catch (err: any)`.
  - `supabase/functions/{change-user-password,create-editor,delete-editor,handle-editor-request}/index.ts` — `catch (err: any)` (Deno; veure pas 1, s'ignoraran).
  - `extension/popup/popup.tsx:300`, `extension/shared/types.ts:33,38` (extensió; s'ignoraran).
  - **A més** (NO surten com a error perquè tenen `// eslint-disable-next-line` a sobre, però són `as any` que cal netejar per coherència): `src/services/bookmarks.ts:6`, `src/services/categories.ts:6`, `src/services/messages.ts:6`, `src/services/changelog.ts:5`, `src/services/highlights.ts:4`, `src/services/profiles.ts:5`. Cada un té el cast `supabase.from('...') as any` i un comentari `eslint-disable` a la línia anterior.
- **`@typescript-eslint/no-unused-vars` (3)**: `src/App.tsx:330` (`_`), `src/pages/EditorView.tsx:45` (`_`), i un import `'Bookmark'` no usat (`extension/tests/tabs-save.test.ts:3` — extensió, s'ignorarà).
- **`react-refresh/only-export-components` (2)**: `src/context/AuthContext.tsx:79`, `src/context/SkinContext.tsx:46` — exporten un hook (`useAuth`/`useSkin`) al costat del component provider.
- **`react-hooks` estructurals (errors, a `src/`)**: `src/App.tsx:112` (setState síncron dins effect), `src/App.tsx:211` (funció impura durant el render), `src/App.tsx:463,471,485` (crear components durant el render), `src/pages/ChangelogPage.tsx:38` (setState dins effect).
- **`react-hooks/exhaustive-deps` (2 warnings)**: `src/components/MessagesModal.tsx:168`, `src/pages/EditorView.tsx:41` — són **warnings**, no bloquegen `eslint .`; es deixen com a follow-up.

Tipus `Database` actual: `src/types/database.ts:100-120` només declara `profiles`, `categories`, `bookmarks` a `Tables`, però el fitxer **ja conté** les interfícies `Message`, `EditorRequest`, `ContactRequest`, `ChangelogPost`/`ChangelogPostInsert`/`ChangelogPostUpdate`. Falta `editor_highlights`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Lint | `npx eslint .` | exit 0, 0 errors (warnings permesos) |
| Comptar errors | `npx eslint . 2>&1 \| grep -c error` | `0` |
| Typecheck | `npx tsc -b` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope** (modificar):
- `eslint.config.js` — ignorar `extension` i `supabase/functions` (runtimes propis).
- `src/types/database.ts` — afegir les taules que falten a `Database['public']['Tables']`.
- `src/services/contacts.ts`, `src/services/editorRequests.ts`, `src/services/profiles.ts`, `src/services/bookmarks.ts`, `src/services/categories.ts`, `src/services/messages.ts`, `src/services/changelog.ts`, `src/services/highlights.ts` — eliminar TOTS els casts `supabase.from(...) as any` (ja tipats) i els comentaris `// eslint-disable-next-line @typescript-eslint/no-explicit-any` que els precedeixen.
- `src/pages/AdminView.tsx` — tipar els `catch (err: any)`.
- `src/App.tsx`, `src/pages/EditorView.tsx` — `no-unused-vars` i disables `react-hooks` puntuals.
- `src/pages/ChangelogPage.tsx` — disable puntual.
- `src/context/AuthContext.tsx`, `src/context/SkinContext.tsx` — disable `react-refresh` puntual.

**Out of scope** (NO tocar):
- `extension/**`, `supabase/functions/**` — s'exclouen de la config, no es modifiquen aquí.
- La lògica de negoci d'`App.tsx`/`ChangelogPage` — aquest pla **no** refactoritza; només neutralitza el lint amb `TODO` marcats.
- Els warnings `exhaustive-deps` (follow-up).

## Git workflow

- Branch: `advisor/009-arreglar-lint`
- Commits per unitat: config eslint / tipus DB / casts serveis / catch AdminView / disables. Estil: `chore(dx): ...` / `fix(types): ...`
- No push ni PR sense instrucció.

## Steps

### Step 1: Excloure runtimes externs de la config d'ESLint

A `eslint.config.js`, amplia `globalIgnores`:
```js
  globalIgnores(['dist', 'extension', 'supabase/functions']),
```
Justificació: l'extensió i les Edge Functions són Deno/altres entorns amb la seva pròpia configuració; lintar-los amb la config de React + globals de navegador és incorrecte i genera falsos positius. (L'extensió ja té el seu propi `eslint`/`vitest` a `extension/`.)

**Verify**: `npx eslint . 2>&1 | grep -c "extension/\|supabase/functions/"` → `0`.

### Step 2: Completar el tipus `Database`

A `src/types/database.ts`, dins `Database['public']['Tables']` (després de `bookmarks`), afegeix les taules que falten usant les interfícies que ja existeixen al fitxer:
```ts
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at' | 'read_by_recipient'> & { read_by_recipient?: boolean }
        Update: Partial<Pick<Message, 'content' | 'read_by_recipient'>>
      }
      editor_requests: {
        Row: EditorRequest
        Insert: Pick<EditorRequest, 'name' | 'email'> & { comment?: string | null; status?: EditorRequest['status'] }
        Update: Partial<Pick<EditorRequest, 'status' | 'reviewed_at' | 'reviewed_by'>>
      }
      contact_requests: {
        Row: ContactRequest
        Insert: Pick<ContactRequest, 'name' | 'email' | 'message'> & { read?: boolean }
        Update: Partial<Pick<ContactRequest, 'read'>>
      }
      changelog_posts: {
        Row: ChangelogPost
        Insert: ChangelogPostInsert
        Update: ChangelogPostUpdate
      }
      editor_highlights: {
        Row: { id: string; user_id: string; bookmark_id: string; created_at: string }
        Insert: { user_id: string; bookmark_id: string }
        Update: Partial<{ user_id: string; bookmark_id: string }>
      }
```
> Confirmat a `src/services/highlights.ts`: només s'hi insereix `{ user_id, bookmark_id }` i només es llegeix `bookmark_id` (filtrant per `user_id`), així que l'`Insert`/`Update` de dalt són exactes. Les columnes `id` i `created_at` del `Row` són l'assumpció estàndard d'una taula Supabase però no es fan servir al codi; si la taula real no les té, no passa res (el `Row` no es consumeix amb aquests camps). No cal verificar-ho contra la DB per a aquest pla.

**Verify**: `npx tsc -b` → exit 0.

### Step 3: Eliminar tots els casts `as any` als serveis

Ara que les taules estan tipades, a **cada** fitxer de servei amb el patró `const x = () => supabase.from('taula') as any`, fes dos canvis:
1. Treu ` as any` (deixa `const x = () => supabase.from('taula')`).
2. Elimina la línia `// eslint-disable-next-line @typescript-eslint/no-explicit-any` immediatament anterior, si hi és.

Fitxers (cast de taula): `contacts.ts:4`, `editorRequests.ts:5`, `profiles.ts:5` i `:54` (aquest darrer és un cast inline `(supabase.from('profiles') as any)` → treu el ` as any`), `bookmarks.ts:6` (+disable a :5), `categories.ts:6` (+disable a :5), `messages.ts:6` (+disable a :5), `changelog.ts:5` (+disable a :4), `highlights.ts:4` (+disable a :3).

A part, hi ha **un `as any` que NO és cast de taula** a `editorRequests.ts:44`:
```ts
const body = await (error as any).context?.json?.().catch(() => null)
```
Aquest gestiona l'error d'una Edge Function. Tipa'l com fa `src/services/ai.ts` (mira'l com a patró):
```ts
const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
```

Si en treure algun `as any` apareix un error de tipus REAL (p. ex. `.insert()` espera una forma diferent), **ajusta el codi al tipus** (no reposis `as any`). Si un cas és genuïnament intractable, usa un cast localitzat i específic (p. ex. `as Database['public']['Tables']['messages']['Insert']`), mai `as any`.

**Verify**: `grep -rn "as any" src/` → cap match. `npx tsc -b` → exit 0.

### Step 4: Tipar els `catch` d'`AdminView`

A `src/pages/AdminView.tsx`, als 4 `catch (err: any)` (línies ~38, 49, 59, 78), canvia a `catch (err)` i, on s'usa `err.message`, substitueix per `err instanceof Error ? err.message : String(err)`.

**Verify**: `grep -n "err: any" src/pages/AdminView.tsx` → cap match. `npx tsc -b` → exit 0.

### Step 5: Resoldre unused-vars i neutralitzar els errors estructurals de react-hooks

5a. **no-unused-vars**: a `src/App.tsx:330` i `src/pages/EditorView.tsx:45`, la variable `_` no s'usa. Elimina-la del destructuring/assignació, o si és un placeholder intencional d'un retorn que no es vol, reescriu per no introduir el binding. (No usis `// eslint-disable` per a aquests; són eliminables.)

5b. **react-refresh** (`AuthContext.tsx:79`, `SkinContext.tsx:46`): afegeix just a sobre de la línia d'`export function useAuth`/`export function useSkin`:
```ts
// eslint-disable-next-line react-refresh/only-export-components
```
(Exportar un hook al costat del provider és un patró benigne; el disable puntual és la solució estàndard i de risc zero.)

5c. **Errors estructurals de react-hooks** a `App.tsx` (línies 112, 211, 463, 471, 485) i `ChangelogPage.tsx` (línia 38): aquests assenyalen patrons reals (setState síncron dins effect, funció impura durant el render, creació de components durant el render) la correcció dels quals requereix refactoritzar `App.tsx` — fora de l'abast d'aquest pla. Neutralitza'ls amb una desactivació puntual **marcada**, a la línia immediatament anterior a cada error:
```ts
// eslint-disable-next-line <regla-exacta> -- TODO(refactor App.tsx): patró a corregir, veure finding tech-debt
```
Obté la regla exacta de cada lloc executant `npx eslint src/App.tsx src/pages/ChangelogPage.tsx` i copiant l'ID de regla que reporta a cada línia (p. ex. `react-hooks/set-state-in-effect`).

> Aquesta és una decisió deliberada: el lint queda en verd ara, els problemes resten visibles com a `TODO` localitzats (no esborrats), i es corregiran durant el refactor d'`App.tsx`. NO desactivis la regla globalment a `eslint.config.js`.

**Verify**: `npx eslint . 2>&1 | grep -c error` → `0`.

### Step 6: Verificació completa

**Verify**:
- `npx eslint .` → exit 0 (pot mostrar els 2 warnings `exhaustive-deps`; està bé).
- `npx tsc -b` → exit 0.
- `npm run build` → exit 0.

## Test plan

No s'introdueix comportament nou; la xarxa de seguretat és el typecheck + build. Després d'aquest pla, `npm run lint` és apte com a gate. Recomanació de follow-up (no en aquest pla): afegir `npm run lint` i `npm run build` a un workflow de CI.

## Done criteria

ALL must hold:

- [ ] `npx eslint . 2>&1 | grep -c error` → `0`
- [ ] `grep -rn "as any" src/` → cap match
- [ ] `eslint.config.js` ignora `extension` i `supabase/functions`
- [ ] `npx tsc -b` exit 0 i `npm run build` exit 0
- [ ] Cada `eslint-disable` estructural a `App.tsx`/`ChangelogPage.tsx` porta un comentari `TODO(refactor`
- [ ] `git status --porcelain` mostra només fitxers en scope
- [ ] Fila d'estat de 009 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- En treure un `as any` apareix un error de tipus que revela un **bug real** (p. ex. s'insereix una columna inexistent) — reporta'l en lloc d'emmascarar-lo amb un cast.
- En treure el `as any` d'`editor_highlights` (a `src/services/highlights.ts`) apareix un error de tipus inesperat: l'`Insert`/`Update` documentats coincideixen amb l'ús real, així que un error aquí indicaria deriva del codi — compara amb l'excerpt i reporta.
- El nombre o la ubicació dels errors estructurals de react-hooks difereix del llistat (deriva del codi des del commit `e692524`) — re-executa `npx eslint src/` i ajusta, però si apareixen molts errors nous, atura't.
- Excloure `supabase/functions` de la config trenca alguna altra cosa (no hauria; cap altre pas depèn que es lintin).

## Maintenance notes

- A partir d'ara `npm run lint` ha de quedar en verd; afegeix-lo a CI per protegir-ho.
- Els `eslint-disable ... TODO(refactor App.tsx)` són deute tècnic explícit: en fer el refactor d'`App.tsx` (finding tech-debt), elimina'ls corregint el patró de debò (no deixant el disable).
- L'extensió i les Edge Functions queden fora d'aquesta config; si es vol lintar-les, han de tenir el seu propi `eslint.config` adaptat a Deno.
- En revisió del PR: vigilar que no s'hagi reintroduït cap `as any` ni desactivat cap regla globalment.
- Follow-up diferit: resoldre els 2 warnings `exhaustive-deps` (MessagesModal, EditorView) embolcallant els callbacks en `useCallback` o ajustant les dependències.
