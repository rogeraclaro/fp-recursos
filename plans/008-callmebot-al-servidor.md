# Plan 008: Moure les notificacions de CallMeBot al servidor (treure credencials del bundle)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- src/services/ supabase/functions/`
> If any in-scope file changed since this plan was written, compare against the
> "Current state" excerpts before proceeding; on a mismatch, treat it as a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: idealment 002 (config.toml) per registrar la nova funció; si 002 no s'ha fet, aquest pla crea/edita config.toml igualment
- **Category**: security
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

Les credencials de CallMeBot (telèfon + API key) es llegeixen al client amb el prefix `VITE_`, cosa que fa que **Vite les incrusti al bundle JavaScript de producció**. Qualsevol persona pot obrir el JS servit, extreure el número i la clau, i enviar notificacions de WhatsApp arbitràries a l'admin (spam, phishing dirigit). Aquest pla mou la crida a CallMeBot a una Edge Function que llegeix les credencials de secrets del servidor, de manera que el bundle del navegador deixa de contenir-les. Com que aquestes credencials ja han estat exposades en producció, **s'han de rotar** (veure pas final).

> **Avís de credencials exposades**: el fitxer `TODO.md` del repositori conté els valors literals de `VITE_CALLMEBOT_PHONE` i `VITE_CALLMEBOT_APIKEY` en text pla (committejats). A part d'aquest pla, cal rotar la clau de CallMeBot i eliminar aquests valors de `TODO.md` i de l'historial si cal. NO copiïs aquests valors enlloc.

## Current state

**Dos llocs al client fan la crida directa a CallMeBot:**

`src/services/notify.ts` (usat per `messages.ts`, `editorRequests.ts`, `bookmarks.ts`, `categories.ts`):
```ts
export async function notifyWhatsApp(text: string): Promise<void> {
  const phone = import.meta.env.VITE_CALLMEBOT_PHONE
  const apikey = import.meta.env.VITE_CALLMEBOT_APIKEY
  if (!phone || !apikey) return
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apikey}`
  try {
    await fetch(url, { mode: 'no-cors' })
  } catch {
    // best-effort
  }
}
```

`src/services/contacts.ts:33-46` té una segona còpia (`sendWhatsApp`) amb la mateixa lògica, cridada des de `submitContact` (línia 9).

**Cridants de `notifyWhatsApp`** (no cal tocar-los, segueixen cridant la mateixa firma):
- `src/services/messages.ts:32` — `await notifyWhatsApp('💬 Nou missatge a fp-recursos')`
- `src/services/editorRequests.ts:15` — `await notifyWhatsApp(text)`
- `src/services/bookmarks.ts:24` — `await notifyWhatsApp(...)`
- `src/services/categories.ts:22` — `await notifyWhatsApp(...)`

**Patró d'Edge Function existent** (referència per a CORS/auth): `supabase/functions/create-editor/index.ts`.

**Camí anònim important:** `submitContact` (formulari de contacte) i `submitEditorRequest` (sol·licitud d'editor) els executen **visitants sense sessió**. Per tant la nova funció ha de poder ser invocada sense JWT d'usuari (veure pas 1, decisió de `verify_jwt`). La invocació via `supabase.functions.invoke` adjunta automàticament la clau `anon` (que ja és pública per disseny), de manera que la funció és cridable per qualsevol però **sense exposar les credencials de CallMeBot**, que és l'objectiu.

**Stack:** Vite + npm. Build: `npm run build`. Variables al client: `import.meta.env.VITE_*`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Cap VITE_CALLMEBOT al client | `grep -rn "VITE_CALLMEBOT" src/` | cap match (exit 1) |
| Funció nova present | `ls supabase/functions/notify-admin/index.ts` | existeix |
| Build | `npm run build` | exit 0 |
| Bundle net | `grep -rl "callmebot" dist/ 2>/dev/null` | cap resultat |

## Scope

**In scope** (modificar/crear):
- `supabase/functions/notify-admin/index.ts` — **crear**.
- `src/services/notify.ts` — invocar la nova funció en lloc del fetch directe.
- `src/services/contacts.ts` — substituir la còpia `sendWhatsApp` per una crida a `notifyWhatsApp`.
- `.env.example` — eliminar les variables `VITE_CALLMEBOT_*` i documentar els secrets de servidor.
- `supabase/config.toml` — afegir el bloc `[functions.notify-admin]` (crea el fitxer si no existeix; si el pla 002 ja el va crear, només afegeix el bloc).

**Out of scope** (NO tocar):
- `messages.ts`, `editorRequests.ts`, `bookmarks.ts`, `categories.ts` — segueixen cridant `notifyWhatsApp(text)` sense canvis.
- Les altres Edge Functions.
- `TODO.md` — la neteja dels valors exposats i la rotació són accions de l'operador (documenta-les al PR), no codi d'aquest pla.

## Git workflow

- Branch: `advisor/008-callmebot-al-servidor`
- Commits per unitat: funció nova / canvis al client / config+env. Estil: `feat(security): afegir Edge Function notify-admin` / `fix(security): treure credencials CallMeBot del client`
- No push ni PR sense instrucció.

## Steps

### Step 1: Crear l'Edge Function `notify-admin`

Crea `supabase/functions/notify-admin/index.ts`. Llegeix `CALLMEBOT_PHONE` i `CALLMEBOT_APIKEY` (SENSE prefix `VITE_`) de `Deno.env`, accepta un body `{ message: string }`, valida longitud, i fa la crida a CallMeBot des del servidor. CORS restringit al domini de producció (coherent amb pla 003).

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://fp-recursos.masellas.info',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { message } = await req.json()
    if (typeof message !== 'string' || message.length === 0 || message.length > 1000) {
      return new Response(JSON.stringify({ error: 'Missatge invàlid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const phone = Deno.env.get('CALLMEBOT_PHONE')
    const apikey = Deno.env.get('CALLMEBOT_APIKEY')
    if (!phone || !apikey) {
      // Notificació best-effort: si no està configurat, no és un error per al caller.
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apikey}`
    try {
      await fetch(url)
    } catch {
      // best-effort; no propaguem l'error
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const m = err instanceof Error ? err.message : 'Error desconegut'
    return new Response(JSON.stringify({ error: m }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Decisió `verify_jwt`** (pas 4): aquesta funció s'invoca també des de fluxos **anònims** (contacte, sol·licitud d'editor), per tant ha de tenir `verify_jwt = false`. La protecció contra abús és la validació de longitud + el fet que CallMeBot és best-effort; les credencials, que era el que es filtrava, queden al servidor. (Rate-limiting és un follow-up.)

**Verify**: `ls supabase/functions/notify-admin/index.ts` → existeix.

### Step 2: Reescriure `notify.ts` per invocar la funció

Substitueix tot el cos de `src/services/notify.ts` per una invocació a l'Edge Function via el client Supabase:

```ts
import { supabase } from '../lib/supabase'

export async function notifyWhatsApp(text: string): Promise<void> {
  try {
    await supabase.functions.invoke('notify-admin', { body: { message: text } })
  } catch {
    // best-effort: la notificació no ha de bloquejar el flux principal
  }
}
```

`supabase.functions.invoke` adjunta automàticament la clau `anon`, així que funciona tant per a usuaris autenticats com anònims.

**Verify**: `grep -n "VITE_CALLMEBOT" src/services/notify.ts` → cap match. `grep -n "functions.invoke('notify-admin'" src/services/notify.ts` → 1 match.

### Step 3: Fer que `contacts.ts` usi `notifyWhatsApp`

A `src/services/contacts.ts`:
1. Afegeix l'import: `import { notifyWhatsApp } from './notify'`.
2. Elimina la funció local `sendWhatsApp` (línies ~33-46) i la seva crida a `import.meta.env.VITE_CALLMEBOT_*`.
3. A `submitContact`, substitueix `await sendWhatsApp(name, email, message)` per:
   ```ts
   await notifyWhatsApp(`📩 Nou contacte SSCE0110:\n👤 ${name}\n📧 ${email}\n💬 ${message}`)
   ```

**Verify**: `grep -n "VITE_CALLMEBOT\|sendWhatsApp" src/services/contacts.ts` → cap match. `grep -rn "VITE_CALLMEBOT" src/` → cap match a tot `src/`.

### Step 4: Registrar la funció a `config.toml`

A `supabase/config.toml` (creat al pla 002, o crea'l si no existeix), afegeix:
```toml
[functions.notify-admin]
verify_jwt = false
```
Aquesta és l'**única** funció amb `verify_jwt = false`, justificat perquè s'invoca des de fluxos anònims i no exposa secrets.

**Verify**: `grep -A1 "functions.notify-admin" supabase/config.toml` → mostra `verify_jwt = false`.

### Step 5: Netejar `.env.example`

A `.env.example`, elimina qualsevol línia `VITE_CALLMEBOT_PHONE` / `VITE_CALLMEBOT_APIKEY` si hi són, i afegeix un comentari documentant que les notificacions de WhatsApp ara es configuren com a **secrets de Supabase** (`CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY`, sense prefix `VITE_`), no com a variables del client.

(El `.env.example` actual conté només `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`; potser no hi ha res a eliminar — només afegeix el comentari de documentació.)

**Verify**: `grep -n "VITE_CALLMEBOT" .env.example` → cap match.

### Step 6: Build i comprovació del bundle

**Verify**:
- `npm run build` → exit 0.
- `grep -rl "callmebot" dist/` → cap resultat (les credencials i la URL ja no són al bundle).

## Test plan

No hi ha tests automatitzats per a Edge Functions ni serveis. Verificació funcional (operador), després de:
1. Desplegar: `supabase functions deploy notify-admin`.
2. Configurar secrets: `supabase secrets set CALLMEBOT_PHONE=<nou> CALLMEBOT_APIKEY=<nova-clau-rotada>`.

Casos:
- Enviar el formulari de contacte (com a visitant anònim) → l'admin rep la notificació de WhatsApp.
- Crear un recurs com a editor → l'admin rep la notificació.
- Inspeccionar el bundle de producció (DevTools → Sources) → no apareix `callmebot`, ni el telèfon, ni la clau.

## Done criteria

ALL must hold:

- [ ] `supabase/functions/notify-admin/index.ts` existeix i llegeix `CALLMEBOT_*` de `Deno.env`
- [ ] `grep -rn "VITE_CALLMEBOT" src/` → cap match
- [ ] `grep -n "functions.invoke('notify-admin'" src/services/notify.ts` → 1 match
- [ ] `supabase/config.toml` té `[functions.notify-admin]` amb `verify_jwt = false`
- [ ] `npm run build` exit 0 i `grep -rl "callmebot" dist/` → cap resultat
- [ ] `git status --porcelain` mostra només els fitxers en scope
- [ ] Fila d'estat de 008 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- Algun cridant de `notifyWhatsApp` passa més d'un argument o espera un retorn diferent de `void` (la firma ha de quedar idèntica: `notifyWhatsApp(text: string): Promise<void>`).
- `contacts.ts` té lògica addicional dins `sendWhatsApp` més enllà de la crida a CallMeBot (no és el cas a l'excerpt, però verifica abans d'eliminar-la).
- L'operador confirma que la funció NO ha de ser invocable anònimament (llavors els fluxos de contacte/sol·licitud d'editor perdrien la notificació, o caldria una arquitectura amb trigger/webhook de DB — reporta aquesta disjuntiva en lloc de decidir-la).

## Maintenance notes

- **Rotació obligatòria** (acció de l'operador, no de codi): les credencials de CallMeBot van estar al bundle; cal generar una clau nova a callmebot.com i actualitzar el secret de Supabase. La clau antiga s'ha de considerar compromesa. Eliminar també els valors literals de `TODO.md`.
- Tota notificació futura (email, Telegram, etc.) hauria de passar per `notify-admin` o una funció germana, mai per credencials al client.
- En revisió del PR: confirmar que cap `import.meta.env.VITE_CALLMEBOT*` queda al codi i que el bundle (`dist/`) està net.
- Follow-up diferit: rate-limiting a `notify-admin` per evitar spam (ara mateix és best-effort sense límit de freqüència).
