# Plan 004: Escapar HTML als correus de Resend a `handle-editor-request`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- supabase/functions/handle-editor-request/`
> If the file changed since this plan was written, compare against the "Current
> state" excerpts before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (si executes 003 abans, toca el mateix fitxer — fes-ho seqüencialment)
- **Category**: security
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

La funció `handle-editor-request` interpola valors d'usuari (`name`, `userName`) directament dins de plantilles HTML d'email que envia via Resend, sense escapar-los. Els valors `name`/`email` provenen del formulari públic de sol·licitud d'editor (`editor_requests`, on l'INSERT és públic — qualsevol visitant pot enviar-ne). Un atacant pot posar HTML arbitrari al camp `name` (p. ex. `<a href="https://phishing">Clica aquí</a>` o etiquetes que trenquin el disseny) i aquest HTML s'enviarà incrustat en un correu que surt d'un domini de confiança (`noreply@masellas.info`). Això habilita phishing i spoofing de contingut amb la reputació del teu domini. Escapar els valors d'usuari abans d'interpolar-los elimina el vector.

## Current state

Fitxer: `supabase/functions/handle-editor-request/index.ts` (262 línies). Tres punts on s'interpola valor d'usuari cru a HTML:

- Línia 116 (branca `approve`, usuari ja existent — reactivació):
  ```ts
                  <p style="margin: 0 0 16px; font-size: 15px;">Hola ${name},</p>
  ```
  `name` ve del body de la petició (`const { action, requestId, email, name, userId } = await req.json()`, línia 51), originat al formulari públic.

- Línia 193 (branca `reactivate`):
  ```ts
                <p style="margin: 0 0 16px; font-size: 15px;">Hola ${userName},</p>
  ```
  `userName` ve de `userData.user.user_metadata?.username ?? userEmail` (línia 163).

- Línia 230 (branca `reject`):
  ```ts
            <p>Hola ${name},</p>
  ```

`recoveryUrl` (línies 123, 131, 196, 200) ve de `linkData.properties?.action_link`, generat internament per Supabase — **no és entrada d'usuari directa**, no l'escapis com a text (és un atribut `href`); veure STOP conditions.

No hi ha cap funció d'escapat al fitxer actualment.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Funció escape present | `grep -n "function escapeHtml" supabase/functions/handle-editor-request/index.ts` | 1 match |
| Interpolacions escapades | `grep -n "escapeHtml(" supabase/functions/handle-editor-request/index.ts` | 4 línies (1 def + 3 crides) |
| Cap `${name}` cru restant | `grep -n '\${name}' supabase/functions/handle-editor-request/index.ts` | cap (exit 1) |

## Scope

**In scope** (modificar):
- `supabase/functions/handle-editor-request/index.ts`

**Out of scope** (NO tocar):
- Les altres Edge Functions.
- La lògica d'auth, invite, reactivació, o el cos de la petició — només l'escapat de valors a les plantilles HTML.
- `recoveryUrl` com a text visible (és una URL de Supabase; veure STOP conditions per a la validació opcional).

## Git workflow

- Branch: `advisor/004-escapar-html-emails`
- Un sol commit: `fix(security): escapar HTML de valors d'usuari als correus Resend`
- No push ni PR sense instrucció.

## Steps

### Step 1: Afegir la funció `escapeHtml`

A prop del principi del fitxer (després dels imports i de `corsHeaders`, abans de `Deno.serve`), afegeix. **Important**: la funció ha de tolerar `undefined`/`null` — `name` ve del body de la petició i podria faltar; el codi original imprimia `undefined` com a text, però cridar `.replace()` sobre `undefined` llançaria. Per això coerceix amb `String(value ?? '')`:

```ts
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

**Verify**: `grep -n "function escapeHtml" supabase/functions/handle-editor-request/index.ts` → 1 match.

### Step 2: Escapar `name` a la branca `approve` (línia ~116)

Substitueix `Hola ${name},` per `Hola ${escapeHtml(name)},`.

### Step 3: Escapar `userName` a la branca `reactivate` (línia ~193)

Substitueix `Hola ${userName},` per `Hola ${escapeHtml(userName)},`.

### Step 4: Escapar `name` a la branca `reject` (línia ~230)

Substitueix `Hola ${name},` per `Hola ${escapeHtml(name)},`.

**Verify (steps 2-4)**:
- `grep -c "escapeHtml(" supabase/functions/handle-editor-request/index.ts` → `4` (la línia de `function escapeHtml(` també coincideix, més les 3 crides).
- `grep -n 'Hola \${name}' supabase/functions/handle-editor-request/index.ts` → cap match (exit 1).
- `grep -n 'Hola \${userName}' supabase/functions/handle-editor-request/index.ts` → cap match (exit 1).

### Step 5: Revisar que no quedi cap altre valor d'usuari cru

Cerca altres interpolacions de valors d'origen-usuari a les plantilles HTML. `email` no s'interpola a cap plantilla HTML visible actualment (només s'usa com a destinatari `to:`), però confirma-ho:

**Verify**: `grep -nE '\$\{(name|userName|email)\}' supabase/functions/handle-editor-request/index.ts` → cap match dins de blocs `html:` (si en surt algun, escapa'l també).

## Test plan

No hi ha tests automatitzats per a Edge Functions. Verificació funcional (operador, post-deploy):

- Enviar una sol·licitud d'editor amb `name` = `<b>XSS</b><script>alert(1)</script>` des del formulari públic.
- Aprovar-la i rebutjar-la des de la UI d'admin.
- Inspeccionar el correu rebut: el text ha de mostrar literalment `<b>XSS</b>...` (escapat), **no** renderitzar-se com a HTML.

Opcional (recomanat afegir com a follow-up): un test unitari Deno per a `escapeHtml` que verifiqui `escapeHtml('<a>"&\'') === '&lt;a&gt;&quot;&amp;&#39;'`. No bloquejant per a aquest pla si no hi ha infra de test Deno.

## Done criteria

ALL must hold:

- [ ] `grep -n "function escapeHtml" supabase/functions/handle-editor-request/index.ts` → 1 match
- [ ] `grep -c "escapeHtml(" supabase/functions/handle-editor-request/index.ts` → `4` (1 def + 3 crides)
- [ ] `grep -nE '\$\{(name|userName)\}' supabase/functions/handle-editor-request/index.ts` → cap match dins blocs `html:`
- [ ] `git status --porcelain` mostra només el fitxer en scope
- [ ] Fila d'estat de 004 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- El codi a les línies 116/193/230 no coincideix amb els excerpts (deriva).
- Trobes que `recoveryUrl` s'interpola sense cap validació i vols endurir-lo: això és un canvi separat — **no** apliquis `escapeHtml` a una URL dins d'un atribut `href` (trencaria `&` legítims de la query string). Si vols validar-la, comprova que comença per `https://` i pertany al domini de Supabase del projecte; si decideixes fer-ho, reporta-ho perquè surt de l'abast mínim d'aquest pla.
- Apareix un quart punt d'interpolació de valor d'usuari a HTML no llistat aquí.

## Maintenance notes

- Qualsevol plantilla HTML d'email nova que afegeixi valors d'usuari ha d'usar `escapeHtml()`.
- En revisió del PR: confirmar que `escapeHtml` s'aplica només a text dins de nodes HTML, no a URLs dins d'atributs `href` (que necessiten codificació d'URL, no escapat HTML).
- Follow-up diferit: extreure `escapeHtml` a un mòdul `_shared/` si una altra funció comença a generar HTML (ara només aquesta ho fa).
