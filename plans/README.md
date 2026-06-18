# Implementation Plans

Generats per la skill `improve` el 2026-06-11, contra el commit `e692524`.
Cada pla és **autocontingut**: un executor sense context d'aquesta sessió ha de
poder-lo executar només amb el fitxer del pla i el repositori. Executa en l'ordre
de sota tret que les dependències diguin el contrari. Cada executor: llegeix el
pla sencer abans de començar, respecta les seves STOP conditions, i actualitza la
seva fila quan acabi.

Context d'origen: auditoria de seguretat/qualitat sobre una app React 19 + Vite +
Supabase (5 Edge Functions Deno). Hi havia un `SEGURETAT.md` previ (2026-05-29)
del qual només V1 estava resolt; aquests plans cobreixen la resta verificada al codi.

## Ordre d'execució i estat

| Pla | Títol | Prioritat | Esforç | Depèn de | Estat |
|-----|-------|-----------|--------|----------|-------|
| 001 | Unificar nom secret service-role | P1 | S | — | DONE |
| 002 | `config.toml` versionat amb `verify_jwt` | P2 | S | — | DONE |
| 003 | Restringir CORS de les Edge Functions | P2 | S | — | TODO |
| 004 | Escapar HTML als correus Resend | P1 | S | — | TODO |
| 005 | Validar URL anti-SSRF a `suggest-resource` | P2 | S–M | — | TODO |
| 006 | Tancar Stored XSS al changelog públic | P1 | M | — | TODO |
| 007 | Aplicar de debò la desactivació d'editor | P1 | M | — | TODO |
| 008 | Moure CallMeBot al servidor (treure creds del bundle) | P1 | M | 002 (recomanat) | TODO |
| 009 | Deixar `npm run lint` en verd | P2 | M | 006/007/008 (recomanat) | TODO |

Valors d'estat: TODO | IN PROGRESS | DONE | BLOCKED (amb motiu d'una línia) | REJECTED (amb motiu).

## Notes de dependències i seqüenciació

- **Solapament de fitxers a les Edge Functions**: 001, 003, 004, 005 i 008 toquen
  fitxers dins `supabase/functions/`, i 003 toca **totes** les funcions. Per evitar
  conflictes de merge, executa aquests plans **seqüencialment** (no en paral·lel),
  preferiblement en l'ordre 001 → 002 → 003 → 004 → 005 → 008.
- **002 abans de 008**: 008 registra la funció `notify-admin` a `supabase/config.toml`;
  si 002 ja ha creat el fitxer, 008 només hi afegeix un bloc. Si 002 no s'ha fet,
  008 crea el fitxer igualment (amb el bloc de `notify-admin`).
- **009 després de 006/007/008**: aquests modifiquen serveis i `src/types/database.ts`;
  fer 009 (que completa els tipus i neteja `as any`) al final evita re-treballar.
- **006 i 007 creen migracions noves** (`004_...`, `005_...`). Si tots dos s'executen,
  mantenen numeració monòtona: 006 crea `004_escape_bookmark_title_in_changelog.sql`,
  007 crea `005_enforce_active_on_writes.sql`. Si l'ordre real difereix, renumera
  perquè no col·lisionin (no hi pot haver dues `004_*`).
- Plans independents sense solapament: 006 (frontend + migració) i 007 (frontend +
  migració) es poden fer en paral·lel entre ells i amb el bloc d'Edge Functions,
  vigilant només la numeració de migracions.

## Verificació comuna (recon)

- Typecheck: `npx tsc -b` → exit 0
- Lint: `npx eslint .` (actualment 26 errors; el pla 009 ho posa a 0)
- Build: `npm run build` → exit 0
- Tests: `npm run test` (Vitest; **no hi ha tests a `src/`**, només a `extension/`)
- `npm audit` → 0 vulnerabilitats (juny 2026)
- Edge Functions: no es poden desplegar en revisió; verificació per `grep` + prova
  funcional manual de l'operador després de `supabase functions deploy`.

## Findings considerats i rebutjats

- **Refactor d'`App.tsx` (god-component, 1.725 línies, 41 useState)**: real i de valor,
  però esforç L i risc MED **sense xarxa de tests** (no n'hi ha a `src/`). No s'ha
  convertit en pla en aquesta tanda; requereix primer un baseline de tests. El pla 009
  deixa `TODO(refactor App.tsx)` localitzats als punts que el lint assenyala.
- **Baseline de tests al frontend**: prerequisit del refactor anterior; no seleccionat
  per l'usuari en aquesta tanda. Recomanat com a primer pas si s'aborda `App.tsx`.
- **Consolidar `notifyWhatsApp` duplicat**: ja el resol el pla 008 (unifica `contacts.ts`
  amb `notify.ts`). No cal pla separat.
- **Patró `supabase.from(...) as any` als serveis**: ja el resol el pla 009 (completa
  el tipus `Database`). No cal pla separat.
- **Migració a React Router**: l'app fa routing per estat (`view`) intencionadament;
  no és un defecte. No es planifica.
- **Warnings `react-hooks/exhaustive-deps` (MessagesModal, EditorView)**: warnings, no
  bloquegen el lint; deute menor, deixat com a follow-up dins del pla 009.

## Findings de direcció (opcions de producte, no problemes — sense pla)

Anotats per al mantenidor; no s'han convertit en plans (no seleccionats):
- Notificacions per email a l'admin (Resend ja configurat; el `TODO.md` ja ho llista).
- Filtre de recursos per autor a la vista pública (`bookmark.profiles` ja es carrega).
- Generalitzar `notify-admin` (creada al pla 008) a més canals (email/Telegram).
