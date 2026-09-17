# Plan 014: Afegir una CI mínima (typecheck + build + lint no-bloquejant + test) en push/PR

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `ls .github/workflows/` i confirma que només
> hi ha `backup-db.yml`. Si ja existeix un altre workflow de CI, atura't i
> informa en lloc de crear-ne un duplicat.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `6e28e51`, 2026-09-17

## Why this matters

`.github/workflows/` només conté `backup-db.yml`, un cron nocturn de backup de BD sense cap relació amb la qualitat del codi. No hi ha res que executi `tsc -b`, `eslint`, `npm run build` ni `npm run test` en cap push o PR. Els últims 34 commits inclouen 3 arranjaments consecutius del mateix bug a `suggest-resource` (canvis de model a Groq) que van arribar a `main` sense cap comprovació automàtica prèvia — exactament el tipus de regressió que un gate mínim hauria detectat abans del merge, no després. Aquest pla afegeix aquest gate.

## Current state

**`.github/workflows/backup-db.yml`** és l'únic workflow existent (íntegre, per referència d'estil — indentació, `runs-on: ubuntu-latest`, noms de step en català):
```yaml
name: Backup Supabase database

on:
  schedule:
    - cron: '15 3 * * *' # cada dia a les 03:15 UTC
  workflow_dispatch: {} # permet llançar-lo manualment des de GitHub

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Instal·lar client de PostgreSQL
        run: sudo apt-get update && sudo apt-get install -y postgresql-client
      ...
```

**`package.json` scripts** (`npm run <script>`):
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run"
}
```

**Estat actual de cada comanda (verificat en aquesta sessió, 2026-09-17)**:
- `npx tsc -b` → **exit 0**, net.
- `npm run build` (que ja inclou `tsc -b`) → **exit 0**.
- `npx eslint .` → **232 problemes (216 errors, 16 warnings)**. Hi ha un pla separat (`plans/009-arreglar-lint.md`, encara TODO i marcat com a desactualitzat — vegeu la nota de l'auditoria de DX) per portar-ho a 0. Fins que aquell pla no s'executi, **el lint no pot ser un gate bloquejant** sense trencar tots els PRs des del primer dia.
- `npm run test` → executa i passa, però (finding separat, no seleccionat en aquesta tanda) actualment també escaneja per error el sub-projecte `extension/` per una configuració de Vitest sense `include`. No és responsabilitat d'aquest pla arreglar-ho; la CI simplement hereta aquest comportament tal com és avui.

Node local usat en aquest repo: `v22.17.0` (no hi ha `.nvmrc` ni `engines` a `package.json` — es fixa la versió explícitament al workflow per reproduïbilitat).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Validar YAML (si hi ha l'eina) | `command -v yamllint && yamllint .github/workflows/ci.yml` | sense errors (opcional, salta si no hi és) |
| Simular els steps localment abans de fer commit | `npm ci && npx tsc -b && npm run build && npx eslint . ; npm run test` | tsc/build exit 0; eslint pot fallar (esperat, no bloqueja); test passa |

## Scope

**In scope**:
- `.github/workflows/ci.yml` (crear)

**Out of scope** (no ho toquis):
- `.github/workflows/backup-db.yml` — no el toquis ni el renombris.
- Activar "branch protection" / "required status checks" a la configuració del repo de GitHub — això és una acció manual de l'operador des de la UI de GitHub (Settings → Branches), no es pot fer des d'un commit. Documenta-ho a "Maintenance notes", no ho intentis fer.
- Arreglar el lint (`plans/009-*`) o la configuració de Vitest (`vite.config.ts`, finding TEST-01) — són plans separats.

## Git workflow

- Branch: `advisor/014-ci-basica`
- Un commit: `ci: afegir workflow de lint/typecheck/build/test en push i PR`
- No facis push ni PR sense instrucció explícita.

## Steps

### Step 1: Crear el workflow

Crea `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-check:
    runs-on: ubuntu-latest
    steps:
      - name: Clonar el repo
        uses: actions/checkout@v4

      - name: Configurar Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Instal·lar dependències
        run: npm ci

      - name: Typecheck + build
        run: npm run build

      - name: Tests
        run: npm run test

      - name: Lint (no bloquejant fins que plans/009-arreglar-lint.md estigui DONE)
        run: npm run lint
        continue-on-error: true
```

**Verify**: `test -f .github/workflows/ci.yml` → existeix.

### Step 2: Comprovar l'ordre i la sintaxi

**Verify**: revisió manual — la indentació YAML ha de ser consistent (2 espais, com `backup-db.yml`). Si hi ha `yamllint` disponible: `yamllint .github/workflows/ci.yml` → sense errors de sintaxi (avisos d'estil són acceptables).

**Verify**: `git status --short` → només `.github/workflows/ci.yml` com a fitxer nou.

## Test plan

No hi ha manera de "testejar" un workflow de GitHub Actions sense fer-lo córrer a GitHub. Verificació per a l'operador després del push (fora d'abast per a l'executor):

1. Fer push de la branca i obrir un PR de prova (o fer push directe a una branca no protegida) → confirmar a la pestanya "Actions" que el job `build-and-check` s'executa i que "Typecheck + build" i "Tests" passen en verd.
2. Confirmar que el step "Lint" mostra el seu resultat (vermell és esperat avui) però **no** fa fallar el job sencer (gràcies a `continue-on-error: true`).

## Done criteria

- [ ] `.github/workflows/ci.yml` existeix amb els 4 steps (build inclou typecheck, test, lint no-bloquejant)
- [ ] `backup-db.yml` no s'ha tocat
- [ ] Cap altre fitxer modificat
- [ ] `plans/README.md` actualitzat, amb una nota que activar "required status checks" a GitHub és una acció manual pendent de l'operador

## STOP conditions

Atura't i informa (no improvisis) si:
- Ja existeix un altre workflow de CI a `.github/workflows/` (el drift check ho hauria d'haver detectat).
- `npm run build` o `npm run test` fallen en local abans de fer el commit del workflow — no és un problema del workflow, és una regressió real que cal informar, no amagar darrere un `continue-on-error`.
- No tens clar quina versió de Node fixar — utilitza `22` (la usada en aquesta sessió) tret que trobis una raó documentada per triar-ne una altra; si en trobes una, informa-la en lloc de decidir-la silenciosament.

## Maintenance notes

- **Acció manual pendent de l'operador**: un cop aquest workflow s'hagi executat almenys una vegada amb èxit, activar "Require status checks to pass" a GitHub (Settings → Branches → branch protection rule per `main`) per fer-lo realment bloquejant, si es vol.
- Quan `plans/009-arreglar-lint.md` s'executi i el lint quedi en verd, treu el `continue-on-error: true` del step de lint perquè torni a ser un gate real — no ho oblidis, és l'única raó per la qual és no-bloquejant ara.
- Quan es resolgui el finding TEST-01 (Vitest escanejant `extension/` per error), aquest workflow heretarà automàticament el comportament corregit sense necessitat de tocar `ci.yml`.
