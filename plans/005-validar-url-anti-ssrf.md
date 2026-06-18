# Plan 005: Validar la URL a `suggest-resource` per prevenir SSRF

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e692524..HEAD -- supabase/functions/suggest-resource/`
> If the file changed since this plan was written, compare against the "Current
> state" excerpts before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none (si executes 003 abans, toca el mateix fitxer — seqüencial)
- **Category**: security
- **Planned at**: commit `e692524`, 2026-06-11

## Why this matters

La funció `suggest-resource` fa `fetch(url)` d'una URL proporcionada per l'usuari (un editor autenticat) sense validar l'esquema ni l'adreça de destí. Un editor pot fer que el servidor (Edge Function) faci peticions HTTP a adreces internes o de metadades de núvol —p. ex. `http://169.254.169.254/` (metadata endpoint), `http://localhost`, o rangs privats— i, encara que la resposta no es retorna sencera, el contingut s'incorpora al prompt de l'LLM i pot filtrar informació interna o servir d'eina de reconeixement de la xarxa interna. Validar l'esquema i bloquejar adreces no públiques abans del `fetch` tanca el vector amb cost mínim.

## Current state

Fitxer: `supabase/functions/suggest-resource/index.ts` (149 línies).

- `fetchPageContent(url)` fa el `fetch` sense validar (línies 37–53):
  ```ts
  async function fetchPageContent(url: string): Promise<string | null> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPRecursos/1.0)' },
      })
      ...
  ```
- El handler llegeix `url` del body i només comprova presència (línies 83–84):
  ```ts
      const { url, categories } = await req.json()
      if (!url) throw new Error('URL requerida')
  ```
- Després crida `const html = await fetchPageContent(url)` (línia 87).
- La funció ja exigeix JWT vàlid (línies 61–81), així que l'atacant ha de ser un usuari autenticat (editor o admin), però això no impedeix l'SSRF.

L'entorn és Deno (Supabase Edge Runtime). `Deno.resolveDns()` pot **no** estar disponible o permès a Edge Functions; el pla preveu un camí de degradació per nom d'host si la resolució DNS no és viable.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Validació present | `grep -n "function isAllowedUrl\|function assertSafeUrl" supabase/functions/suggest-resource/index.ts` | 1 match |
| Cridada abans del fetch | `grep -n "isAllowedUrl\|assertSafeUrl" supabase/functions/suggest-resource/index.ts` | ≥2 matches |

## Scope

**In scope** (modificar):
- `supabase/functions/suggest-resource/index.ts`

**Out of scope** (NO tocar):
- Les altres Edge Functions.
- La lògica de l'LLM/Groq, l'extracció de contingut HTML, l'auth.

## Git workflow

- Branch: `advisor/005-validar-url-anti-ssrf`
- Un sol commit: `fix(security): validar URL a suggest-resource (anti-SSRF)`
- No push ni PR sense instrucció.

## Steps

### Step 1: Afegir la funció de validació d'URL

Abans de `fetchPageContent` (o just després de `corsHeaders`), afegeix una funció que validi esquema i bloquegi adreces no públiques. Implementació amb degradació segura (bloqueig per nom d'host + IP literal; intent de resolució DNS si està disponible):

```ts
function ipv4ToParts(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  if (parts.some((p) => p > 255)) return null
  return parts
}

function isPrivateIpv4(parts: number[]): boolean {
  const [a, b] = parts
  if (a === 10) return true                         // 10.0.0.0/8
  if (a === 127) return true                        // loopback
  if (a === 0) return true                          // 0.0.0.0/8
  if (a === 169 && b === 254) return true           // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12
  if (a === 192 && b === 168) return true           // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  return false
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error('URL invàlida')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Esquema d\'URL no permès')
  }
  const host = u.hostname.toLowerCase()

  // Bloqueig directe de hostnames comuns interns
  const blockedHosts = ['localhost', '0.0.0.0', '::1', 'metadata.google.internal']
  if (blockedHosts.includes(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('Adreça no permesa')
  }

  // IP literal IPv4 → comprovar rangs privats
  const v4 = ipv4ToParts(host)
  if (v4 && isPrivateIpv4(v4)) {
    throw new Error('Adreça no permesa')
  }
  // IPv6 literal entre claudàtors → bloquejar loopback/link-local bàsics
  if (host.startsWith('[')) {
    const inner = host.slice(1, -1)
    if (inner === '::1' || inner.startsWith('fe80') || inner.startsWith('fc') || inner.startsWith('fd')) {
      throw new Error('Adreça no permesa')
    }
  }

  // Intent de resolució DNS (si l'entorn ho permet) per a hostnames que resolen a IP interna
  try {
    // @ts-ignore — Deno.resolveDns pot no estar disponible a Edge Runtime
    if (typeof Deno?.resolveDns === 'function') {
      // @ts-ignore
      const addrs: string[] = await Deno.resolveDns(host, 'A')
      for (const addr of addrs) {
        const p = ipv4ToParts(addr)
        if (p && isPrivateIpv4(p)) throw new Error('Adreça no permesa')
      }
    }
  } catch (e) {
    // Si la resolució falla per permisos/entorn, ja hem aplicat el bloqueig per nom/IP literal.
    if (e instanceof Error && e.message === 'Adreça no permesa') throw e
  }

  return u
}
```

> Nota sobre `@ts-ignore`: l'ESLint d'aquest repo (`eslint.config.js`) NO cobreix `supabase/functions/` per defecte en runtime de Deno, però per evitar friccions prefereix `// @ts-expect-error` amb comentari si el linter local hi arribés. Si `grep -rn "supabase/functions" eslint.config.js` no troba res, el directori no es lintea i `@ts-ignore` és acceptable.

**Verify**: `grep -n "function assertSafeUrl" supabase/functions/suggest-resource/index.ts` → 1 match.

### Step 2: Validar la longitud i invocar la validació abans del fetch

Al handler, just després de `if (!url) throw new Error('URL requerida')` (línia ~84), afegeix la validació de longitud i la crida a `assertSafeUrl`:

```ts
    if (typeof url !== 'string' || url.length > 2000) {
      return new Response(JSON.stringify({ error: 'URL invàlida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    await assertSafeUrl(url)
```

`assertSafeUrl` llança si la URL no és segura; l'error el captura el `catch` existent del handler (línia ~142), que retorna 500 amb el missatge. Si prefereixes 400 explícit, embolcalla la crida en un try/catch que retorni 400; no és obligatori per a aquest pla.

**Verify**: `grep -n "assertSafeUrl(url)" supabase/functions/suggest-resource/index.ts` → 1 match, situat **abans** de `fetchPageContent(url)`.

### Step 3: Confirmar l'ordre

**Verify**: la línia de `assertSafeUrl(url)` té un número menor que la de `const html = await fetchPageContent(url)`:
`grep -n "assertSafeUrl(url)\|fetchPageContent(url)" supabase/functions/suggest-resource/index.ts` → la primera apareix abans.

## Test plan

No hi ha tests automatitzats per a Edge Functions. Verificació funcional (operador, post-deploy), amb sessió d'editor:

- Suggerir un recurs amb una URL pública normal (`https://exemple.com/article`) → ha de funcionar igual que abans.
- Suggerir amb `http://169.254.169.254/latest/meta-data/` → ha de retornar error ("Adreça no permesa" o 400), sense fer el fetch.
- Suggerir amb `http://localhost:8000/` → error.
- Suggerir amb `ftp://exemple.com` → error ("Esquema d'URL no permès").

## Done criteria

ALL must hold:

- [ ] `grep -n "function assertSafeUrl" supabase/functions/suggest-resource/index.ts` → 1 match
- [ ] `grep -c "assertSafeUrl" supabase/functions/suggest-resource/index.ts` → ≥2 (definició + crida)
- [ ] La crida `assertSafeUrl(url)` precedeix `fetchPageContent(url)` al fitxer
- [ ] `git status --porcelain` mostra només el fitxer en scope
- [ ] Fila d'estat de 005 actualitzada a `plans/README.md`

## STOP conditions

Atura't i reporta si:

- El codi de `fetchPageContent` o del handler no coincideix amb els excerpts (deriva).
- Descobreixes que `suggest-resource` ha de poder accedir legítimament a adreces internes (no és el cas previst) — reporta-ho abans de bloquejar-les.
- La validació de longitud/esquema trenca casos d'ús legítims existents (p. ex. URLs molt llargues vàlides > 2000 chars) — ajusta el límit i reporta.

## Maintenance notes

- Aquesta protecció bloqueja SSRF "directe". No protegeix contra **redireccions** cap a adreces internes: `fetch` segueix redireccions per defecte. Follow-up recomanat (no inclòs): passar `redirect: 'manual'` a `fetch` dins `fetchPageContent` i re-validar la `Location` abans de seguir-la, o limitar el nombre de salts. Documenta-ho al PR com a limitació coneguda.
- En revisió del PR: confirmar que cap URL pública legítima queda bloquejada per error (els rangs CGNAT 100.64/10 poden ser sensibles segons l'allotjament).
- Si l'entorn d'Edge Functions activa `Deno.resolveDns`, la protecció és més forta; si no, el bloqueig per nom/IP literal és el mínim viable.
