[Català](#català) · [English](#english)

---

<a name="català"></a>

# SSCE0110 Links

Biblioteca de recursos educatius per al mòdul **SSCE0110** de Formació Professional a Catalunya. Permet gestionar, categoritzar i compartir enllaços útils entre editors i alumnes, amb suport per a múltiples estils visuals (skins) i un sistema de missatgeria intern.

## Índex

- [Característiques](#característiques)
- [Tecnologies](#tecnologies)
- [Sistema de skins](#sistema-de-skins)
- [Rols d'usuari](#rols-dusuari)
- [Instal·lació](#installació)
- [Variables d'entorn](#variables-dentorn)
- [Configuració de Supabase](#configuració-de-supabase)
- [Edge Functions](#edge-functions)
- [Scripts disponibles](#scripts-disponibles)
- [Estructura del projecte](#estructura-del-projecte)

---

## Característiques

- **Vista pública** — Qualsevol visitant pot consultar tots els recursos organitzats per categories.
- **Cerca** — Filtratge per títol, descripció o URL.
- **Sistema de destacats** — Els admins destaquen recursos globalment; els editors en tenen una llista personal.
- **Gestió de categories** — Admins i editors poden crear, editar i eliminar categories.
- **Afegir recursos amb IA** — El formulari d'afegir recursos pot analitzar una URL i generar automàticament títol, descripció i categoria en català (via Groq / Llama 3.1).
- **Missatgeria interna** — Els editors es comuniquen amb l'admin mitjançant fils de conversa privats.
- **Sol·licitud d'editor** — Qualsevol visitant pot sol·licitar accés com a editor. L'admin rep les peticions i les pot aprovar (envia invitació per email) o rebutjar.
- **Gestió d'editors** — L'admin pot crear, eliminar, activar/desactivar i canviar la contrasenya de comptes d'editor. En reactivar un compte se li envia un email de restabliment de contrasenya via Resend.
- **Formulari de contacte** — Qualsevol visitant pot enviar un missatge a l'admin. L'admin rep una notificació per WhatsApp (CallMeBot, opcional) i les consultes es gestionen des del panell.
- **Restabliment de contrasenya** — Flux complet de "He oblidat la contrasenya" des del login, amb email de recuperació.
- **Exportació** — L'admin pot exportar tots els recursos en format JSON.
- **Sistema de skins** — 5 estils visuals canviables en temps real sense recarregar la pàgina.
- **Disseny responsiu** — Adaptat a mòbil i escriptori.

---

## Tecnologies

| Capa | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite 7 |
| Estils | Tailwind CSS 3 + CSS custom properties |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS) |
| Edge Functions | Deno (Supabase Edge Runtime) |
| IA | Groq API — model `llama-3.1-8b-instant` |
| Icones | Lucide React |
| Tests | Vitest |

---

## Sistema de skins

L'aplicació inclou 5 skins seleccionables des d'un selector flotant. Cada skin defineix les seves pròpies variables CSS sota `[data-skin="id"]` a `src/index.css`.

| ID | Nom | Descripció |
|---|---|---|
| `brutal` | Brutal | Negre, taronja i monospace. Default. |
| `pastel90s` | Pastel 90s | Rosa, lila i Nunito. Estètica y2k. |
| `wabi` | Wabi-Sabi | Crema, verd apagat i serif. Minimalista. |
| `cyber` | Cyber | Fons negre, text cian neó. Dark mode. |
| `corp` | Corp | Blau corporatiu, Inter, ombres subtils. |

Les variables disponibles per skin són:

```css
--skin-accent          /* color principal d'acció */
--skin-accent-hover    /* hover de l'accent */
--skin-accent-active   /* click/active de l'accent */
--skin-bg-page         /* fons de la pàgina */
--skin-bg-surface      /* fons de cards i panells */
--skin-text            /* text principal */
--skin-text-muted      /* text secundari */
--skin-border-color    /* color de bordes */
--skin-border-width    /* gruix de bordes */
--skin-radius          /* arrodoniment */
--skin-shadow-sm/md/lg/card
--skin-font-body       /* família tipogràfica cos */
--skin-font-display    /* família tipogràfica display */
```

---

## Rols d'usuari

| Rol | Capacitats |
|---|---|
| **Visitant** | Consultar recursos i categories |
| **Editor** | + Afegir i editar els seus propis recursos, gestionar categories, destacats personals, missatgeria amb l'admin |
| **Admin** | + Tot: destacats globals, gestionar tots els recursos, gestionar editors, exportar, missatgeria amb tots els editors |

---

## Instal·lació

```bash
# 1. Clonar el repositori
git clone <url-del-repo>
cd fp-recursos

# 2. Instal·lar dependències
npm install

# 3. Crear el fitxer de variables d'entorn
cp .env.example .env.local
# → Edita .env.local amb les teves credencials de Supabase

# 4. Iniciar el servidor de desenvolupament
npm run dev
```

L'aplicació estarà disponible a `http://localhost:5173`.

---

## Variables d'entorn

Crea un fitxer `.env.local` a l'arrel del projecte amb:

```env
# Obligatòries
VITE_SUPABASE_URL=https://<projecte>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-del-projecte>

# Opcionals — notificació WhatsApp en rebre contacte (via CallMeBot)
VITE_CALLMEBOT_PHONE=<número-amb-prefix-internacional>
VITE_CALLMEBOT_APIKEY=<clau-callmebot>
```

Trobaràs `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` a **Supabase Dashboard → Project Settings → API**.

---

## Configuració de Supabase

### Base de dades

1. Crea un projecte nou a [supabase.com](https://supabase.com).
2. Al **SQL Editor** del dashboard, executa els fitxers per ordre:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/seed.sql
   ```
   El primer crea totes les taules, polítiques RLS i triggers. El segon afegeix les categories inicials.

### Crear el primer admin

1. **Authentication → Users → Invite user** — crea el compte de l'admin.
2. Al **SQL Editor**, promou-lo a admin:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE id = '<uuid-de-lusuari>';
   ```

### Taules principals

| Taula | Descripció |
|---|---|
| `profiles` | Extensió de `auth.users` amb `username`, `role` i `active` |
| `categories` | Categories gestionades per admins i editors |
| `bookmarks` | Recursos amb títol, descripció, URL, categories i destacat |
| `messages` | Missatges interns entre editors i admin |
| `editor_highlights` | Destacats personals de cada editor |
| `editor_requests` | Sol·licituds de rol editor enviades per visitants |
| `contact_requests` | Missatges de contacte públics; `read` indica si l'admin les ha vistes |

Totes les taules tenen **Row Level Security (RLS)** activat.

---

## Edge Functions

Les funcions s'executen al núvol de Supabase (Deno runtime). Per desplegar-les:

```bash
supabase functions deploy <nom-de-la-funcio>
```

| Funció | Descripció |
|---|---|
| `suggest-resource` | Analitza una URL amb Groq/Llama i retorna títol, descripció i categoria en català |
| `create-editor` | Crea un nou compte d'editor (només admin) |
| `delete-editor` | Elimina un compte d'editor i les seves dades (només admin) |
| `handle-editor-request` | Aprova/rebutja sol·licituds d'editor i envia emails via Resend; també reactiva comptes (només admin) |
| `change-user-password` | Canvia la contrasenya d'un editor des del panell d'admin (només admin) |

Totes les funcions excepte `suggest-resource` requereixen un token JWT d'admin a la capçalera `Authorization`.

Secrets necessaris a Supabase (`supabase secrets set`):

```bash
supabase secrets set GROQ_API_KEY=<clau-groq>
supabase secrets set RESEND_API_KEY=<clau-resend>   # per a emails d'invitació i recuperació
supabase secrets set SITE_URL=https://<domini>       # URL de redirecció en links d'email
```

---

## Scripts disponibles

```bash
npm run dev       # Servidor de desenvolupament (http://localhost:5173)
npm run build     # Build de producció (TypeScript + Vite)
npm run preview   # Previsualitzar el build de producció
npm run lint      # Linter ESLint
npm run test      # Tests amb Vitest
```

---

## Estructura del projecte

```
fp-recursos/
├── src/
│   ├── components/
│   │   ├── BookmarkCard.tsx              # Card individual de recurs
│   │   ├── BookmarkForm.tsx              # Formulari crear/editar recurs (+ IA)
│   │   ├── ContactModal.tsx              # Formulari de contacte públic
│   │   ├── ContactsAdminModal.tsx        # Gestió de contactes (admin)
│   │   ├── EditorRequestModal.tsx        # Formulari sol·licitud d'editor
│   │   ├── EditorRequestsAdminModal.tsx  # Gestió de sol·licituds (admin)
│   │   ├── Header.tsx
│   │   ├── MessagesModal.tsx             # Sistema de missatgeria intern
│   │   ├── ProtectedRoute.tsx            # Guard de ruta per rol
│   │   ├── ScrollToTop.tsx              # Botó tornar al capdamunt
│   │   ├── SetPasswordModal.tsx          # Modal establir/canviar contrasenya
│   │   ├── SkinPicker.tsx               # Selector de skin flotant
│   │   └── UI.tsx                       # Components UI reutilitzables
│   ├── context/
│   │   ├── AuthContext.tsx      # Autenticació i perfil d'usuari
│   │   └── SkinContext.tsx      # Skin activa (persistida a localStorage)
│   ├── pages/
│   │   ├── AdminView.tsx        # Panell d'administració d'editors
│   │   ├── EditorView.tsx       # Vista dels recursos propis de l'editor
│   │   └── LoginPage.tsx        # Modal de login
│   ├── services/
│   │   ├── ai.ts                # Crida a la Edge Function suggest-resource
│   │   ├── bookmarks.ts         # CRUD de bookmarks
│   │   ├── categories.ts        # CRUD de categories
│   │   ├── contacts.ts          # Formulari de contacte + notificació WhatsApp
│   │   ├── editorRequests.ts    # CRUD sol·licituds d'editor
│   │   ├── highlights.ts        # Destacats personals d'editor
│   │   ├── messages.ts          # Missatgeria interna
│   │   └── profiles.ts          # Gestió de perfils i accions admin
│   ├── types/
│   │   └── database.ts          # Tipus TypeScript de la BD
│   ├── lib/
│   │   └── supabase.ts          # Client de Supabase
│   ├── App.tsx                  # Component arrel i lògica principal
│   ├── index.css                # Sistema de skins + utilitats globals
│   └── theme.ts                 # Classes Tailwind reutilitzables
├── supabase/
│   ├── functions/
│   │   ├── suggest-resource/         # IA per suggerir metadades
│   │   ├── create-editor/            # Crear editor (admin)
│   │   ├── delete-editor/            # Eliminar editor (admin)
│   │   ├── handle-editor-request/    # Aprovar/rebutjar sol·licituds i reactivar comptes (admin)
│   │   └── change-user-password/     # Canviar contrasenya d'editor (admin)
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── .env.local                   # Variables d'entorn (no al repo)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

<a name="english"></a>

# SSCE0110 Links

Educational resource library for the **SSCE0110** module of Vocational Training (Formació Professional) in Catalonia. It allows managing, categorising, and sharing useful links between editors and students, with support for multiple visual themes (skins) and an internal messaging system.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Skin System](#skin-system)
- [User Roles](#user-roles)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [Edge Functions](#edge-functions-1)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)

---

## Features

- **Public view** — Any visitor can browse all resources organised by category.
- **Search** — Filter by title, description or URL.
- **Highlights system** — Admins highlight resources globally; editors maintain a personal highlight list.
- **Category management** — Admins and editors can create, edit and delete categories.
- **AI-assisted resource creation** — The add-resource form can analyse a URL and automatically generate a title, description and category in Catalan (via Groq / Llama 3.1).
- **Internal messaging** — Editors communicate with the admin through private conversation threads.
- **Editor request flow** — Any visitor can apply for editor access. The admin receives requests and can approve (sends an invitation email) or reject them.
- **Editor management** — The admin can create, delete, activate/deactivate, and change the password of editor accounts. Reactivating an account sends a password-reset email via Resend.
- **Contact form** — Any visitor can send a message to the admin. The admin receives an optional WhatsApp notification (CallMeBot) and manages queries from the panel.
- **Password reset** — Full "Forgot password" flow from the login screen, with a recovery email.
- **Export** — The admin can export all resources as JSON.
- **Skin system** — 5 visual themes switchable in real time without page reload.
- **Responsive design** — Adapted for mobile and desktop.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite 7 |
| Styles | Tailwind CSS 3 + CSS custom properties |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS) |
| Edge Functions | Deno (Supabase Edge Runtime) |
| AI | Groq API — model `llama-3.1-8b-instant` |
| Icons | Lucide React |
| Tests | Vitest |

---

## Skin System

The app includes 5 selectable skins via a floating picker. Each skin defines its own CSS variables under `[data-skin="id"]` in `src/index.css`.

| ID | Name | Description |
|---|---|---|
| `brutal` | Brutal | Black, orange and monospace. Default. |
| `pastel90s` | Pastel 90s | Pink, purple and Nunito. Y2K aesthetic. |
| `wabi` | Wabi-Sabi | Cream, muted green and serif. Minimalist. |
| `cyber` | Cyber | Black background, neon cyan text. Dark mode. |
| `corp` | Corp | Corporate blue, Inter, subtle shadows. |

Available variables per skin:

```css
--skin-accent          /* primary action colour */
--skin-accent-hover    /* accent hover state */
--skin-accent-active   /* accent click/active state */
--skin-bg-page         /* page background */
--skin-bg-surface      /* card and panel background */
--skin-text            /* primary text */
--skin-text-muted      /* secondary text */
--skin-border-color    /* border colour */
--skin-border-width    /* border thickness */
--skin-radius          /* border radius */
--skin-shadow-sm/md/lg/card
--skin-font-body       /* body typeface */
--skin-font-display    /* display typeface */
```

---

## User Roles

| Role | Capabilities |
|---|---|
| **Visitor** | Browse resources and categories |
| **Editor** | + Add and edit own resources, manage categories, personal highlights, messaging with admin |
| **Admin** | + Everything: global highlights, manage all resources and editors, export, messaging with all editors |

---

## Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd fp-recursos

# 2. Install dependencies
npm install

# 3. Create the environment file
cp .env.example .env.local
# → Edit .env.local with your Supabase credentials

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

Create a `.env.local` file at the project root:

```env
# Required
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<project-anon-key>

# Optional — WhatsApp notification on contact form submission (via CallMeBot)
VITE_CALLMEBOT_PHONE=<number-with-country-code>
VITE_CALLMEBOT_APIKEY=<callmebot-api-key>
```

Find `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Supabase Dashboard → Project Settings → API**.

---

## Supabase Setup

### Database

1. Create a new project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the files in order:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/seed.sql
   ```
   The first file creates all tables, RLS policies and triggers. The second seeds the initial categories.

### Creating the first admin

1. **Authentication → Users → Invite user** — create the admin account.
2. In the **SQL Editor**, promote them to admin:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE id = '<user-uuid>';
   ```

### Main tables

| Table | Description |
|---|---|
| `profiles` | Extends `auth.users` with `username`, `role` and `active` |
| `categories` | Categories managed by admins and editors |
| `bookmarks` | Resources with title, description, URL, categories and highlight flag |
| `messages` | Internal messages between editors and admin |
| `editor_highlights` | Personal highlights per editor |
| `editor_requests` | Editor-access requests submitted by visitors |
| `contact_requests` | Public contact messages; `read` flag tracks admin review |

All tables have **Row Level Security (RLS)** enabled.

---

## Edge Functions

Functions run on Supabase's cloud (Deno runtime). To deploy:

```bash
supabase functions deploy <function-name>
```

| Function | Description |
|---|---|
| `suggest-resource` | Analyses a URL with Groq/Llama and returns a title, description and category in Catalan |
| `create-editor` | Creates a new editor account (admin only) |
| `delete-editor` | Deletes an editor account and their data (admin only) |
| `handle-editor-request` | Approves/rejects editor requests and sends emails via Resend; also reactivates accounts (admin only) |
| `change-user-password` | Changes an editor's password from the admin panel (admin only) |

All functions except `suggest-resource` require an admin JWT in the `Authorization` header.

Required secrets in Supabase (`supabase secrets set`):

```bash
supabase secrets set GROQ_API_KEY=<groq-key>
supabase secrets set RESEND_API_KEY=<resend-key>   # for invitation and recovery emails
supabase secrets set SITE_URL=https://<domain>      # redirect URL in email links
```

---

## Available Scripts

```bash
npm run dev       # Development server (http://localhost:5173)
npm run build     # Production build (TypeScript + Vite)
npm run preview   # Preview the production build
npm run lint      # ESLint
npm run test      # Tests with Vitest
```

---

## Project Structure

```
fp-recursos/
├── src/
│   ├── components/
│   │   ├── BookmarkCard.tsx              # Individual resource card
│   │   ├── BookmarkForm.tsx              # Create/edit resource form (+ AI)
│   │   ├── ContactModal.tsx              # Public contact form
│   │   ├── ContactsAdminModal.tsx        # Contact management (admin)
│   │   ├── EditorRequestModal.tsx        # Editor access request form
│   │   ├── EditorRequestsAdminModal.tsx  # Request management (admin)
│   │   ├── Header.tsx
│   │   ├── MessagesModal.tsx             # Internal messaging system
│   │   ├── ProtectedRoute.tsx            # Role-based route guard
│   │   ├── ScrollToTop.tsx              # Scroll-to-top button
│   │   ├── SetPasswordModal.tsx          # Set/change password modal
│   │   ├── SkinPicker.tsx               # Floating skin selector
│   │   └── UI.tsx                       # Reusable UI components
│   ├── context/
│   │   ├── AuthContext.tsx      # Auth and user profile
│   │   └── SkinContext.tsx      # Active skin (persisted to localStorage)
│   ├── pages/
│   │   ├── AdminView.tsx        # Editor management panel
│   │   ├── EditorView.tsx       # Editor's own resources view
│   │   └── LoginPage.tsx        # Login modal
│   ├── services/
│   │   ├── ai.ts                # Calls the suggest-resource Edge Function
│   │   ├── bookmarks.ts         # Bookmark CRUD
│   │   ├── categories.ts        # Category CRUD
│   │   ├── contacts.ts          # Contact form + WhatsApp notification
│   │   ├── editorRequests.ts    # Editor request CRUD
│   │   ├── highlights.ts        # Editor personal highlights
│   │   ├── messages.ts          # Internal messaging
│   │   └── profiles.ts          # Profile management and admin actions
│   ├── types/
│   │   └── database.ts          # TypeScript DB types
│   ├── lib/
│   │   └── supabase.ts          # Supabase client
│   ├── App.tsx                  # Root component and main logic
│   ├── index.css                # Skin system + global utilities
│   └── theme.ts                 # Reusable Tailwind class strings
├── supabase/
│   ├── functions/
│   │   ├── suggest-resource/         # AI metadata suggestions
│   │   ├── create-editor/            # Create editor account (admin)
│   │   ├── delete-editor/            # Delete editor account (admin)
│   │   ├── handle-editor-request/    # Approve/reject requests and reactivate accounts (admin)
│   │   └── change-user-password/     # Change editor password (admin)
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── .env.local                   # Environment variables (not in repo)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```
