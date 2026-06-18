# Plan 006: Tancar el Stored XSS al changelog públic (títol de bookmark → HTML)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- src/components/ChangelogPostCard.tsx supabase/migrations/`
> If any in-scope file changed since this plan was written, compare against the
> "Current state" excerpts before proceeding; on a mismatch, treat it as a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

El changelog públic renderitza HTML cru amb `dangerouslySetInnerHTML`. El contingut d'aquests posts ve de dues fonts: (1) l'editor TipTap de l'admin, i (2) **un trigger de base de dades** que, cada cop que un editor afegeix un bookmark, construeix un fragment HTML incrustant `NEW.title` (el títol del recurs, text lliure controlat per l'editor) i l'insereix a `changelog_posts.content`. Com que qualsevol editor pot crear un bookmark amb un títol que contingui HTML/JavaScript, i el post resultant es publica i es mostra a **tots els visitants públics** sense sanititzar, això és un Stored XSS explotable per qualsevol editor i dirigit a tot el públic. La correcció té dues capes: escapar el títol a l'origen (el trigger) i sanititzar el HTML al render (defensa que cobreix també el contingut de l'admin).

## Current state

**Punt de render (vector de sortida):** `src/components/ChangelogPostCard.tsx:54-64`
```tsx
      <div
        className='changelog-content font-skin text-sm leading-relaxed'
        dangerouslySetInnerHTML={{ __html: post.content }}
        onClick={(e) => {
          const anchor = (e.target as HTMLElement).closest('[data-bookmark-id]') as HTMLElement | null
          if (anchor) {
            e.preventDefault()
            onBookmarkClick?.(anchor.dataset.bookmarkId!)
          }
        }}
      />
```
El `onClick` depèn que es preservi l'atribut `data-bookmark-id` als enllaços (qualsevol sanititzador ha de permetre `data-*` i `href`/`class`).

**Punt d'injecció (origen editor-controlat):** `supabase/migrations/003_auto_post_bookmark_trigger.sql`. La funció `auto_post_new_bookmark` construeix:
```sql
  v_new_item := '<li><p><a href="#" data-bookmark-id="' || NEW.id
    || '" class="underline text-blue-600 hover:text-blue-800">'
    || NEW.title || '</a>';      -- ← NEW.title cru, editor-controlat
  IF v_desc <> '' THEN
    v_new_item := v_new_item || ' — ' || v_desc;   -- ← v_desc cru (de NEW.description)
  END IF;
  v_new_item := v_new_item || ' <em>(' || v_username || ')</em></p></li>';
```
`NEW.id` és un UUID (segur). `NEW.title`, `v_desc` (de `NEW.description`) i `v_username` són text d'usuari sense escapar.

**Vista pública:** `src/pages/ChangelogPage.tsx` renderitza `ChangelogPostCard` per a cada post publicat (lectura pública via RLS `changelog_read_published`).

**Stack:** React 19 + Vite + TypeScript. Gestor de paquets: **npm** (`package-lock.json` present). Build: `npm run build` (`tsc -b && vite build`). Typecheck: `npx tsc -b`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Instal·lar sanititzador | `npm install dompurify` | exit 0, package-lock actualitzat |
| Typecheck | `npx tsc -b` | exit 0 |
| Build | `npm run build` | exit 0 |
| Sanititzador usat | `grep -n "DOMPurify\|sanitize" src/components/ChangelogPostCard.tsx` | ≥2 matches |

## Suggested executor toolkit

- DOMPurify és l'estàndard per sanititzar HTML al navegador. Documentació: https://github.com/cure53/DOMPurify. NO escriguis un sanititzador a mà.

## Scope

**In scope** (modificar/crear):
- `src/components/ChangelogPostCard.tsx` — sanititzar abans de `dangerouslySetInnerHTML`.
- `supabase/migrations/004_escape_bookmark_title_in_changelog.sql` — **crear**: redefinir la funció del trigger escapant els valors d'usuari.
- `package.json` / `package-lock.json` — afegir `dompurify` (per `npm install`, no editar a mà). NO afegir `@types/dompurify`.

**Out of scope** (NO tocar):
- `supabase/migrations/003_auto_post_bookmark_trigger.sql` — migració ja aplicada; **no** l'editis (les migracions són immutables un cop aplicades). La correcció va en una migració NOVA (004).
- `src/components/ChangelogEditor.tsx` — l'editor TipTap de l'admin; el render sanititzat ja el cobreix.
- La lògica de paginació del changelog, el servei `changelog.ts`.

## Git workflow

- Branch: `advisor/006-stored-xss-changelog`
- Commits per unitat lògica: un per al render sanititzat, un per a la migració. Estil: `fix(security): sanititzar HTML del changelog al render` / `fix(security): escapar títol de bookmark al trigger del changelog`
- No push ni PR sense instrucció.

## Steps

### Step 1: Instal·lar DOMPurify

```
npm install dompurify
```

**NO** instal·lis `@types/dompurify`: és un stub deprecat: DOMPurify (v3+) ja inclou les seves pròpies definicions de tipus, i instal·lar el paquet de tipus provoca conflictes de tipus duplicats.

**Verify**: `npm ls dompurify` → mostra una versió instal·lada (exit 0).

### Step 2: Sanititzar el contingut al render

A `src/components/ChangelogPostCard.tsx`:

1. Afegeix l'import a dalt: `import DOMPurify from 'dompurify'`.
2. Abans del `return`, calcula el HTML sanititzat preservant `data-bookmark-id`, `href`, `class`, `target`:
   ```tsx
   const safeHtml = DOMPurify.sanitize(post.content, {
     ADD_ATTR: ['data-bookmark-id', 'target'],
   })
   ```
   (DOMPurify ja permet `href`, `class` i atributs `data-*` per defecte; `ADD_ATTR` és redundant però explícit i segur.)
3. Substitueix `dangerouslySetInnerHTML={{ __html: post.content }}` per `dangerouslySetInnerHTML={{ __html: safeHtml }}`.

**Verify**:
- `grep -n "DOMPurify.sanitize" src/components/ChangelogPostCard.tsx` → 1 match.
- `grep -n "__html: post.content" src/components/ChangelogPostCard.tsx` → cap match (exit 1).
- `npx tsc -b` → exit 0.

### Step 3: Crear la migració que escapa els valors al trigger

Crea `supabase/migrations/004_escape_bookmark_title_in_changelog.sql` que redefineix `auto_post_new_bookmark` aplicant escapat HTML a `NEW.title`, `v_desc` i `v_username`. Usa `replace()` encadenats (Postgres no té una funció d'escapat HTML nativa). Reprodueix la lògica de 003 **idènticament** excepte els tres valors escapats:

```sql
-- Redefineix el trigger per escapar HTML dels valors d'usuari (anti-XSS).
-- El render també sanititza (DOMPurify), però escapar a l'origen evita
-- emmagatzemar markup injectat a changelog_posts.content.
CREATE OR REPLACE FUNCTION public.auto_post_new_bookmark()
RETURNS TRIGGER AS $$
DECLARE
  v_username  TEXT;
  v_desc      TEXT;
  v_title     TEXT;
  v_new_item  TEXT;
  v_today     TIMESTAMPTZ;
  v_post_id   UUID;
  v_post_content TEXT;
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.user_id;
  v_username := COALESCE(v_username, 'desconegut');

  -- Escapat HTML mínim (&, <, >, ", ')
  v_username := replace(replace(replace(replace(replace(v_username,
    '&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');

  v_title := replace(replace(replace(replace(replace(COALESCE(NEW.title,''),
    '&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');

  v_desc := COALESCE(NEW.description, '');
  IF char_length(v_desc) > 40 THEN
    v_desc := left(v_desc, 40) || '[...]';
  END IF;
  v_desc := replace(replace(replace(replace(replace(v_desc,
    '&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');

  v_new_item := '<li><p><a href="#" data-bookmark-id="' || NEW.id
    || '" class="underline text-blue-600 hover:text-blue-800">'
    || v_title || '</a>';
  IF v_desc <> '' THEN
    v_new_item := v_new_item || ' — ' || v_desc;
  END IF;
  v_new_item := v_new_item || ' <em>(' || v_username || ')</em></p></li>';

  v_today := date_trunc('day', NOW());

  SELECT id, content
    INTO v_post_id, v_post_content
    FROM public.changelog_posts
   WHERE title = 'Noves entrades'
     AND created_at >= v_today
     AND created_at < v_today + INTERVAL '1 day'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_post_id IS NOT NULL THEN
    UPDATE public.changelog_posts
       SET content = left(v_post_content, char_length(v_post_content) - 5)
                  || v_new_item || '</ul>'
     WHERE id = v_post_id;
  ELSE
    INSERT INTO public.changelog_posts (title, content, status)
    VALUES ('Noves entrades', '<ul>' || v_new_item || '</ul>', 'published');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_post_new_bookmark error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger trg_auto_post_new_bookmark de 003 ja apunta a aquesta funció;
-- CREATE OR REPLACE FUNCTION n'actualitza el cos sense recrear el trigger.
```

**Verify**:
- `grep -c "&amp;" supabase/migrations/004_escape_bookmark_title_in_changelog.sql` → ≥3 (un per cada valor escapat).
- `grep -n "CREATE OR REPLACE FUNCTION public.auto_post_new_bookmark" supabase/migrations/004_escape_bookmark_title_in_changelog.sql` → 1 match.

### Step 4: Build complet

**Verify**: `npm run build` → exit 0.

## Test plan

**Render (manual o test):**
- Cas regressió XSS: un post amb `content` = `<img src=x onerror="alert(1)">Hola` s'ha de renderitzar sense executar `onerror` (DOMPurify elimina `onerror`).
- Cas funcional preservat: un post amb `<a href="#" data-bookmark-id="abc" class="underline">X</a>` ha de conservar `data-bookmark-id` després de sanititzar (clica → `onBookmarkClick('abc')` funciona).

Recomanat afegir (el repo encara no té tests a `src/`; veure pla 009 de baseline si existeix): un test Vitest `src/components/ChangelogPostCard.test.tsx` que renderitzi amb contingut maliciós i comprovi que no hi ha atributs `onerror`/`onload` al DOM resultant, i que `data-bookmark-id` es preserva. Si no hi ha infra de test React encara, documenta la verificació manual al PR i deixa el test com a follow-up.

**Migració (operador, contra DB):**
- Aplicar `004_escape_bookmark_title_in_changelog.sql` al SQL Editor de Supabase.
- Crear un bookmark amb títol `<script>alert(1)</script>Recurs` → el post "Noves entrades" del dia ha de contenir `&lt;script&gt;...` (escapat), no `<script>`.

## Done criteria

ALL must hold:

- [ ] `npm ls dompurify` mostra la dependència instal·lada
- [ ] `grep -n "DOMPurify.sanitize" src/components/ChangelogPostCard.tsx` → 1 match
- [ ] `grep -n "__html: post.content" src/components/ChangelogPostCard.tsx` → cap match
- [ ] `supabase/migrations/004_escape_bookmark_title_in_changelog.sql` existeix i escapa title/desc/username
- [ ] `npx tsc -b` exit 0 i `npm run build` exit 0
- [ ] `git status --porcelain` mostra només fitxers en scope (+ package.json/package-lock per la dependència)
- [ ] Fila d'estat de 006 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- El render o el trigger no coincideixen amb els excerpts (deriva — especialment si 003 ja s'ha modificat).
- Després de sanititzar, els enllaços `data-bookmark-id` deixen de funcionar (DOMPurify els elimina): NO desactivis la sanitització; reporta perquè cal ajustar la config de DOMPurify (`ADD_ATTR`).
- `tsc` es queixa de l'import de DOMPurify (p. ex. "no default export" o problemes d'interop): el repo usa `"type": "module"` i bundler ESM, on `import DOMPurify from 'dompurify'` ha de funcionar; si no, prova `import * as DOMPurify from 'dompurify'` o consulta la documentació de DOMPurify per a la forma d'import correcta de la versió instal·lada, i reporta. NO instal·lis `@types/dompurify` (stub deprecat).
- Descobreixes una **tercera** font que escriu a `changelog_posts.content` amb valors d'usuari (a part del trigger 003 i l'editor admin) — investiga abans de donar per tancat el vector.

## Maintenance notes

- Tota nova superfície que renderitzi `changelog_posts.content` (o qualsevol HTML d'origen no totalment confiable) ha de passar per DOMPurify.
- En revisió del PR: confirmar que la migració 004 NO recrea el trigger (només `CREATE OR REPLACE FUNCTION`), i que 003 queda intacte.
- Si en el futur s'amplia el HTML permès als posts (imatges, taules), revisar la config de DOMPurify perquè no bloquegi etiquetes legítimes alhora que manté segurs els atributs d'esdeveniment.
- Defensa en profunditat addicional (follow-up, no inclòs): una `Content-Security-Policy` sense `unsafe-inline` per a scripts limitaria l'impacte de qualsevol XSS residual.
