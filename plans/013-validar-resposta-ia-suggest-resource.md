# Plan 013: Validar la resposta de la IA a `suggest-resource` abans de retornar-la

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e28e51..HEAD -- supabase/functions/suggest-resource/index.ts`
> Si el fitxer ha canviat des que es va escriure aquest pla, compara els
> excerpts de "Current state" contra el codi real abans de continuar; si no
> coincideixen, és una condició de STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (correctness)
- **Planned at**: commit `6e28e51`, 2026-09-17

## Why this matters

`suggest-resource` demana a un model de Groq que analitzi una pàgina web i retorni JSON amb `title`, `description` i `category`. El `prompt` inclou `bodyText` (fins a 3000 caràcters extrets de la pàgina que l'usuari ha indicat, no controlada per nosaltres) i demana que `category` sigui "una de les categories disponibles" — però el codi mai comprova que el model realment hagi respost amb una categoria de la llista, ni que `title`/`description` siguin strings. `src/components/BookmarkForm.tsx:38-40` desa aquest resultat directament a l'estat del formulari, i si l'usuari no revisa/canvia la categoria abans de desar, una categoria inventada o buida acaba com a categoria "òrfena" al catàleg (la mateixa mecànica que `App.tsx` ja gestiona amb `orphanCategories`/`orphanBookmarkIds` — símptoma d'un problema, no la causa). Validar la forma de la resposta al servidor, on ja sabem quines categories són vàlides, talla el problema d'arrel abans que arribi al client.

## Current state

**`supabase/functions/suggest-resource/index.ts:170`** — `categories` arriba com a paràmetre de la petició (llista de noms vàlids, la mateixa que el prompt li passa al model):
```ts
    const { url, categories } = await req.json()
```

**`supabase/functions/suggest-resource/index.ts:248-255`** — la resposta es parseja i es retorna sense cap validació:
```ts
    const text: string =
      (groqData as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)

    return new Response(JSON.stringify({ ...result, model: usedModel }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
```

**Costat client, ja fora d'abast d'aquest pla (no cal tocar-lo, però és el consumidor)** — `src/services/ai.ts:3-7` declara el tipus esperat:
```ts
export interface AISuggestion {
  title: string
  description: string
  category: string
  model?: string
}
```
i `src/components/BookmarkForm.tsx:37-41` fa el cast implícit sense validar:
```ts
      const result = await suggestResource(url.trim(), categories.map(c => c.name))
      setTitle(result.title)
      setDescription(result.description)
      if (result.category) setSelectedCats([result.category])
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Sintaxi/tipus Deno (revisió manual, no hi ha `deno check` configurat al repo) | Lectura manual del diff | sense errors evidents de sintaxi TS |
| Typecheck del frontend (no cobreix Edge Functions Deno, però confirma que no has tocat cap fitxer TS del frontend per error) | `npx tsc -b` | exit 0 |
| Desplegar (acció manual de l'operador, NO ho facis tu) | `supabase functions deploy suggest-resource` | — |

No es pot testejar aquesta Edge Function en aquest repo sense el CLI de Supabase amb `supabase start` (no configurat). Verificació per lectura de codi.

## Scope

**In scope**:
- `supabase/functions/suggest-resource/index.ts` (només el bloc de parseig/resposta, línies ~246-255)

**Out of scope** (no ho toquis):
- `src/services/ai.ts`, `src/components/BookmarkForm.tsx` — el tipus `AISuggestion` i el consum al client no canvien; aquest pla només fa que el servidor mai enviï un `category` invàlid o un `title`/`description` no-string, així que el client rep sempre dades netes sense necessitat de canviar-hi res.
- El timeout/`AbortController` de la crida a Groq (un altre finding, no seleccionat en aquesta tanda).
- La lògica de `MODEL_CANDIDATES`/fallback entre models — no la toquis, ja ha costat 3 iteracions arreglar-la.

## Git workflow

- Branch: `advisor/013-validar-resposta-ia`
- Un commit: `fix(ai): validar la resposta de suggest-resource abans de retornar-la`
- No facis push ni PR sense instrucció explícita.

## Steps

### Step 1: Afegir una funció de validació

Immediatament abans del bloc `for (const model of MODEL_CANDIDATES) {` (línia ~215), o just després de la definició de `contextBlock`/`prompt` (abans de fer servir `categories` per a res més), afegeix:

```ts
function sanitizeSuggestion(
  raw: unknown,
  validCategories: string[],
): { title: string; description: string; category: string | null } {
  const obj = (raw ?? {}) as Record<string, unknown>
  const title = typeof obj.title === 'string' ? obj.title.slice(0, 200) : ''
  const description = typeof obj.description === 'string' ? obj.description.slice(0, 1000) : ''
  const category =
    typeof obj.category === 'string' && validCategories.includes(obj.category)
      ? obj.category
      : null
  return { title, description, category }
}
```

**Verify**: `grep -n "function sanitizeSuggestion" supabase/functions/suggest-resource/index.ts` → 1 resultat.

### Step 2: Aplicar la validació abans de respondre

Substitueix el bloc de "Current state" (línies ~248-255) per:

```ts
    const text: string =
      (groqData as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const result = sanitizeSuggestion(parsed, categories as string[])

    return new Response(JSON.stringify({ ...result, model: usedModel }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
```

Nota: `category` pot ser `null` si el model n'ha suggerit una que no és vàlida — el client ja gestiona aquest cas (`BookmarkForm.tsx:40` fa `if (result.category) setSelectedCats(...)`, és a dir, si és `null`/`undefined` simplement no preselecciona cap categoria, sense trencar-se). No cal canviar el client.

**Verify**: `grep -n "sanitizeSuggestion(parsed" supabase/functions/suggest-resource/index.ts` → 1 resultat.

### Step 3: Verificació global

**Verify**: `npx tsc -b` → exit 0 (confirma que no s'ha tocat cap fitxer del frontend).
**Verify**: `git status --short` → només `supabase/functions/suggest-resource/index.ts` modificat.

## Test plan

No hi ha framework de test per a aquesta Edge Function (Deno, sense desplegament en revisió). Verificació manual per a l'operador després del deploy:

1. Provar amb una URL normal → `title`/`description`/`category` arriben com sempre.
2. (Difícil de forçar sense manipular el prompt) — el punt clau és que si algun dia el model respon amb una categoria fora de la llista, el camp `category` arriba `null` en lloc de contaminar el catàleg amb una categoria òrfena.

## Done criteria

- [ ] `sanitizeSuggestion` existeix i es fa servir abans de construir la `Response`
- [ ] `result.category` mai pot ser un valor que no estigui a `categories` (verificat per lectura del codi)
- [ ] `title`/`description` són sempre `string` (mai `undefined`/`number`/objecte)
- [ ] `npx tsc -b` surt amb exit 0
- [ ] Cap fitxer fora de l'abast modificat
- [ ] `plans/README.md` actualitzat

## STOP conditions

Atura't i informa (no improvisis) si:
- El codi actual de `supabase/functions/suggest-resource/index.ts` no coincideix amb els excerpts de "Current state".
- El format de resposta de Groq ha canviat (p. ex. `choices[0].message.content` ja no existeix) — no ho arreglis com a efecte secundari d'aquest pla, informa-ho per separat.
- Descobreixes que el client (`BookmarkForm.tsx`) sí que necessita un canvi perquè `category: null` li provoca algun error — informa-ho, no toquis el client sense confirmació (és fora d'abast segons aquest pla).

## Maintenance notes

- Si en el futur s'afegeixen més camps a `AISuggestion` (p. ex. tags), `sanitizeSuggestion` s'ha d'actualitzar per validar-los també — no assumeixis que qualsevol camp nou de la resposta del model és segur de reenviar tal qual al client.
- El finding relacionat "la crida a Groq no té timeout" (BUG-02 de l'auditoria) no s'ha tocat en aquest pla; és un candidat per a un pla futur si es torna a triar.
