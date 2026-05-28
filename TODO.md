# TODO — fp-recursos

## ✅ Fet (sessió 2026-05-20)

### Categories
- [x] Categories creades per editors ressaltades en `bg-blue-100` al nav, menú mòbil i modal admin
- [x] Admin edita categoria → propaga rename a tots els bookmarks
- [x] Admin esborra categoria → bookmarks queden òrfens (sense reassignació forçosa)
- [x] Bookmarks òrfens → secció "Altres" (capçalera blava) + `bg-blue-100` a la card
- [x] Secció "Altres" apareix al nav i al contingut principal

### EditorView
- [x] Amplada `max-w-[1600px]` i grid 4 columnes com la principal
- [x] Botó "← Tornar enrere" al header (esquerra de "+ Nou recurs")
- [x] Header amb mateixos estils de botons que la principal
- [x] Botó LOGOUT amb text igual que la principal

### Header principal
- [x] Botó "+ Nou recurs" per editors a la pantalla principal
- [x] Botó [Usuari] (fons negre, text blanc) obre modal de perfil

### Modal perfil d'usuari
- [x] Username editable, email read-only, canvi de contrasenya (doble confirmació)

### Login
- [x] Modal de login per sobre de la pàgina pública (fons enfosquit), no substitueix la pàgina

### Missatgeria interna
- [x] Taula `messages` a Supabase amb RLS
- [x] Editor envia missatges a admin, veu respostes
- [x] Admin veu llista d'editors amb badge no llegits, respon a cada fil
- [x] Editar/esborrar: editor (últim missatge), admin (tots)
- [x] Badge taronja al botó "Missatges" amb compte no llegits

### IA — Suggerència
- [x] Edge Function fa fetch real de l'URL i extreu contingut HTML
- [x] Retorna nom del model, es mostra al botó

---

## ⚠️ Pendent de fer

### 🆕 Sistema sol·licituds d'editor (sessió 2026-05-28)

#### FASE 1 — Supabase: nova taula + trigger
Executar al SQL Editor de Supabase:

```sql
-- Taula de peticions d'alta com a editor
create table editor_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  comment text,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

alter table editor_requests enable row level security;

create policy "Public insert" on editor_requests
  for insert with check (true);

create policy "Admin read" on editor_requests
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin update" on editor_requests
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Trigger: crea perfil automàticament quan Supabase crea un usuari via invitació
-- ⚠️ Verificar si ja existeix a Database → Functions abans d'executar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'editor'),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

#### FASE 2 — Supabase Edge Function
Fitxer: `supabase/functions/handle-editor-request/index.ts`

Rep: `{ action: 'approve' | 'reject', requestId: string, email: string, name: string }`

- **approve**: crida `supabase.auth.admin.inviteUserByEmail(email, { data: { username: name, role: 'editor' } })` → Supabase envia email amb link per establir password. Marca `status: 'approved'`.
- **reject**: envia email de rebuig via Resend. Marca `status: 'rejected'`.

Variables d'entorn a Supabase Dashboard → Settings → Edge Functions → Secrets:
- `RESEND_API_KEY` (obtenir a resend.com, gratu·ït fins 3000 emails/mes)
- `SITE_URL` (URL del site)
- `SUPABASE_SERVICE_ROLE_KEY` ja disponible per defecte

Deploy: `supabase functions deploy handle-editor-request`

Personalitzar template "Invite user" a Supabase → Authentication → Email Templates.

#### FASE 3 — Frontend: nous fitxers a crear
- [ ] `src/types/database.ts` — afegir interfície `EditorRequest`
- [ ] `src/services/editorRequests.ts` — `submitEditorRequest`, `getEditorRequests`, `getPendingEditorRequestCount`, `approveEditorRequest`, `rejectEditorRequest`. WhatsApp: missatge "🙋 Petició alta editor:\n👤 NOM\n📧 EMAIL\n💬 COMMENT"
- [ ] `src/components/EditorRequestModal.tsx` — formulari (Nom*, Email*, Comentari). Confirmació: "Missatge enviat! En breu l'admin revisarà la teva petició." Botó "Ja tinc compte? Iniciar sessió".
- [ ] `src/components/EditorRequestsAdminModal.tsx` — llista peticions, botons Aprovar/Rebutjar, badge count.

#### FASE 4 — Modificacions fitxers existents
- [ ] `src/pages/LoginPage.tsx` — a la capçalera, al costat d'on posa "Accés editors", afegir "Encara no ets editor?" + link que obre EditorRequestModal (via prop `onRequestAccess`).
- [ ] `src/App.tsx`:
  - Nous estats: `showEditorRequestModal`, `showEditorRequestsAdminModal`, `pendingEditorRequests`
  - useEffect (isAdmin): carregar `getPendingEditorRequestCount()` → `setPendingEditorRequests`
  - Botó "Editors" (header desktop + mòbil): afegir badge si `pendingEditorRequests > 0`. Click obre `EditorRequestsAdminModal` (en lloc de navegar a AdminView — AdminView segueix accessible des d'un botó dins el modal).
  - Botó "Contacte": afegir condició `!user &&` per ocultar quan loguejat (desktop línia ~511 i mòbil burger línia ~616)
  - Afegir modals EditorRequestModal i EditorRequestsAdminModal al final del JSX

#### FASE 5 — Configuració Resend
- [ ] Crear compte resend.com
- [ ] Verificar domini o usar `onboarding@resend.dev` per testing
- [ ] Afegir `RESEND_API_KEY` + `SITE_URL` a Supabase Edge Functions Secrets

#### Ordre d'implementació
1. SQL taula + trigger
2. Types + Service (frontend)
3. EditorRequestModal
4. EditorRequestsAdminModal
5. Modificar LoginPage.tsx
6. Modificar App.tsx
7. Edge Function
8. Resend + Secrets
9. Test complet flux

#### Notes
- CallMeBot ja configurat: VITE_CALLMEBOT_PHONE=34627595835, VITE_CALLMEBOT_APIKEY=1519122
- Supabase URL: https://wmnomhexggvrdvyznini.supabase.co
- El trigger `handle_new_user` pot ja existir — verificar a Database → Functions

---

- [ ] **Desplegar Edge Function actualitzada**:
  ```bash
  cd "/Users/rogermasellas/AI/FP Recursos/fp-recursos"
  supabase functions deploy suggest-resource
  ```

---

## 💡 Idees futures (no planificades)
- Notificació email quan l'admin rep un missatge nou
- Filtre de recursos per autor a la vista pública
- Ordre manual de categories

---

## 🎨 Sistema de Skins — Arquitectura (pendent d'implementar)

### Decisió de disseny
- **Qui canvia**: tothom (inclòs públic sense login)
- **Persistència**: `localStorage` (clau `fp-skin`)
- **Selector**: botó flotant discret a la cantonada inferior-dreta
- **Preview**: hover sobre l'opció → preview temporal; mouseLeave → revert
- **Abast**: colors, tipografia, bordes, ombres, border-radius, botons, modals
- **Refactor**: complet de tots els components (ara mateix)

---

### Mecanisme tècnic: CSS Custom Properties + `data-skin`

L'atribut `data-skin="brutal"` s'aplica a `document.documentElement` (`<html>`).
Cada skin és un bloc CSS que sobreescriu les variables. Cap JS per a colors — tot és CSS.

**Variables a definir a `index.css`:**
```css
:root, [data-skin="brutal"] {
  /* Colors */
  --skin-accent:          #fb923c;   /* orange-400 */
  --skin-accent-hover:    #fdba74;   /* orange-300 */
  --skin-accent-active:   #f97316;   /* orange-500 */
  --skin-bg-page:         #f0f0f0;
  --skin-bg-surface:      #ffffff;
  --skin-bg-surface-alt:  #f9fafb;
  --skin-text:            #000000;
  --skin-text-muted:      #6b7280;
  --skin-border-color:    #000000;

  /* Estructura */
  --skin-border-width:    2px;
  --skin-radius:          0px;

  /* Ombres neubrutalist */
  --skin-shadow-sm:       4px 4px 0px 0px #000000;
  --skin-shadow-md:       6px 6px 0px 0px rgba(0,0,0,1);
  --skin-shadow-lg:       8px 8px 0px 0px #000000;
  --skin-shadow-card:     6px 6px 0px 0px rgba(0,0,0,1);

  /* Tipografia */
  --skin-font-body:       ui-monospace, SFMono-Regular, Menlo, monospace;
  --skin-font-display:    ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* Utilitats (afegir a index.css) */
.border-skin          { border-width: var(--skin-border-width); border-color: var(--skin-border-color); }
.shadow-skin-sm       { box-shadow: var(--skin-shadow-sm); }
.shadow-skin-md       { box-shadow: var(--skin-shadow-md); }
.shadow-skin-lg       { box-shadow: var(--skin-shadow-lg); }
.shadow-skin-card     { box-shadow: var(--skin-shadow-card); }
.rounded-skin         { border-radius: var(--skin-radius); }
.font-skin            { font-family: var(--skin-font-body); }
.text-skin            { color: var(--skin-text); }
.text-skin-muted      { color: var(--skin-text-muted); }
.bg-page              { background-color: var(--skin-bg-page); }
.bg-surface           { background-color: var(--skin-bg-surface); }
.bg-accent            { background-color: var(--skin-accent); }
.hover\:bg-accent-hover:hover { background-color: var(--skin-accent-hover); }
```

---

### Fitxers a crear

**`src/skins/index.ts`** — registre de skins disponibles:
```ts
export interface SkinDef {
  id: string
  name: string
  description: string
  accentColor: string   // per preview swatch (hex)
}

export const SKINS: SkinDef[] = [
  { id: 'brutal', name: 'Brutal', description: 'Neubrutalist clàssic', accentColor: '#fb923c' },
  // afegir nous skins aquí + bloc CSS a index.css
]
```

**`src/context/SkinContext.tsx`** — context + localStorage:
```tsx
interface SkinContextValue {
  currentSkin: string
  setSkin: (id: string) => void
  previewSkin: (id: string | null) => void  // null = cancel·lar preview
}
// - Llegeix localStorage('fp-skin') en mount
// - Aplica document.documentElement.dataset.skin = id
// - previewSkin: canvi temporal de l'atribut; setSkin: permanent + localStorage
```

**`src/components/SkinPicker.tsx`** — selector flotant:
```
- Fixed bottom-right, z-50 (no interfereix amb cap modal)
- Botó icona paleta (Palette de lucide)
- Obre popover cap amunt-esquerra
- Llista SKINS: swatch de color + nom
- onMouseEnter opció → previewSkin(id)
- onMouseLeave popover → previewSkin(null)
- onClick opció → setSkin(id) + tancar
- Tanca en click fora (useEffect + mousedown listener)
```

---

### Fitxers a modificar

**`tailwind.config.js`** — afegir colors semàntics:
```js
theme: {
  extend: {
    colors: {
      accent:       'var(--skin-accent)',
      'accent-hover': 'var(--skin-accent-hover)',
      page:         'var(--skin-bg-page)',
      surface:      'var(--skin-bg-surface)',
    }
  }
}
```

**`src/main.tsx`** — embolcallar amb `<SkinProvider>`

**`src/App.tsx`** — afegir `<SkinPicker />` + refactor classes

**Tots els components** — substitucions sistemàtiques:

| Ara (hardcoded) | → Nou (semàntic) |
|---|---|
| `bg-orange-400` | `bg-accent` |
| `hover:bg-orange-400` | `hover:bg-accent-hover` |
| `bg-orange-300` | `bg-accent-hover` |
| `bg-white` (surface) | `bg-surface` |
| `bg-[#f0f0f0]` | `bg-page` |
| `border-2 border-black` | `border-skin` |
| `shadow-[4px_4px_0px_0px_#000]` | `shadow-skin-sm` |
| `shadow-[6px_6px_0px_0px_...]` | `shadow-skin-card` |
| `shadow-[8px_8px_0px_0px_#000]` | `shadow-skin-lg` |
| `font-mono` (UI, no codi) | `font-skin` |
| `rounded-*` (skin-dependent) | `rounded-skin` |

**`src/theme.ts`** — actualitzar per usar classes semàntiques en lloc de hardcoded

---

### Com afegir una nova skin (futur)

1. Afegir entrada a `SKINS` a `src/skins/index.ts`
2. Afegir bloc `[data-skin="nova-id"] { ... }` a `index.css` sobreescrivint les variables
3. Si requereix font externa: importar a `index.css` i assignar a `--skin-font-body`
4. Zero canvis als components — tot és CSS
