# SEGURETAT — Resolució de vulnerabilitats fp-recursos

> Document generat el 2026-05-29 a partir de l'anàlisi de seguretat del codi font.
> Conté un prompt complet llest per passar a Claude Code o a un agent de seguretat.

---

## Resum de vulnerabilitats trobades

| ID | Severitat | Descripció | Fitxers afectats |
|----|-----------|------------|-----------------|
| V1 | CRÍTICA | `handle-editor-request` sense cap autenticació ni autorització | `supabase/functions/handle-editor-request/index.ts`, `src/services/profiles.ts` |
| V2 | ALTA | Credencials CallMeBot exposades al bundle del navegador | `src/services/contacts.ts`, `src/services/messages.ts`, `src/services/editorRequests.ts` |
| V3 | ALTA | Injecció HTML en correus Resend via camps d'usuari | `supabase/functions/handle-editor-request/index.ts` |
| V4 | MITJANA | SSRF parcial a `suggest-resource` (fetch d'URL sense validació) | `supabase/functions/suggest-resource/index.ts` |
| V5 | MITJANA | CORS totalment obert (`*`) a totes les Edge Functions | Totes les Edge Functions |
| V6 | MITJANA | Validació d'entrada al servidor: només presència, no format/longitud | Totes les Edge Functions |
| V7 | MITJANA | Noms inconsistents del secret de service role entre funcions | Totes les Edge Functions |
| V8 | BAIXA | RLS de 4 taules no versionada (no verificable des del codi) | `supabase/migrations/` |
| V9 | BAIXA | Política de contrasenya: mínim 6 caràcters, només al client | `src/components/SetPasswordModal.tsx`, config Supabase |

---

## Prompt per a l'agent de resolució

```
Ets un enginyer de seguretat sènior. El teu objectiu és resoldre les vulnerabilitats de seguretat
del projecte fp-recursos seguint estrictament les instruccions d'aquest document.

El projecte és una aplicació React 19 + Supabase (PostgreSQL amb RLS + Auth + 5 Deno Edge Functions).
Ruta del projecte: /Users/rogermasellas/AI/FP Recursos/fp-recursos

PRINCIPIS OPERATIUS:
- Modifica ÚNICAMENT els fitxers especificats per cada vulnerabilitat
- No refactoritzis res que no estigui directament relacionat amb la seguretat
- Verifica el codi real ABANS de modificar (llegeix cada fitxer sencer)
- Fes els canvis mínims necessaris per resoldre el problema
- Documenta cada canvi explicant el PER QUÈ (no el QUÈ)
- Segueix l'ordre de prioritat: P0 → P1 → P2 → P3

---

### V1 [P0 — CRÍTICA] Afegir autenticació i autorització a `handle-editor-request`

**Fitxers a modificar:**
- `supabase/functions/handle-editor-request/index.ts`
- `src/services/profiles.ts`

**Problema:**
L'Edge Function `handle-editor-request` no llegeix la capçalera `Authorization`,
no valida cap JWT i no comprova cap rol. Instancia directament un client amb
`SUPABASE_SERVICE_ROLE_KEY` ignorant RLS. Qualsevol persona amb la URL pot
aprovar editors, reactivar comptes i enviar correus de recuperació de contrasenya.

**Solució per a `handle-editor-request/index.ts`:**
Al principi de la funció (ABANS de llegir el body i ABANS de crear el client
service-role), afegir exactament el mateix bloc de verificació que fan
`create-editor`, `delete-editor` i `change-user-password`:

1. Llegir la capçalera `Authorization`: `const authHeader = req.headers.get('Authorization')`
2. Si és null o buida, retornar resposta 401 amb `{ error: 'Missing authorization header' }`
3. Crear un client Supabase amb la clau ANON (no la service role) i el JWT del caller
4. Cridar `supabase.auth.getUser()` per validar el JWT
5. Si la sessió no és vàlida, retornar 401
6. Consultar `profiles` per obtenir el rol del caller: `select role from profiles where id = user.id`
7. Si el rol no és `'admin'`, retornar 403 amb `{ error: 'Forbidden' }`
8. NOMÉS si totes les verificacions passen, continuar amb la lògica actual (crear client service-role, etc.)

Referencia `create-editor/index.ts` línies 36-46 per a la implementació exacta del patró.

**Solució per a `src/services/profiles.ts`:**
A la funció `setUserActive` (o equivalent que invoca `handle-editor-request` amb
`action: 'reactivate'`), afegir la capçalera `Authorization: Bearer ${session.access_token}`
a la crida fetch, igual que fan `createEditor` i `deleteEditor` a `src/services/profiles.ts`.

**Verificació:**
- Comprova que la crida sense `Authorization` retorna 401
- Comprova que una crida amb token d'editor (no admin) retorna 403
- Comprova que una crida amb token d'admin funciona correctament

---

### V1b [P0 — CRÍTICA] Versionar `supabase/config.toml` amb `verify_jwt = true`

**Fitxer a crear:**
- `supabase/config.toml` (si no existeix)

**Problema:**
No hi ha `supabase/config.toml` versionat. Sense aquest fitxer, no hi ha garantia
que les funcions es despleguen amb verificació JWT activada per plataforma.

**Solució:**
Crear `supabase/config.toml` amb la configuració mínima que forci `verify_jwt = true`
per a totes les funcions. Consultar la documentació de Supabase CLI per al format
exacte de `[functions.<nom-funció>] verify_jwt = true`.

Si ja existeix, verificar que NO hi ha cap funció amb `verify_jwt = false`.

---

### V2 [P1 — ALTA] Moure les notificacions CallMeBot al servidor

**Fitxers a modificar:**
- `src/services/contacts.ts` (eliminar crida CallMeBot directa)
- `src/services/messages.ts` (eliminar crida CallMeBot directa)
- `src/services/editorRequests.ts` (eliminar crida CallMeBot directa)
- `supabase/functions/handle-editor-request/index.ts` (afegir notificació si escau)

**Fitxer a crear:**
- `supabase/functions/notify-admin/index.ts` (nova Edge Function)

**Problema:**
`VITE_CALLMEBOT_PHONE` i `VITE_CALLMEBOT_APIKEY` tenen prefix `VITE_`,
cosa que fa que Vite els incruste al bundle JavaScript del navegador. Qualsevol
usuari pot extreure el telèfon i la API key del JS de producció i enviar
notificacions WhatsApp arbitràries a l'admin.

**Solució:**

PAS 1 — Crear nova Edge Function `supabase/functions/notify-admin/index.ts`:
- Ha de requerir autenticació (verificar JWT, qualsevol rol autenticat és acceptable,
  o bé restringir a admin si es vol)
- Acceptar un body `{ message: string }` amb el text de la notificació
- Llegir `CALLMEBOT_PHONE` i `CALLMEBOT_APIKEY` des de `Deno.env.get()` (secrets Supabase)
- Fer la crida HTTP a CallMeBot des del servidor
- Seguir el patró de les altres Edge Functions per a CORS i gestió d'errors

PAS 2 — Modificar els serveis del client:
- A `contacts.ts`, `messages.ts` i `editorRequests.ts`, eliminar les línies que
  construeixen la URL de CallMeBot i fan el `fetch` directe
- Substituir-les per una crida a la nova Edge Function `notify-admin` propagant
  el `access_token` de sessió (com fan `createEditor` i `deleteEditor`)

PAS 3 — Netejar variables d'entorn:
- Eliminar `VITE_CALLMEBOT_PHONE` i `VITE_CALLMEBOT_APIKEY` de `.env.local`
  i de `.env.example` si hi són
- Afegir `CALLMEBOT_PHONE` i `CALLMEBOT_APIKEY` (SENSE prefix VITE_) com a
  secrets de Supabase (via `supabase secrets set` o el dashboard)
- Actualitzar `.env.example` documentant els secrets de servidor necessaris

**Nota:** Després d'aquest canvi, rotar les credencials de CallMeBot al dashboard
de CallMeBot, ja que els valors anteriors han estat exposats en producció.

---

### V3 [P1 — ALTA] Escapar HTML als correus Resend

**Fitxer a modificar:**
- `supabase/functions/handle-editor-request/index.ts`

**Problema:**
Els valors `name`, `userName` i `recoveryUrl` provenen de l'usuari (formulari públic)
i s'interpolen directament dins de plantilles HTML d'email (`html: \`...${name}...\``)
sense escapat. Un atacant pot injectar HTML arbitrari als correus enviats des d'un
domini de confiança.

**Solució:**
Afegir una funció d'escapat HTML a l'inici del fitxer i aplicar-la a TOTS els
valors d'usuari abans d'interpolar-los a les plantilles:

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Aplicar `escapeHtml()` a: `name`, `userName` i qualsevol altre valor de text
d'usuari ABANS d'interpolar-lo als templates HTML. No aplicar a `recoveryUrl`
(URL generada internament per Supabase, no és entrada d'usuari directa, però
sí validar que és una URL HTTPS de Supabase abans d'usar-la).

---

### V4 [P2 — MITJANA] Validar la URL a `suggest-resource` (anti-SSRF)

**Fitxer a modificar:**
- `supabase/functions/suggest-resource/index.ts`

**Problema:**
La funció fa `fetch(url)` d'una URL proporcionada per l'usuari sense validar
l'esquema ni bloquejar adreces internes. Un editor autenticat pot fer que el
servidor faci peticions a adreces internes (p. ex. `http://169.254.169.254/`).

**Solució:**
Afegir una funció de validació d'URL ABANS de cridar `fetchPageContent(url)`:

1. Parsejar la URL: `new URL(url)` (si falla, retornar 400)
2. Verificar que l'esquema és exactament `http:` o `https:`
3. Resoldre el hostname i verificar que la IP resultant NO pertany a:
   - Loopback: `127.0.0.0/8`, `::1`
   - Link-local: `169.254.0.0/16`, `fe80::/10`
   - Privat: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Metadata cloud: `169.254.169.254`
4. Si qualsevol comprovació falla, retornar 400 amb `{ error: 'Invalid or disallowed URL' }`

Nota: a Deno la resolució DNS es fa amb `Deno.resolveDns()`. Si no és disponible
a l'entorn d'Edge Functions, almenys bloquejar per nom d'host els casos més comuns
(`localhost`, `0.0.0.0`, etc.) com a capa mínima.

---

### V5 [P2 — MITJANA] Restringir CORS al domini de producció

**Fitxers a modificar:**
- `supabase/functions/handle-editor-request/index.ts`
- `supabase/functions/suggest-resource/index.ts`
- `supabase/functions/create-editor/index.ts`
- `supabase/functions/delete-editor/index.ts`
- `supabase/functions/change-user-password/index.ts`

**Problema:**
Totes les funcions defineixen `'Access-Control-Allow-Origin': '*'`, cosa que
permet que qualsevol origen web invoqui les funcions des del navegador.

**Solució:**
Substituir `'*'` per `'https://fp-recursos.masellas.info'` a la capçalera CORS
de totes les funcions. Si es necessita suport per a entorns locals de
desenvolupament, afegir lògica per permetre també `http://localhost:5173`
(o el port de dev) ÚNICAMENT quan `Deno.env.get('DENO_ENV') === 'development'`.

Assegura't de canviar-ho en TOTS els llocs on apareix `'*'` dins de cada fitxer
(normalment a l'objecte de capçaleres CORS i a la resposta preflight OPTIONS).

---

### V6 [P2 — MITJANA] Afegir validació de format i longitud al servidor

**Fitxers a modificar:**
- `supabase/functions/create-editor/index.ts`
- `supabase/functions/change-user-password/index.ts`
- `supabase/functions/handle-editor-request/index.ts`
- `supabase/functions/suggest-resource/index.ts`

**Problema:**
Les Edge Functions validen només que els camps existeixin, però no format ni
longitud. No hi ha límits server-side per a textos lliures.

**Solució:**
A cada Edge Function, afegir validació addicional JUST DESPRÉS de la comprovació
d'existència de camps:

- `create-editor`: validar que `email` té format vàlid (regex bàsica o `URL` API)
  i longitud ≤ 254 caràcters; `name` longitud ≤ 100
- `change-user-password`: validar que `password` té longitud ≥ 8 (endurir el mínim
  actual de 6) i ≤ 128 caràcters
- `handle-editor-request`: validar `name`/`userName` ≤ 100 caràcters, `email` format
  vàlid si present
- `suggest-resource`: validar que `url` no supera 2000 caràcters

Retornar 400 amb un missatge descriptiu si la validació falla.

---

### V7 [P2 — MITJANA] Unificar el nom del secret de service role

**Fitxers a modificar:**
- `supabase/functions/create-editor/index.ts`
- `supabase/functions/delete-editor/index.ts`
- `supabase/functions/change-user-password/index.ts`

**Problema:**
`create-editor`, `delete-editor` i `change-user-password` usen
`Deno.env.get('SERVICE_ROLE_KEY')`, mentre que `handle-editor-request` usa
`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`. Noms inconsistents → risc de
misconfiguracio en desplegament.

**Solució:**
Decidir UN sol nom (recomanat: `SUPABASE_SERVICE_ROLE_KEY`, que és el nom
estàndard de Supabase) i actualitzar les tres funcions que usen `SERVICE_ROLE_KEY`
per usar el nom unificat.

Actualitzar també la documentació de desplegament per reflectir el nom correcte.
Verificar que el secret amb el nom correcte existeix a Supabase secrets
(`supabase secrets list`).

---

### V8 [P3 — BAIXA] Versionar l'esquema i les polítiques RLS de les 4 taules no migrades

**Fitxer a crear:**
- `supabase/migrations/002_missing_tables.sql`

**Problema:**
Les taules `messages`, `editor_requests`, `contact_requests` i `editor_highlights`
s'usen als serveis però no apareixen a cap migració. Les seves polítiques RLS no
es poden verificar des del codi i podrien tenir accés públic involuntari.

**Solució:**
Crear una nova migració `supabase/migrations/002_missing_tables.sql` que:

1. Dedueixi l'esquema real de cada taula llegint els serveis que l'usen:
   - `src/services/messages.ts` → estructura de `messages`
   - `src/services/editorRequests.ts` → estructura de `editor_requests`
   - `src/services/contacts.ts` → estructura de `contact_requests`
   - Context d'ús a `App.tsx` → estructura de `editor_highlights`

2. Crei les taules amb `CREATE TABLE IF NOT EXISTS` (idempotent, no trencarà producció)

3. Activi RLS: `ALTER TABLE <nom> ENABLE ROW LEVEL SECURITY`

4. Defineixi polítiques RLS conservadores (mínim privilegi):
   - `messages`: SELECT restringit a `sender_id = auth.uid()` OR `recipient_id = auth.uid()`
   - `editor_requests`: SELECT restringit a `user_id = auth.uid()` O admin; INSERT per a tothom
   - `contact_requests`: INSERT per a tothom; SELECT ÚNICAMENT admin
   - `editor_highlights`: totes les operacions restringides a `user_id = auth.uid()`

5. Afegir la columna `admin_reviewed` a `bookmarks` si no existeix:
   `ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS admin_reviewed boolean DEFAULT false`

**IMPORTANT:** Verificar PRIMER les polítiques reals al dashboard de Supabase
per no crear conflictes amb polítiques ja existents. Si ja existeixen, documentar-les
en comentaris SQL a la migració.

---

### V9 [P3 — BAIXA] Endurir la política de contrasenya

**Fitxer a modificar:**
- `src/components/SetPasswordModal.tsx`

**Acció al dashboard Supabase:**
- Accedir a Authentication > Policies al projecte Supabase
- Configurar longitud mínima de contrasenya: 8 caràcters (en lloc de 6)
- Activar requisit de complexitat si l'opció és disponible

**Solució al codi:**
A `SetPasswordModal.tsx`, actualitzar la validació client-side per ser coherent
amb la política del servidor:
- Canviar la validació de longitud mínima de 6 a 8 caràcters
- Afegir un missatge d'error clar si no es compleix

---

## Ordre d'execució recomanat

```
Ordre     Acció                                    Risc de regressió
────────────────────────────────────────────────────────────────────
1         V1  — Auth a handle-editor-request        Baix (afegir verificació)
2         V1b — Crear supabase/config.toml          Molt baix (nou fitxer)
3         V3  — Escapat HTML correus                Molt baix (sanitització)
4         V7  — Unificar nom secret service role    Baix (canvi de string)
5         V5  — Restringir CORS                     Baix (si el domini és correcte)
6         V4  — Validació URL anti-SSRF             Baix (afegir validació)
7         V6  — Validació format/longitud           Baix (afegir validació)
8         V2  — Moure CallMeBot al servidor         Mitjà (nova funció + canvi serveis)
9         V8  — Migració RLS taules                 Mitjà (verificar vs dashboard)
10        V9  — Política contrasenya                Molt baix
```

## Verificació final

Un cop aplicats tots els canvis, verificar:

- [ ] Una petició HTTP directa a `handle-editor-request` SENSE capçalera `Authorization` retorna 401
- [ ] Una petició amb token d'editor (no admin) retorna 403
- [ ] L'aprovació d'un editor funciona correctament des de la UI d'admin
- [ ] La reactivació d'un editor funciona correctament
- [ ] Les notificacions WhatsApp s'envien correctament (ara des del servidor)
- [ ] El bundle JS de producció NO conté `callmebot`, `apikey` ni el número de telèfon
- [ ] Totes les Edge Functions accepten peticions des de `fp-recursos.masellas.info`
- [ ] Cap Edge Function accepta peticions cross-origin des d'un altre domini (provar amb `curl -H "Origin: https://atacant.com"`)
- [ ] `supabase secrets list` mostra `SUPABASE_SERVICE_ROLE_KEY` (nom unificat)
- [ ] La migració `002_missing_tables.sql` s'aplica sense errors
```
