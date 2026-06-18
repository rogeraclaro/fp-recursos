# CONTINUAR — estat de l'execució dels plans /improve

> Fitxer de represa. Llegeix-lo SENCER al començar la propera sessió abans de fer res.
> Última actualització: 2026-06-12. Escrit per Claude (Fable 5).
> Objectiu: reprendre l'execució dels plans d'auditoria exactament des d'on s'ha deixat,
> sense perdre context.

---

## 0. Resum d'una línia

S'estan executant 9 plans de millora (seguretat + DX) generats per la skill `improve`
sobre l'app **fp-recursos** (React 19 + Vite + Supabase). **El pla 001 ja està fet i
integrat. Toca continuar pel pla 002.** Ritme acordat: **un pla cada vegada, amb
checkpoint** (executar → revisar → integrar → resumir → ESPERAR confirmació de l'usuari
abans del següent).

---

## 1. Estat de git EXACTE (crític)

- Repo git: `/Users/rogermasellas/AI/FP Recursos/fp-recursos` (el directori de treball
  primari és el pare `/Users/rogermasellas/AI/FP Recursos`, que NO és git).
- **`main` està INTACTE a `8377124`** — no s'hi ha tocat res. No committegis mai a `main`.
- **Branca de treball: `improve/execute-baseline`** (la branca on s'integra tot). Historial:
  - `e692524` — feat: sistema de changelog (la feina que l'usuari tenia SENSE committejar;
    es va committejar per crear un baseline net). **Aquest és el commit "baseline" al qual
    apunten tots els drift-checks dels plans.**
  - `3f93a1a` — docs: els 9 plans + índex + AUDITORIA-RESUM + PROMPT-EXECUCIO (re-estampats
    de `8377124` a `e692524`).
  - `0972a1a` — fix(security): **pla 001** integrat (cherry-pick del commit de l'executor).
  - `46b121d` — docs(plans): 001 marcat DONE a l'índex. ← **HEAD actual de la branca.**
- Worktree de l'executor del 001 (`.claude/worktrees/agent-a8cf89a004ecc64c0`, branca
  `worktree-agent-a8cf89a004ecc64c0`): ja integrat via cherry-pick; es pot esborrar amb
  `git worktree remove` + `git branch -D` si molesta. No és necessari conservar-lo.
- Untracked sense importància: `.playwright-mcp/*` (logs de debug). IGNORA'LS, no els
  committegis.

**Per verificar l'estat en reprendre:**
```
cd "/Users/rogermasellas/AI/FP Recursos/fp-recursos"
git branch --show-current     # ha de ser improve/execute-baseline
git log --oneline -5          # ha de mostrar 46b121d…e692524
git status --porcelain | grep -v '.playwright-mcp'   # ha d'estar net
```

---

## 2. Regla fonamental (skill improve)

**L'assessor (jo) NO edita codi font.** Cada pla l'executa un **subagent executor** en un
**worktree de git aïllat**; jo el despatxo, reviso el diff i emeto veredicte. Els únics
fitxers que jo edito directament són sota `plans/` (índex, aquest fitxer). Mai faig merge,
push ni commit a `main`.

---

## 3. Flux EXACTE per a cada pla (el que estic seguint)

Per al pla NNN:

1. **Llegir el pla** `plans/NNN-*.md` sencer (estan re-estampats a baseline `e692524`).
2. **Drift check**: `git diff --stat e692524..HEAD -- <paths en scope>` des de la branca
   d'integració. Si els fitxers en scope han canviat respecte als excerpts, reconciliar
   abans (per ara no hauria de passar).
3. **Despatxar UN subagent** `general-purpose` amb `isolation: "worktree"`, model `sonnet`
   (excepte que l'usuari en demani un altre). El prompt ha de contenir:
   - El **text complet del pla inlinat** (el worktree només té fitxers committejats; cal
     inlinar-lo). Per a plans que toquen Edge Functions, recorda que NO hi ha `deno` ni cal
     `node_modules` (verificació per grep). Per a 006/008/009 l'executor SÍ ha de fer
     `npm install` i `npm run build` dins del worktree (worktree fresc = sense node_modules).
   - El preàmbul d'executor (segueix passos, verifica cada un, només fitxers en scope, STOP
     si cal, commit al worktree seguint el git workflow del pla, **SKIP l'actualització de
     plans/README.md** perquè l'índex el mantinc jo, auditar el report contra resultats reals).
   - El format de report: STATUS / STEPS / STOPPED BECAUSE / FILES CHANGED / COMMIT / NOTES.
   - Indica-li que acabi els missatges de commit amb `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
4. **Revisar com a tech lead** (NO em fio del report) al worktree retornat:
   - Re-executar TOTS els done criteria del pla dins del worktree.
   - Scope: `git -C <worktree> diff --stat <baseline>..HEAD` → només fitxers en scope.
   - Llegir el diff complet; jutjar-lo contra "Why this matters" i les convencions del repo.
   - Auditar els tests nous si n'hi ha (que assereixin de debò).
5. **Veredicte**:
   - **APPROVE** → `cd` al repo principal (branca improve/execute-baseline) i
     `git cherry-pick <commit_executor>`; després actualitzar la fila del pla a
     `plans/README.md` (→ DONE) i committejar-ho (`docs(plans): marcar NNN com a DONE`).
   - **REVISE** → `SendMessage` al mateix executor amb feedback concret (màx 2 rondes).
   - **BLOCK** → marcar BLOCKED a l'índex amb motiu; refer el pla amb el que s'ha après.
6. **Resumir a l'usuari** i **PARAR** fins que confirmi (ritme un-a-un acordat).

> Nota sobre cwd/worktree: el `git cherry-pick` de la integració s'ha de fer des del repo
> principal (`/Users/rogermasellas/AI/FP Recursos/fp-recursos`) estant a la branca
> `improve/execute-baseline`. El commit de l'executor (p. ex. `fc8d734` per al 001) té com a
> pare el HEAD de la branca d'integració del moment, així que el cherry-pick aplica net.

---

## 4. Progrés

| Pla | Títol | Estat | Commit integrat |
|-----|-------|-------|-----------------|
| 001 | Unificar nom secret service-role | **DONE** | `0972a1a` |
| 002 | config.toml versionat amb verify_jwt | TODO ← **SEGÜENT** | — |
| 003 | Restringir CORS Edge Functions | TODO | — |
| 004 | Escapar HTML als correus Resend | TODO | — |
| 005 | Validar URL anti-SSRF | TODO | — |
| 006 | Stored XSS al changelog (DOMPurify + migració) | TODO | — |
| 007 | Aplicar desactivació d'editor (login + RLS) | TODO | — |
| 008 | CallMeBot al servidor (treure creds del bundle) | TODO | — |
| 009 | Deixar npm run lint en verd | TODO | — |

L'índex viu i autoritzat és `plans/README.md` (mantén-lo sincronitzat amb aquesta taula).

---

## 5. Ordre recomanat i dependències (de plans/README.md)

- Bloc d'Edge Functions **seqüencial** (solapen fitxers, no en paral·lel):
  `002 → 003 → 004 → 005 → 008`.
- `006` i `007` són independents (frontend + migració pròpia).
- `009` **l'últim** (completa tipus i neteja `as any`; toca serveis que altres plans canvien).
- `006` crea migració `004_escape_bookmark_title_in_changelog.sql`; `007` crea
  `005_enforce_active_on_writes.sql` — numeració única, no dues 004_*.
- `002` abans de `008` (008 registra `notify-admin` a config.toml).
- **006, 008 i 009 necessiten `npm install` + `npm run build` al worktree** (més pesats).

El següent immediat respectant tot això: **pla 002** (`plans/002-config-toml-verify-jwt.md`).

---

## 6. Accions MANUALS pendents de l'usuari (NO són codi; les fa ell al dashboard/CLI)

Acumular-les i recordar-les al final. A mesura que s'integren plans:
- **Pla 001 (ja fet)**: després de `supabase functions deploy`, eliminar el secret
  personalitzat `SERVICE_ROLE_KEY` de Supabase (ja no cal; `SUPABASE_SERVICE_ROLE_KEY` és
  automàtic).
- **Pla 006/007 (quan es facin)**: aplicar les migracions noves `004_*`/`005_*` al SQL
  Editor de Supabase.
- **Pla 008 (quan es faci)**: ROTAR la clau de CallMeBot (va estar exposada al bundle) i
  eliminar-ne els valors literals de `TODO.md`; configurar secrets `CALLMEBOT_PHONE`/
  `CALLMEBOT_APIKEY` (SENSE `VITE_`) a Supabase; `supabase functions deploy notify-admin`.
- **Tots els plans d'Edge Functions**: `supabase functions deploy <funció>` després.
- **Final**: revisar la branca `improve/execute-baseline` i decidir el merge a `main`
  (decisió de l'usuari; jo no faig merge).

---

## 7. Context de l'auditoria (per si cal recordar el perquè)

- Detall complet dels findings i el mapatge finding→pla: `plans/AUDITORIA-RESUM.md`.
- Prompt reutilitzable per a un executor extern: `plans/PROMPT-EXECUCIO.md`.
- Hi havia un `SEGURETAT.md` previ (2026-05-29) del qual només V1 (auth a
  handle-editor-request) estava resolt; aquests plans cobreixen la resta, verificada al codi.
- Findings NO planificats aquesta tanda (rebutjats): #9 baseline de tests al frontend, #10
  refactor d'`App.tsx` (god-component 1.725 línies) — requereixen primer xarxa de tests.

---

## 8. Verificació comuna del repo

- Typecheck: `npx tsc -b` → exit 0
- Lint: `npx eslint .` (parteix de 26 errors; el pla 009 els porta a 0)
- Build: `npm run build` → exit 0
- Tests: `npm run test` (Vitest; no hi ha tests a `src/`, només a `extension/`)
- `npm audit` → 0 vulnerabilitats
- Edge Functions: no es despleguen des d'aquí; verificació per `grep` segons cada pla.

---

## 9. Com reprendre (passos literals la propera sessió)

1. Llegeix aquest fitxer i `plans/README.md`.
2. Confirma l'estat de git (secció 1): branca `improve/execute-baseline`, HEAD `46b121d`
   (o el que indiqui l'índex), working tree net.
3. Obre `plans/002-config-toml-verify-jwt.md`, fes-ne el drift check.
4. Aplica el FLUX de la secció 3 per al pla 002 (despatxar executor en worktree → revisar →
   APPROVE/REVISE/BLOCK → integrar → actualitzar índex → resumir → PARAR i esperar l'usuari).
5. Continua un-a-un amb la resta segons la secció 5.

> Si alguna cosa de l'estat de git no coincideix amb la secció 1 (p. ex. l'usuari ha fet
> canvis entremig), PARA i reconcilia abans d'executar res.
