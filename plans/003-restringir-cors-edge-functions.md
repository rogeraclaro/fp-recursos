# Plan 003: Restringir CORS de les Edge Functions al domini de producció

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- supabase/functions/`
> If any in-scope function changed since this plan was written, compare against
> the "Current state" excerpts before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (si el domini és correcte) / MED (si es trenca el dev local)
- **Depends on**: none (però si executes 001/002/004/005 abans, fes-ho seqüencialment — toquen els mateixos fitxers)
- **Category**: security
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

Les 5 Edge Functions retornen `'Access-Control-Allow-Origin': '*'`. Això permet que **qualsevol** pàgina web (qualsevol origen) faci peticions cross-origin a les funcions des del navegador d'un usuari autenticat. Tot i que les funcions validen el JWT, un origen obert amplia innecessàriament la superfície d'atac (CSRF assistit per navegador, abús des de pàgines de tercers). Restringir l'origen al domini de producció (i opcionalment al dev local) és la pràctica estàndard i no té cost funcional per a l'app legítima, que sempre es serveix des del seu propi domini.

El domini de producció, confirmat als emails i enllaços del codi (`handle-editor-request/index.ts:136`, `:202`), és **`https://fp-recursos.masellas.info`**.

## Current state

Les 5 funcions defineixen el mateix objecte `corsHeaders` amb origen obert. Línies exactes de `Access-Control-Allow-Origin`:

- `supabase/functions/suggest-resource/index.ts:9`
- `supabase/functions/change-user-password/index.ts:5`
- `supabase/functions/delete-editor/index.ts:5`
- `supabase/functions/create-editor/index.ts:5`
- `supabase/functions/handle-editor-request/index.ts:4`

Forma actual (idèntica a cada fitxer, excepte la indentació/posició):

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

Cada funció respon al preflight `OPTIONS` retornant `corsHeaders`, i inclou `...corsHeaders` a totes les respostes. Hi ha **un sol lloc** per fitxer on apareix `'*'` (dins l'objecte `corsHeaders`); no està duplicat en altres punts.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Cap origen obert restant | `grep -rn "Allow-Origin': '\*'" supabase/functions/` | cap resultat (exit 1) |
| Comptar origen restringit | `grep -rln "fp-recursos.masellas.info" supabase/functions/` | 5 fitxers |

## Scope

**In scope** (modificar):
- `supabase/functions/suggest-resource/index.ts`
- `supabase/functions/change-user-password/index.ts`
- `supabase/functions/delete-editor/index.ts`
- `supabase/functions/create-editor/index.ts`
- `supabase/functions/handle-editor-request/index.ts`

**Out of scope** (NO tocar):
- La lògica interna de cada funció (auth, body parsing, etc.) — només la capçalera CORS.
- `supabase/config.toml`, migracions, codi de `src/`.

## Git workflow

- Branch: `advisor/003-restringir-cors`
- Un sol commit: `fix(security): restringir CORS de les Edge Functions al domini de producció`
- No push ni PR sense instrucció.

## Steps

### Step 1: Decidir l'estratègia d'origen permès

Hi ha dues opcions. **Recomanada (A)** per simplicitat, ja que l'app només es serveix des d'un domini:

**Opció A — origen fix únic** (recomanada): substituir `'*'` per `'https://fp-recursos.masellas.info'` a cada funció.

**Opció B — producció + dev local**: si l'operador necessita invocar les Edge Functions desplegades des de `http://localhost:5173` durant el desenvolupament, usa una funció que retorni l'origen permès segons la capçalera `Origin` de la petició. Patró:

```ts
const ALLOWED_ORIGINS = [
  'https://fp-recursos.masellas.info',
  'http://localhost:5173',
]

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}
```

Amb l'opció B, dins de `Deno.serve`/`serve` cal calcular `const corsHeaders = corsHeadersFor(req)` al principi del handler (abans del `if (req.method === 'OPTIONS')`), perquè totes les respostes que fan `...corsHeaders` el referencien.

**Tria A si no hi ha evidència que cal dev local contra funcions desplegades** (el dev local normalment usa `supabase functions serve`, que té el seu propi CORS). Documenta la tria al PR.

**Verify**: tens decidida l'opció i el valor d'origen.

### Step 2: Aplicar a les 5 funcions

Aplica la mateixa estratègia a cada fitxer en scope. Amb l'opció A, és un reemplaçament de string de `'*'` per `'https://fp-recursos.masellas.info'` dins de l'objecte `corsHeaders`. Amb l'opció B, mou el càlcul dins el handler com es descriu a dalt.

Comprova que cada funció continua incloent `...corsHeaders` (o `...corsHeadersFor(req)`) a **totes** les respostes, inclosa la del preflight `OPTIONS` i les d'error.

**Verify**: `grep -rn "Allow-Origin': '\*'" supabase/functions/` → cap resultat.

### Step 3: Confirmar consistència

**Verify**: `grep -rln "fp-recursos.masellas.info" supabase/functions/` → 5 fitxers.

## Test plan

No hi ha tests automatitzats. Verificació funcional (operador, post-deploy):

- Des de l'app a `https://fp-recursos.masellas.info`, totes les operacions que invoquen Edge Functions (suggerir recurs amb IA, crear/eliminar editor, canviar contrasenya, aprovar/rebutjar petició) han de funcionar.
- `curl -i -X OPTIONS -H "Origin: https://atacant.com" <url-funcio>` **no** ha de retornar `Access-Control-Allow-Origin: https://atacant.com`.
- `curl -i -X OPTIONS -H "Origin: https://fp-recursos.masellas.info" <url-funcio>` **sí** ha de retornar aquest origen.

## Done criteria

ALL must hold:

- [ ] `grep -rn "Allow-Origin': '\*'" supabase/functions/` retorna 0 matches
- [ ] Les 5 funcions referencien `https://fp-recursos.masellas.info`
- [ ] `git status --porcelain` mostra només els 5 fitxers en scope
- [ ] Fila d'estat de 003 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- El domini de producció real **no** és `https://fp-recursos.masellas.info` (confirma-ho amb l'operador abans de fixar-lo a 5 fitxers).
- Alguna funció té `'*'` en més d'un lloc o construeix CORS de forma diferent a l'excerpt — revisa-la individualment.
- Descobreixes que l'app es serveix també des d'un segon domini (p. ex. un domini `*.vercel.app` de preview) que necessitaria accés — en aquest cas cal l'opció B amb la llista ampliada.

## Maintenance notes

- Si s'afegeix un nou domini (staging, preview), actualitzar la llista a totes les funcions (o centralitzar `corsHeaders` en un mòdul compartit `supabase/functions/_shared/cors.ts` — follow-up no inclòs aquí per evitar refactor cross-funció).
- En revisió del PR: verificar que les respostes d'error també porten les capçaleres CORS; si no, el navegador amaga el missatge d'error real i el debugging es complica.
- Follow-up diferit: extreure `corsHeaders` a un mòdul `_shared/` per no repetir-lo a 5 llocs.
