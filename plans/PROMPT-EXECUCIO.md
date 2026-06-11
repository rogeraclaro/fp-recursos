# Prompt d'execució — fp-recursos

> Copia el bloc de sota i passa'l a l'agent/model que aplicarà els canvis (Claude Code,
> o el que faci servir). És autocontingut: assumeix que l'executor NO ha vist aquesta
> sessió d'auditoria, només té el repositori i la carpeta `plans/`.

---

```
Ets un enginyer de programari que ha d'implementar una sèrie de plans de millora ja
escrits i autocontinguts. Ruta del projecte: /Users/rogermasellas/AI/FP Recursos/fp-recursos

Els plans viuen a `plans/`, numerats per ordre d'execució (001…009), amb l'índex i les
dependències a `plans/README.md`. Cada pla conté: context inlined, passos amb comandes de
verificació, scope (fitxers dins/fora), criteris de fet machine-checkable i STOP conditions.

REGLES OPERATIVES (no negociables):
1. Treballa UN pla cada vegada, en l'ordre de `plans/README.md`. Llegeix el pla SENCER
   abans de tocar res.
2. Executa el "Drift check" del principi de cada pla. Si un fitxer en scope ha canviat
   respecte als excerpts "Current state", ATURA'T i informa: no improvisis.
3. Després de cada pas, executa la seva comanda de verificació i confirma el resultat
   esperat abans de continuar. No avancis si una verificació falla.
4. Respecta l'scope: modifica NOMÉS els fitxers a "In scope". No toquis els de "Out of
   scope" ni facis neteja/refactor no demanats.
5. Si es compleix qualsevol "STOP condition", atura't i informa amb el que has trobat;
   no inventis una solució.
6. Quan acabis un pla, actualitza la seva fila d'estat a `plans/README.md`
   (TODO → IN PROGRESS → DONE / BLOCKED amb motiu).
7. Comits: un per unitat lògica, amb l'estil de missatges del repo (conventional commits,
   p. ex. `fix(security): …`). NO facis push ni obris cap PR si no t'ho demano
   explícitament. Treballa en una branca, no a la branca principal.

SEQÜENCIACIÓ IMPORTANT (de plans/README.md):
- Els plans 001, 003, 004, 005 i 008 toquen fitxers dins `supabase/functions/`
  (i 003 els toca TOTS). Executa'ls SEQÜENCIALMENT, mai en paral·lel, per evitar
  conflictes de merge.
- 002 abans de 008 (008 registra una funció a supabase/config.toml).
- 009 al final (modifica serveis i tipus que altres plans també toquen).
- 006 i 007 creen migracions noves (004_*.sql i 005_*.sql): mantén numeració única,
  no dues 004_*.

VERIFICACIÓ COMUNA DEL REPO:
- Typecheck: `npx tsc -b` → exit 0
- Lint: `npx eslint .` (parteix de 26 errors; el pla 009 els porta a 0)
- Build: `npm run build` → exit 0
- Tests: `npm run test` (Vitest; no hi ha tests a src/, només a extension/)
Les Edge Functions (supabase/functions/) NO es poden desplegar ni provar des d'aquí: la
verificació és per `grep` segons indica cada pla; el desplegament real (`supabase functions
deploy`) i les proves funcionals les faré jo després.

COMENÇA per `plans/001-unificar-nom-secret-service-role.md`. Quan l'acabis i n'actualitzis
l'estat, atura't i fes-me un resum breu (què has canviat, resultat de les verificacions,
qualsevol cosa a vigilar) abans de passar al següent pla.
```

---

## Variants

**Per executar un sol pla concret** (substitueix l'última instrucció):
> COMENÇA i limita't EXCLUSIVAMENT a `plans/006-stored-xss-changelog.md`. No toquis cap
> altre pla. En acabar, actualitza'n l'estat i fes-me el resum.

**Si uses la skill `improve` integrada** (revisió automàtica del diff per part de
l'assessor, en worktree aïllat):
> /improve execute plans/001-unificar-nom-secret-service-role.md

Aquesta variant desplega un executor més barat sobre el pla en un worktree de git aïllat
i després jo et reviso el diff (re-executo els criteris de fet, comprovo l'scope) i emeto
un veredicte, sense fer merge ni push.

## Recordatori d'accions manuals (NO les fa l'executor)

Aquests passos són teus, al dashboard, i estan documentats dins dels plans corresponents:
- **Pla 008**: rotar la clau de CallMeBot (va estar exposada al bundle) i eliminar-ne els
  valors literals de `TODO.md`. Configurar els secrets `CALLMEBOT_PHONE`/`CALLMEBOT_APIKEY`
  (sense `VITE_`) a Supabase i desplegar `notify-admin`.
- **Plans 006 i 007**: aplicar les migracions noves (`004_*`, `005_*`) al SQL Editor de
  Supabase.
- **Tots els plans d'Edge Functions**: `supabase functions deploy <funció>` després dels
  canvis.
```
