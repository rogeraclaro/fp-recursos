# Auditoria fp-recursos — Resum executiu

> Generat per la skill `improve` (mode assessor, read-only sobre codi font).
> Data: 2026-06-11. Commit auditat: `e692524`.
> Els plans d'implementació autocontinguts viuen a `plans/001-*.md` … `plans/009-*.md`
> (vegeu `plans/README.md` per a l'ordre d'execució i dependències).

---

## Prompt inicial

```
/improve
```

Invocació base de la skill `improve`: auditoria completa (recon → audit en paral·lel →
vet/prioritzar → escriure plans). Sense focus argument ni nivell d'esforç → nivell
`standard` per defecte, totes nou categories d'auditoria (correctesa, seguretat,
rendiment, cobertura de tests, deute tècnic, dependències, DX, docs, direcció).

**Decisió de l'usuari** (quins findings convertir en plans):
> Els 4 de seguretat alta (1,2,3,4) · Quick wins seguretat (6,7,8,11) · Lint trencat (5)

Resultat: 9 plans escrits (findings 1–8 + 11 + 5). Els findings 9 (baseline de tests)
i 10 (refactor d'`App.tsx`) NO es van seleccionar; queden documentats com a rebutjats
en aquesta tanda a `plans/README.md`.

---

## Context del recon

App React 19 + Vite 7 + TypeScript + Supabase (PostgreSQL + Auth + RLS + 5 Edge
Functions Deno) + una extensió de navegador a part. ~5.100 línies a `src/`.

Estat de les comprovacions en el moment de l'auditoria:
- **Typecheck** (`npx tsc -b`): passa (exit 0).
- **`npm audit`**: 0 vulnerabilitats.
- **`npm run lint`** (`eslint .`): **falla amb 26 errors** + 2 warnings.
- **`npm run test`** (Vitest): **cap test a `src/`** (només n'hi ha a `extension/`).

Document previ `SEGURETAT.md` (2026-05-29) llistava 9 vulnerabilitats; **només V1
(auth a `handle-editor-request`) estava resolta**. La resta es van verificar al codi.

---

## Findings prioritzats (vetats al codi)

| # | Finding | Categoria | Impacte | Esforç | Risc fix | Confiança | Evidència |
|---|---------|-----------|---------|--------|----------|-----------|-----------|
| 1 | **Stored XSS al changelog públic** via títol de bookmark | Seguretat | Qualsevol editor pot injectar HTML/script que s'executa a tots els visitants públics | M | MED | **ALTA** | `003_auto_post_bookmark_trigger.sql` (insereix `NEW.title` cru a HTML) → `ChangelogPostCard.tsx:56` `dangerouslySetInnerHTML` |
| 2 | **Credencials CallMeBot al bundle** (V2, no resolt) | Seguretat | Telèfon + API key visibles al JS de producció; qualsevol pot enviar WhatsApps arbitraris | M | MED | **ALTA** | `services/notify.ts:2-3`, `services/contacts.ts:34-35` (prefix `VITE_`) |
| 3 | **Desactivació d'editor és cosmètica** (no s'aplica) | Correctesa/Authz | Un editor "desactivat" segueix podent crear/editar els seus recursos: cap bloqueig al login ni a RLS | M | MED | **ALTA** | `AuthContext.tsx` (sense check `active`), `001_initial_schema.sql` RLS (policies només miren `user_id`/`role`) |
| 4 | **Injecció HTML als emails Resend** (V3, no resolt) | Seguretat | `name`/`userName` de formulari públic s'interpolen crus a l'HTML de l'email | S | BAIX | **ALTA** | `handle-editor-request/index.ts:116,193,230` |
| 5 | **`npm run lint` trencat (26 errors)** | DX | No es pot usar com a gate de CI; 15 són `no-explicit-any` que amaguen tipus de BD | S–M | BAIX | **ALTA** | `eslint .` → 26 errors a serveis + Edge Functions |
| 6 | **Nom del secret service-role inconsistent** (V7) | Seguretat/DX | 3 funcions usen `SERVICE_ROLE_KEY`, 1 usa `SUPABASE_SERVICE_ROLE_KEY` → risc de fallada silenciosa en deploy | S | BAIX | **ALTA** | `create-editor:58`, `delete-editor:69`, `change-user-password:56` vs `handle-editor-request:55` |
| 7 | **SSRF a `suggest-resource`** (V4, no resolt) | Seguretat | Editor autenticat pot fer que el servidor faci `fetch` a IPs internes (metadata cloud) | S–M | BAIX | MED | `suggest-resource/index.ts:37-53,87` (cap validació d'URL) |
| 8 | **CORS `*` a totes les Edge Functions** (V5) | Seguretat | Qualsevol origen web pot invocar les funcions | S | BAIX | MED | `Allow-Origin: '*'` a les 5 funcions |
| 9 | **Zero tests a `src/`** | Test coverage | `App.tsx` (1.725 línies) i tots els serveis sense cap test; `npm run test` no valida res del frontend | L | BAIX | **ALTA** | `find src -name '*.test.*'` → buit |
| 10 | **`App.tsx` god-component (1.725 línies, 41 useState)** | Tech debt | Tota la lògica de vista, dades i UI en un fitxer; difícil de provar i mantenir | L | MED | MED | `src/App.tsx` |
| 11 | **`config.toml` no versionat** (V1b) | Seguretat/DX | Sense fitxer, no hi ha garantia de `verify_jwt=true` en deploy | S | BAIX | MED | `supabase/config.toml` no existeix |

### Findings de direcció (opcions de producte, no problemes)

- **Notificacions per email a l'admin** — el `TODO.md` ja ho llista com a idea i Resend
  ja està configurat i funcionant. La canonada (Edge Function + Resend) ja existeix.
- **Filtre de recursos per autor a la vista pública** — la dada (`bookmark.profiles`) ja
  es carrega i es mostra a les cards; el filtre és quasi gratis sobre l'estat existent.
- **Server-side genèric per a notificacions** — un cop fet el finding 2, una `notify-admin`
  Edge Function genèrica deixa la porta oberta a més canals (email, Telegram) sense tocar
  el client.

---

## Mapatge finding → pla

| Finding | Pla |
|---|---|
| 1 (Stored XSS) | `plans/006-stored-xss-changelog.md` |
| 2 (CallMeBot al bundle) | `plans/008-callmebot-al-servidor.md` |
| 3 (Desactivació cosmètica) | `plans/007-aplicar-desactivacio-editor.md` |
| 4 (HTML als emails) | `plans/004-escapar-html-emails-resend.md` |
| 5 (Lint trencat) | `plans/009-arreglar-lint.md` |
| 6 (Nom secret) | `plans/001-unificar-nom-secret-service-role.md` |
| 7 (SSRF) | `plans/005-validar-url-anti-ssrf.md` |
| 8 (CORS) | `plans/003-restringir-cors-edge-functions.md` |
| 11 (config.toml) | `plans/002-config-toml-verify-jwt.md` |
| 9, 10 | No planificats (vegeu "rebutjats" a `plans/README.md`) |

---

## Resum final lliurat

### Tres coses que cal saber

1. **`SEGURETAT.md` estava majoritàriament sense resoldre.** Només V1 (auth a
   `handle-editor-request`) està fet. La resta de vulnerabilitats que llistava segueixen
   vives — verificat al codi, no al document. Els plans 003–008 les cobreixen.

2. **Credencials de CallMeBot exposades en text pla al `TODO.md` committejat** (a banda
   del bundle). El pla 008 ho gestiona a nivell de codi, però **cal rotar la clau de
   CallMeBot i netejar `TODO.md`** — accions de l'operador al dashboard, no del codi.
   Els valors no s'han reproduït enlloc.

3. **El refactor d'`App.tsx` (1.725 línies) NO té pla i és deliberat.** Sense tests a
   `src/` és massa arriscat; primer caldria un baseline de tests. El pla 009 hi deixa
   `TODO(refactor App.tsx)` localitzats en lloc d'amagar els avisos estructurals de
   `react-hooks`. El primer pas, si s'aborda, és el baseline de tests (finding 9).

### Nota d'execució

Els plans 001, 003, 004, 005 i 008 toquen fitxers dins `supabase/functions/` (i 003 els
toca tots): **executa'ls seqüencialment**, no en paral·lel, per evitar conflictes de
merge. 006 i 007 creen migracions noves (`004_*` i `005_*`) — vigila la numeració si
canvies l'ordre. Detall complet a `plans/README.md`.

Cap fitxer de codi font modificat durant l'auditoria: tota la sortida viu sota `plans/`.
Per executar un pla amb revisió integrada: `/improve execute plans/<fitxer>.md`.
