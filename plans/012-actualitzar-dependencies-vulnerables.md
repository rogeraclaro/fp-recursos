# Plan 012: Actualitzar dependències amb vulnerabilitats conegudes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `npm audit` i confirma que el recompte de
> vulnerabilitats i els paquets afectats coincideixen (aproximadament) amb
> "Current state" — si `npm audit` ja reporta 0 vulnerabilitats, algú ho ha
> arreglat des que es va escriure aquest pla; atura't i actualitza
> `plans/README.md` a REJECTED amb aquest motiu en lloc d'executar els passos.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (canvis dins dels rangs semver ja declarats a `package.json`; sense `--force`, sense bumps de major)
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `6e28e51`, 2026-09-17

## Why this matters

`npm audit` reporta 40 vulnerabilitats (7 altes, 30 moderades, 3 baixes) al `package-lock.json` versionat, incloent-hi un bypass de sanitització a **dompurify** (GHSA-c2j3-45gr-mqc4 / GHSA-55q2-fjhq-7xh7) — precisament la llibreria que el pla 006 (ja aplicat i mergejat) usa per tancar l'Stored XSS del changelog. Una vulnerabilitat a la llibreria que hauria de tancar un XSS és una regressió silenciosa d'una defensa ja aplicada. Els altres paquets afectats (`postcss`, `vite`, `nanoid`, `js-yaml`, `esbuild`, `@tiptap/*`) tenen advisories de DoS o exposició de fitxers.

**Detall important descobert durant l'auditoria**: el `node_modules/` local d'aquesta màquina ja té versions més noves i pegades d'alguns d'aquests paquets (p. ex. `postcss@8.5.28`, `vite@7.3.6`, `dompurify@3.4.15`) que **no coincideixen amb el que hi ha pinnat a `package-lock.json`** (`postcss@8.5.14`, `vite@7.3.3`, `dompurify@3.4.11`). És a dir, aquesta màquina té una còpia de `node_modules` que ha divergit del lockfile versionat — probablement per una instal·lació manual puntual d'algun paquet en algun moment. **El que importa és el `package-lock.json`**: és el que `npm ci` instal·la en qualsevol desplegament o CI nova, i és on `npm audit` llegeix les 40 vulnerabilitats reals. Aquest pla actualitza el lockfile, no confia en l'estat actual de `node_modules` de cap màquina concreta.

## Current state

`package.json` (dependències rellevants, ja permeten la pujada sense canviar el `package.json` en la majoria de casos perquè usen `^`):
```json
"@supabase/supabase-js": "^2.105.4",
"@tiptap/extension-link": "^3.26.0",
"@tiptap/extension-placeholder": "^3.26.0",
"@tiptap/react": "^3.26.0",
"@tiptap/starter-kit": "^3.26.0",
"dompurify": "^3.4.11",
...
"vite": "^7.2.4",
...
"vitest": "^4.1.0"
```
(`postcss` no és dependència directa — arriba via `tailwindcss`/`autoprefixer`/`vite`; però sí que hi és versionada al lockfile.)

`package-lock.json` (versions actualment pinnades, totes dins del rang vulnerable):
| Paquet | Pinnat a `package-lock.json` | Vulnerable? | Primera versió no vulnerable coneguda |
|---|---|---|---|
| `dompurify` | 3.4.11 | Sí (moderate) | 3.4.13+ (verificat: `3.4.15` disponible) |
| `postcss` | 8.5.14 | Sí (high) | 8.5.23+ (verificat: `8.5.28` disponible) |
| `vite` | 7.3.3 | Sí (high) | 7.3.4+ (verificat: `7.3.6` disponible) |
| `nanoid` (transitiva via postcss) | 3.3.12 | Sí (high) | 3.3.18+ (verificat: `3.3.19` disponible) |
| `esbuild` (transitiva via vite) | 0.27.7 | Sí (low) | 0.28.1+ (verificat: `0.28.2` disponible) |
| `js-yaml` (transitiva via eslint) | 4.1.1 | Sí (high) | 4.3.2 disponible i confirmat instal·lat a `node_modules` |
| `@tiptap/core`/`react`/`extension-link`/`extension-placeholder`/`starter-kit` | 3.26.0 (tots) | Sí (moderate: `react`/`extension-link`/`extension-placeholder`; high: `core`, transitiu) | `3.31.3` (última, verificada amb `npm view`) |
| `vitest` | (comprovar amb `npm ls vitest` — pot ja estar a 4.1.11 al `node_modules` local, però no al lockfile) | Sí (moderate) | `4.1.11`+ |

**Per què `npm audit fix` sense `--force` no fa res sol**: en provar-ho (dry-run, sense aplicar), `npm` reporta warnings `ERESOLVE overriding peer dependency` en tocar el grup `@tiptap/*` — els paquets `@tiptap/extension-bubble-menu`/`floating-menu` (transitius, opcionals via `@tiptap/react`) declaren peers amb versió exacta (`3.31.3`) mentre altres extensions de `starter-kit` en declaren una altra (`3.26.0`), i `npm` no sap triar quina bandada de tiptap instal·lar si les toca d'una en una. La solució és fixar **tots** els paquets `@tiptap/*` directes a la mateixa versió nova alhora (step 2), no deixar que `npm audit fix` ho decideixi paquet a paquet.

**Ús de dompurify/tiptap al codi** (per saber què provar manualment després):
- `src/components/ChangelogPostCard.tsx` — sanititza l'HTML del changelog amb `dompurify` (pla 006).
- `src/components/ChangelogEditor.tsx` — únic fitxer que importa `@tiptap/*` (editor rich-text del changelog).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Estat abans | `npm audit` | 40 vulnerabilitats (baseline) |
| Actualitzar paquets simples dins del rang existent | `npm update postcss vite dompurify vitest` | exit 0 |
| Actualitzar el grup tiptap junt | `npm install @tiptap/react@3.31.3 @tiptap/extension-link@3.31.3 @tiptap/extension-placeholder@3.31.3 @tiptap/starter-kit@3.31.3` | exit 0, sense warnings `ERESOLVE` |
| Typecheck | `npx tsc -b` | exit 0 |
| Lint (baseline coneguda: 232 problemes, no s'espera que aquest pla el canviï) | `npx eslint . 2>&1 \| tail -3` | recompte similar al d'abans, no un salt gran |
| Build | `npm run build` | exit 0 |
| Tests | `npx vitest run --config vite.config.ts` (evita barrejar-se amb `extension/`, vegeu STOP conditions) | passen els tests existents |
| Estat després | `npm audit` | recompte de vulnerabilitats reduït (idealment 0, com a mínim sense `dompurify`/`postcss`/`vite`/`@tiptap/*` a la llista) |

## Suggested executor toolkit

Cap skill especial necessària. Si el runtime executor té accés a `WebSearch`, pot confirmar que `3.31.3` segueix sent l'última versió de `@tiptap/*` en el moment d'executar (pot haver canviat des que es va escriure aquest pla) — si n'hi ha una més nova, agafa-la sempre que sigui `3.x` (compatible amb `^3.26.0`), mai `4.x` sense confirmació prèvia.

## Scope

**In scope**:
- `package.json` (versions de `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/react`, `@tiptap/starter-kit`, `dompurify`, `vite`, `vitest`)
- `package-lock.json` (regenerat automàticament per `npm install`/`npm update`)

**Out of scope** (no ho toquis):
- Qualsevol bump de **major** version (p. ex. si algun paquet només tingués fix disponible a `4.x`/`8.x`/etc. — no n'hi ha cap cas conegut ara, però si `npm view` mostra que cal `--force` per algun paquet concret, atura't i informa en lloc d'aplicar-lo).
- `eslint`, `typescript`, `react`, `@vitejs/plugin-react` — no tenen vulnerabilitats reportades, no els toquis encara que `npm outdated` els llisti com desactualitzats.
- Codi font de `src/`, `supabase/` — aquest pla és només de dependències.

## Git workflow

- Branch: `advisor/012-actualitzar-dependencies`
- Un commit: `fix(deps): actualitzar dependencies amb vulnerabilitats conegudes`
- No facis push ni PR sense instrucció explícita.

## Steps

### Step 1: Baseline

**Verify**: `npm audit 2>&1 | tail -5` → confirma el recompte actual (hauria de dir "40 vulnerabilities" o similar; si diu 0, atura't — vegeu la nota del drift check).

### Step 2: Actualitzar postcss, vite, dompurify, vitest

```bash
npm update postcss vite dompurify vitest
```

**Verify**: `npm ls postcss vite dompurify vitest --depth=0 2>&1 | grep -E "postcss@|vite@|dompurify@|vitest@"` → cap de les quatre ha de mostrar una versió dins del rang vulnerable de "Current state".

### Step 3: Actualitzar el grup `@tiptap/*` junt

```bash
npm install @tiptap/react@3.31.3 @tiptap/extension-link@3.31.3 @tiptap/extension-placeholder@3.31.3 @tiptap/starter-kit@3.31.3
```

**Verify**: cap warning `ERESOLVE` a la sortida. `npm ls @tiptap/core --all 2>&1 | grep "@tiptap/core@"` → totes les ocurrències mostren la mateixa versió (sense "invalid"/conflicte).

### Step 4: Verificació completa

**Verify**: `npx tsc -b` → exit 0.
**Verify**: `npm run build` → exit 0.
**Verify**: `npm audit 2>&1 | tail -5` → recompte de vulnerabilitats clarament reduït respecte al Step 1 (idealment 0; com a mínim, `dompurify`, `postcss`, `vite`, `@tiptap/*` ja no hi apareixen).

## Test plan

No hi ha tests automatitzats de `ChangelogEditor.tsx` (confirmat: 0% de cobertura a `src/`, vegeu l'auditoria de tests separada). Verificació manual per a l'operador, no per l'executor:

1. `npm run build && npm run preview`, obrir la vista d'admin, crear/editar una entrada de changelog amb l'editor TipTap (negreta, enllaç, placeholder) → confirmar que renderitza i desa correctament.
2. Confirmar que `ChangelogPostCard.tsx` segueix sanititzant correctament l'HTML (crear una entrada amb `<script>` al contingut, confirmar que no s'executa al renderitzar-la a la vista pública).

Test automatitzat que **sí** pot córrer l'executor: `npx vitest run` (compte: el finding de tests reporta que aquest comandament actualment també executa 32 fitxers de `extension/` per un problema de configuració no relacionat amb aquest pla — no és responsabilitat d'aquest pla arreglar-ho, però si l'executor veu fallar algun test de `src/` a conseqüència d'aquesta actualització, és un STOP condition).

## Done criteria

- [ ] `npm audit` mostra un recompte de vulnerabilitats clarament inferior al de la baseline (Step 1), idealment 0
- [ ] `dompurify`, `postcss`, `vite` i tots els `@tiptap/*` ja no apareixen a `npm audit`
- [ ] `npx tsc -b` surt amb exit 0
- [ ] `npm run build` surt amb exit 0
- [ ] Cap canvi de major version en cap paquet (comprova `git diff package.json` — només canvien números de patch/minor dins del mateix major)
- [ ] `plans/README.md` actualitzat

## STOP conditions

Atura't i informa (no improvisis) si:
- `npm audit` a l'inici ja mostra 0 vulnerabilitats (la feina ja està feta; marca REJECTED amb aquest motiu).
- Qualsevol dels paquets només té un fix disponible a un **major** superior (`--force` real, no evitable) — informa quin paquet i quina és l'alternativa, no facis el bump de major sense confirmació.
- `npm run build` o `npx tsc -b` falla després dels updates i l'arrel de l'error apunta a un canvi d'API dins de `@tiptap/*` (p. ex. un mètode renombrat a `ChangelogEditor.tsx`) — no "arreglis" l'API a cegues; informa l'error exacte.
- Els tests de `src/` (si n'hi haguessin, o els que apareguin en el futur) fallen després d'aquest pla.

## Maintenance notes

- El `node_modules/` d'aquesta màquina concreta pot ja tenir algunes d'aquestes versions instal·lades per drift local (vegeu "Why this matters") — no et fiïs de `npm ls` abans d'actualitzar el lockfile; confia en `package-lock.json` com a font de veritat.
- Després d'aquest pla, considera afegir `npm audit` (o `npm audit --audit-level=high`) a una CI (vegeu el finding DX-01 de l'auditoria, encara sense pla propi) perquè futures regressions de dependències es detectin abans de merge.
- Si en properes auditories `@tiptap/*` torna a aparèixer amb una vulnerabilitat nova, repeteix el mateix patró: actualitza els 4 paquets directes junts a la mateixa versió, mai un sol paquet tiptap per separat.
