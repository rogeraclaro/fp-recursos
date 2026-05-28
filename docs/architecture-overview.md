# Visió general d'arquitectura — fp-recursos

**Versió**: 1.0  
**Data**: 2026-05-29

---

## Propòsit del sistema

fp-recursos és una biblioteca curada de recursos web per a docents de Formació Professional (mòdul SSCE0110). El sistema permet als editors afegir i gestionar recursos; el públic pot consultar-los sense registrar-se. L'accés d'editors és controlat per un flux d'aprovació manual gestionat per l'admin.

---

## Visió de conjunt

El sistema és una aplicació de pàgina única (SPA) sense renderització al servidor. Tota la lògica de backend s'executa en dues capes: la base de dades PostgreSQL (via RLS i triggers) i les funcions Edge de Supabase (Deno). No existeix cap servidor d'aplicació intermedi.

El diagrama següent mostra el context del sistema fp-recursos i les seves relacions amb usuaris i serveis externs:

```mermaid
graph TB
    classDef user fill:#4A90E2,stroke:#2E5C8A,color:#fff
    classDef system fill:#50C878,stroke:#2E7D50,color:#fff
    classDef external fill:#F5A623,stroke:#C47D0E,color:#fff
    classDef db fill:#9B59B6,stroke:#6C3483,color:#fff

    Visitor["Visitant anònim\n(navegador web)"]:::user
    Editor["Editor\n(navegador web)"]:::user
    Admin["Admin\n(navegador web)"]:::user
    ExtUser["Usuari extensió\n(Chrome)"]:::user

    subgraph FP["fp-recursos — Sistema principal"]
        WebApp["Aplicació web React\nSPA estàtica (Nginx/VPS)"]:::system
        Extension["Extensió Chrome MV3\n(build independent)"]:::system
        EdgeFns["Supabase Edge Functions\n(5 funcions Deno)"]:::system
        DB["Base de dades PostgreSQL\n(Supabase + RLS)"]:::db
    end

    Groq["Groq API\nllama-3.1-8b-instant"]:::external
    Resend["Resend API\ncorreus transaccionals"]:::external
    CallMeBot["CallMeBot\nnotificacions WhatsApp"]:::external
    SupaAuth["Supabase Auth\nJWT + sessions"]:::external

    Visitor -->|"consulta recursos (pública)"| WebApp
    Editor -->|"gestiona recursos (autenticat)"| WebApp
    Admin -->|"administra el sistema (autenticat)"| WebApp
    ExtUser -->|"desa recursos des de pestanyes"| Extension

    WebApp -->|"REST API + JWT"| DB
    WebApp -->|"invoca funcions"| EdgeFns
    Extension -->|"REST API + JWT"| DB
    Extension -->|"invoca suggest-resource"| EdgeFns
    WebApp -->|"notificació WhatsApp"| CallMeBot

    EdgeFns -->|"suggeriment metadades IA"| Groq
    EdgeFns -->|"correus invitació/rebuig"| Resend
    EdgeFns -->|"operacions privilegiades"| DB
    EdgeFns -->|"gestió d'usuaris"| SupaAuth
```

---

## Usuaris i rols

| Rol | Descripció |
|-----|------------|
| **Visitant anònim** | Accés de lectura a tots els recursos i categories sense autenticació |
| **Editor** (`role: 'editor'`) | Pot crear/editar/eliminar els seus propis recursos, gestionar categories, missatjar l'admin, mantenir destacats personals |
| **Admin** (`role: 'admin'`) | Totes les capacitats d'editor + gestió global de recursos, usuaris, sol·licituds i exportació |
| **Usuari d'extensió** | Subconjunt d'editors/admins que usa l'extensió Chrome per desar recursos directament des del navegador |

---

## Contenidors principals

El sistema es compon de quatre contenidors independents:

### Contenidor 1 — Aplicació web React (`src/`)

Aplicació React 19 de pàgina única (SPA) que serveix tres vistes lògiques:
- **Vista pública**: galeria de recursos, cerca, contacte, sol·licitud d'accés
- **Vista editor**: gestió de recursos propis, categories, missatgeria
- **Vista admin**: panell d'usuaris, sol·licituds, contactes, gestió global

La navegació entre vistes es gestiona via una variable d'estat React (`view: 'public' | 'editor' | 'admin'`). No s'utilitza cap biblioteca de router de client. El build genera fitxers estàtics desplegats a un VPS via FTP, servits per Nginx.

### Contenidor 2 — Extensió Chrome MV3 (`extension/`)

Extensió Chrome Manifest V3 amb sistema de build propi (Vite, package.json separat). Té tres scripts diferenciats:

- **Service worker** (`background/service-worker.ts`): gestiona totes les crides a Supabase API i conserva la sessió a `chrome.storage.local`. Respon a 9 tipus de missatge des del popup.
- **Content script** (`content/content.ts`): injectat a cada pàgina; extreu metadades del DOM (títol, descripció, URL) i respon al missatge `GET_METADATA`.
- **Popup** (`popup/popup.tsx`): interfície React en dos modes: mode pàgina única (desa la pestanya actual) i mode gestor de pestanyes (llista totes les pestanyes obertes, categorització en massa, desament en bloc).

La sessió de l'extensió és **independent** de la sessió de l'aplicació web. Un editor pot estar autenticat a un però no a l'altre.

### Contenidor 3 — Supabase Edge Functions (`supabase/functions/`)

Cinc funcions HTTP Deno desplegades al runtime de Supabase. Gestionen operacions que requereixen privilegis o serveis externs no accessibles directament des del client:

| Funció | Propòsit |
|--------|---------|
| `suggest-resource` | Suggeriment de metadades via IA (Groq/Llama-3.1) |
| `handle-editor-request` | Aprovació/rebuig de sol·licituds d'editor i reactivació d'editors (veure avís de seguretat) |
| `create-editor` | Creació directa d'editor per l'admin |
| `delete-editor` | Eliminació permanent d'editor |
| `change-user-password` | Canvi de contrasenya d'un usuari per l'admin |

El diagrama següent mostra els quatre contenidors i els seus components interns:

```mermaid
graph LR
    classDef webapp fill:#4A90E2,stroke:#2E5C8A,color:#fff
    classDef extension fill:#27AE60,stroke:#1A7A40,color:#fff
    classDef edgefn fill:#E67E22,stroke:#A85B0A,color:#fff
    classDef db fill:#8E44AD,stroke:#5E2D7A,color:#fff

    subgraph WebApp["Contenidor 1 — Aplicació web React"]
        A1["Vista pública\n(galeria, cerca, contacte)"]:::webapp
        A2["Vista editor\n(gestió recursos propis)"]:::webapp
        A3["Vista admin\n(panell administració)"]:::webapp
        A4["AuthContext / SkinContext"]:::webapp
    end

    subgraph Ext["Contenidor 2 — Extensió Chrome MV3"]
        B1["Popup (React)\nmode pàgina + mode pestanyes"]:::extension
        B2["Service Worker\nsessió chrome.storage.local"]:::extension
        B3["Content Script\nextracció metadades DOM"]:::extension
    end

    subgraph EF["Contenidor 3 — Edge Functions (Deno)"]
        C1["suggest-resource\n(IA via Groq)"]:::edgefn
        C2["handle-editor-request\n(SENSE AUTH)"]:::edgefn
        C3["create-editor"]:::edgefn
        C4["delete-editor"]:::edgefn
        C5["change-user-password"]:::edgefn
    end

    subgraph DB["Contenidor 4 — PostgreSQL (Supabase)"]
        D1["profiles / bookmarks\ncategories (migració)"]:::db
        D2["messages / editor_requests\ncontact_requests / editor_highlights\n(dashboard)"]:::db
    end

    A1 & A2 & A3 -->|"supabase-js"| D1
    A1 & A2 & A3 -->|"supabase-js"| D2
    A2 & A3 -->|"invoke()"| C1
    A3 -->|"invoke() — sense JWT"| C2
    A3 -->|"invoke() + JWT admin"| C3 & C4 & C5
    B1 -->|"missatge"| B2
    B1 -->|"GET_METADATA"| B3
    B2 -->|"REST API"| D1
    B2 -->|"invoke()"| C1
    C3 & C4 & C5 -->|"SERVICE_ROLE_KEY"| D1
    C2 -->|"SERVICE_ROLE_KEY"| D1 & D2
```

### Contenidor 4 — Base de dades PostgreSQL (Supabase)

Base de dades PostgreSQL gestionada per Supabase amb 7 taules. L'accés a les dades el controla **Row-Level Security (RLS)** a nivell de base de dades. Dos triggers automatitzen operacions:

- `handle_new_user`: crea automàticament una fila a `profiles` quan es crea un nou usuari a `auth.users`
- `handle_updated_at`: actualitza `bookmarks.updated_at` en cada modificació

---

## Esquema de la base de dades

El diagrama següent mostra les relacions entre les 7 taules de la base de dades:

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        string email
    }
    profiles {
        uuid id PK
        text username
        text role
        boolean active
        timestamptz created_at
    }
    categories {
        uuid id PK
        text name
        uuid created_by FK
        timestamptz created_at
    }
    bookmarks {
        uuid id PK
        text title
        text description
        text url
        text_array categories
        uuid user_id FK
        boolean highlighted
        boolean admin_reviewed
        timestamptz created_at
        timestamptz updated_at
    }
    messages {
        uuid id PK
        uuid sender_id FK
        uuid recipient_id FK
        text content
        boolean read_by_recipient
        timestamptz created_at
    }
    editor_requests {
        uuid id PK
        text name
        text email
        text comment
        text status
        timestamptz created_at
        timestamptz reviewed_at
        uuid reviewed_by FK
    }
    contact_requests {
        uuid id PK
        text name
        text email
        text message
        boolean read
        timestamptz created_at
    }
    editor_highlights {
        uuid user_id FK
        uuid bookmark_id FK
    }

    AUTH_USERS ||--|| profiles : "trigger handle_new_user"
    profiles ||--o{ bookmarks : "user_id"
    profiles ||--o{ categories : "created_by"
    profiles ||--o{ messages : "sender_id"
    profiles ||--o{ messages : "recipient_id"
    profiles ||--o{ editor_requests : "reviewed_by"
    profiles ||--o{ editor_highlights : "user_id"
    bookmarks ||--o{ editor_highlights : "bookmark_id"
```

### Taules definides a la migració (`001_initial_schema.sql`)

```
profiles
  id         uuid PK → auth.users
  username   text NOT NULL
  role       text ('editor'|'admin') DEFAULT 'editor'
  active     boolean DEFAULT true
  created_at timestamptz

categories
  id         uuid PK
  name       text UNIQUE NOT NULL
  created_by uuid → profiles
  created_at timestamptz

bookmarks
  id             uuid PK
  title          text NOT NULL
  description    text NOT NULL
  url            text NOT NULL
  categories     text[]
  user_id        uuid → profiles
  highlighted    boolean DEFAULT false
  created_at     timestamptz
  updated_at     timestamptz
  admin_reviewed boolean DEFAULT false  ← columna afegida via dashboard (absent de la migració)
```

### Taules creades al dashboard (sense migració)

> **Avís**: Les quatre taules següents i la columna `admin_reviewed` **no apareixen al fitxer de migració del repositori**. Existeixen a la base de dades de producció però les seves polítiques RLS no es poden verificar des del codi font.

```
messages
  id                uuid PK
  sender_id         uuid → profiles
  recipient_id      uuid → profiles
  content           text
  read_by_recipient boolean
  created_at        timestamptz

editor_requests
  id          uuid PK
  name        text NOT NULL
  email       text NOT NULL
  comment     text
  status      text ('pending'|'approved'|'rejected')
  created_at  timestamptz
  reviewed_at timestamptz
  reviewed_by uuid → profiles

contact_requests
  id         uuid PK
  name       text NOT NULL
  email      text NOT NULL
  message    text NOT NULL
  created_at timestamptz
  read       boolean DEFAULT false

editor_highlights
  user_id     uuid → profiles
  bookmark_id uuid → bookmarks
  (clau primària composta presumiblement)
```

---

## Polítiques Row-Level Security (RLS)

### Polítiques verificades a la migració

| Taula | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Tothom | Via trigger (automàtic) | Propi row (`auth.uid() = id`) | — |
| `categories` | Tothom | Admins | Admins | Admins |
| `bookmarks` | Tothom | Editor propi (`auth.uid() = user_id`) | Editor propi O admin | Editor propi O admin |

La comprovació d'admin usa subconsulta: `exists (select 1 from profiles where id = auth.uid() and role = 'admin')`.

### Polítiques no verificades (taules dashboard)

Les polítiques de `messages`, `editor_requests`, `contact_requests` i `editor_highlights` no estan al repositori. El comportament observat al codi:

- `messages`: editors llegeixen el seu propi fil; admin llegeix tots els fils on participa.
- `editor_requests`: INSERT anònim possible (sense autenticació). Admin llegeix totes les sol·licituds.
- `contact_requests`: INSERT anònim possible. Admin llegeix tots els contactes.
- `editor_highlights`: per usuari; sense visibilitat creuada observada.

---

## Model d'autenticació i autorització

### Autenticació web

Supabase Auth gestiona l'autenticació amb email i contrasenya. El client obté un JWT que s'emmagatzema a la sessió del navegador. `AuthContext.tsx` subscriu `onAuthStateChange` per actualitzar l'estat de sessió de manera reactiva.

Els rols (`isAdmin`, `isEditor`) es deriven de `profile.role` llegit de la taula `profiles`.

### Autenticació extensió Chrome

L'extensió gestiona la sessió de manera independent: el JWT s'emmagatzema a `chrome.storage.local` al service worker. Totes les crides a Supabase des de l'extensió passen pel service worker.

### Flux d'autorització a les Edge Functions

Les funcions `create-editor`, `delete-editor` i `change-user-password` segueixen el mateix patró de defensa en profunditat:

1. Exigeix capçalera `Authorization: Bearer <jwt>` (401 si absent)
2. Valida el JWT via `supabase.auth.getUser()` (401 si invàlid)
3. Consulta `profiles.role` del caller (403 si no és admin)
4. Instancia un segon client amb `SERVICE_ROLE_KEY` per a l'operació privilegiada

> **Excepció crítica**: `handle-editor-request` **no segueix aquest patró**. No llegeix la capçalera `Authorization`, no valida cap JWT i opera directament amb `SUPABASE_SERVICE_ROLE_KEY`. Veure la secció de Seguretat.

---

## Fluxos de dades principals

### 1. Consulta pública

```mermaid
flowchart LR
    classDef step fill:#4A90E2,stroke:#2E5C8A,color:#fff
    classDef storage fill:#9B59B6,stroke:#6C3483,color:#fff

    A["Navegador"]:::step --> B["supabase-js"]:::step
    B --> C["getBookmarks()\n+ getCategories()\nen paral·lel"]:::step
    C --> D["Supabase REST API\n(RLS: SELECT públic)"]:::storage
    D --> E["Renderitzat graella\namb categories i destacats"]:::step
    E --> F["Detecció recursos nous\nlocalStorage fp-lastVisit"]:::storage
```

### 2. Editor afegeix recurs (aplicació web)

```mermaid
flowchart TD
    classDef step fill:#4A90E2,stroke:#2E5C8A,color:#fff
    classDef optional fill:#50C878,stroke:#2E7D50,color:#fff
    classDef external fill:#F5A623,stroke:#C47D0E,color:#fff
    classDef db fill:#9B59B6,stroke:#6C3483,color:#fff

    A["Editor obre BookmarkForm"]:::step
    B{{"Usar IA?"}}
    C["suggest-resource\nEdge Function"]:::optional
    D["Groq API\nllama-3.1-8b-instant"]:::external
    E["Retorna títol + descripció\n+ categoria en català"]:::optional
    F["Editor revisa/modifica dades"]:::step
    G["createBookmark()"]:::step
    H["Supabase REST API\nRLS: auth.uid() = user_id"]:::db

    A --> B
    B -->|"Sí"| C
    C --> D
    D --> E
    E --> F
    B -->|"No"| F
    F --> G
    G --> H
```

### 3. Extensió Chrome desa un recurs

```mermaid
sequenceDiagram
    participant U as Usuari
    participant P as Popup (React)
    participant SW as Service Worker
    participant CS as Content Script
    participant EF as suggest-resource
    participant DB as Supabase REST API

    U->>P: Clic icona extensió
    P->>SW: AUTH_GET_SESSION
    alt No autenticat
        SW-->>P: Sessió absent
        P->>U: Formulari login
        U->>P: Credencials
        P->>SW: AUTH_SIGN_IN
        SW-->>P: Sessió activa
    end
    P->>CS: GET_METADATA
    CS-->>P: Títol + descripció + URL de la pàgina
    opt Usar IA
        P->>SW: SUGGEST_RESOURCE
        SW->>EF: POST suggest-resource (JWT)
        EF-->>SW: Metadades generades
        SW-->>P: Metadades suggerides
    end
    U->>P: Confirma i desa
    P->>SW: SAVE_BOOKMARK
    SW->>DB: INSERT bookmark (JWT)
    DB-->>SW: Recurs desat
    SW-->>P: Confirmació
```

### 4. Flux d'aprovació d'editor

El diagrama següent mostra el flux complet d'aprovació d'un editor, des de la sol·licitud fins a l'accés al sistema:

```mermaid
sequenceDiagram
    participant V as Visitant
    participant App as Aplicació web
    participant DB as PostgreSQL
    participant EF as handle-editor-request
    participant SA as Supabase Auth
    participant RS as Resend API
    participant CB as CallMeBot

    V->>App: Omple formulari sol·licitud
    App->>DB: INSERT editor_requests (status=pending)
    App-->>CB: Notificació WhatsApp admin (best-effort, no-cors)

    Note over App,EF: L'admin revisa la sol·licitud al panell

    alt Usuari NOU
        App->>EF: POST handle-editor-request (action=approve)<br/>SENSE JWT — vulnerabilitat crítica
        EF->>SA: inviteUserByEmail(email)
        SA-->>V: Correu d'invitació (Supabase)
        EF->>DB: UPDATE editor_requests status=approved
    else Usuari EXISTENT (error 422)
        App->>EF: POST handle-editor-request (action=approve)<br/>SENSE JWT — vulnerabilitat crítica
        EF->>SA: listUsers → getUserByEmail
        EF->>DB: UPDATE profiles active=true, role=editor
        EF->>SA: generateLink (recovery)
        EF->>RS: Envia correu reactivació
        RS-->>V: Correu de reactivació
        EF->>DB: UPDATE editor_requests status=approved
    else Rebutjat
        App->>EF: POST handle-editor-request (action=reject)<br/>SENSE JWT — vulnerabilitat crítica
        EF->>RS: Envia correu de rebuig
        RS-->>V: Correu de rebuig
        EF->>DB: UPDATE editor_requests status=rejected
    end

    V->>App: Clic a l'enllaç del correu (hash #type=invite o #type=recovery)
    App->>V: SetPasswordModal (automàtic)
    V->>App: Estableix contrasenya (mínim 6 caràcters)
    App->>SA: Sessió iniciada automàticament
```

### 5. Missatgeria editor-admin

```mermaid
flowchart LR
    classDef actor fill:#4A90E2,stroke:#2E5C8A,color:#fff
    classDef action fill:#50C878,stroke:#2E7D50,color:#fff
    classDef db fill:#9B59B6,stroke:#6C3483,color:#fff
    classDef external fill:#F5A623,stroke:#C47D0E,color:#fff

    Ed["Editor"]:::actor
    Ad["Admin"]:::actor
    MM["MessagesModal\nsendMessage()"]:::action
    DB["INSERT messages\n(autenticat)"]:::db
    CB["CallMeBot API\n(no-cors, best-effort)"]:::external
    AA["getAllAdminMessages()\nfils agrupats per editor"]:::action
    MR["markThreadAsRead()\nactualitza read_by_recipient"]:::action

    Ed -->|"obre modal"| MM
    MM --> DB
    MM -.->|"notificació silent on error"| CB
    Ad -->|"llegeix tots els fils"| AA
    AA --> DB
    Ad -->|"marca com llegit"| MR
    MR --> DB
```

---

## Sistema de temes visuals

L'aplicació implementa 5 temes visuals (skins) via atributs CSS:

| ID | Nom | Estil |
|----|-----|-------|
| `brutal` | Brutal | Neubrutalist taronja (defecte) |
| `pastel90s` | Pastels 90s | Rosa pastel |
| `wabi` | Wabi | Japonès verd |
| `cyber` | Cyber | Cyberpunk neó |
| `corp` | Corp | Corporatiu blau |

El `SkinContext` aplica l'atribut `data-skin="<id>"` a `document.documentElement`. El CSS usa selectores `[data-skin="<id>"]` per aplicar cada tema. La selecció es persisteix a `localStorage['fp-skin']` i és local al navegador (no es sincronitza entre dispositius).

---

## Sistema de destacats dual

El sistema té dos mecanismes de destacat independents:

**Destacats globals** (`bookmarks.highlighted`):
- Controlats per l'admin
- Visibles a la secció `DESTACAT` per a visitants anònims i per a l'admin
- Mostren fons taronja a les targetes de recurs per a l'admin

**Destacats personals** (`editor_highlights`):
- Per editor, emmagatzemats a la taula `editor_highlights`
- Visibles a la secció `DESTACAT` per a l'editor (no admin) autenticat
- Mostren fons taronja a les targetes de recurs quan l'editor consulta la galeria

El diagrama següent il·lustra com els dos mecanismes de destacat coexisteixen i quina vista obté cada rol:

```mermaid
graph TD
    classDef admin fill:#E74C3C,stroke:#A93226,color:#fff
    classDef editor fill:#3498DB,stroke:#1A5276,color:#fff
    classDef visitor fill:#2ECC71,stroke:#1A8A4A,color:#fff
    classDef db fill:#9B59B6,stroke:#6C3483,color:#fff
    classDef nav fill:#F5A623,stroke:#C47D0E,color:#fff

    Nav["Secció DESTACAT\n(barra navegació)\ncomptador = globals sempre"]:::nav

    subgraph Globals["Destacats globals (bookmarks.highlighted)"]
        GA["Admin marca estrella\na qualsevol recurs"]:::admin
        GT["bookmarks.highlighted = true"]:::db
    end

    subgraph Personals["Destacats personals (editor_highlights)"]
        EA["Editor marca estrella\nals seus recursos"]:::editor
        ET["editor_highlights\n(user_id, bookmark_id)"]:::db
    end

    GA --> GT
    EA --> ET

    Nav -->|"Admin clica DESTACAT"| GV["Veu recursos globals\nhighlighted=true\nfons taronja a targetes"]:::admin
    Nav -->|"Visitant clica DESTACAT"| VV["Veu recursos globals\nhighlighted=true"]:::visitor
    Nav -->|"Editor clica DESTACAT"| EV["Veu la seva llista\npersonal (editor_highlights)\nfons taronja a targetes"]:::editor
```

> **Nota**: La secció `DESTACAT` a la barra de navegació sempre comptabilitza els destacats globals (`highlightedBookmarks.length`), independentment del rol del visitant. El contingut que es mostra en clicar-la depèn del rol.

---

## Integracions externes

| Servei | Propòsit | Des d'on s'invoca | Credencials |
|--------|---------|------------------|-------------|
| **Supabase** | BD, Auth, Edge Functions | Tota l'app + extensió | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend); secrets Supabase (funcions) |
| **Groq API** | Suggeriment de metadades via LLM | Edge Function `suggest-resource` | `GROQ_API_KEY` (secret Supabase) |
| **Resend** | Correus transaccionals (invitació, aprovació, rebuig) | Edge Function `handle-editor-request` | `RESEND_API_KEY` (secret Supabase) |
| **CallMeBot** | Notificacions WhatsApp a l'admin | Frontend (browser) — **no servidor** | `VITE_CALLMEBOT_PHONE`, `VITE_CALLMEBOT_APIKEY` (exposats al bundle) |

---

## Decisió arquitectònica: absència de router de client

L'aplicació no utilitza cap biblioteca de router de client (React Router, etc.). La navegació entre les tres vistes lògiques (pública, editor, admin) es gestiona via una variable d'estat React: `view: 'public' | 'editor' | 'admin'`. No hi ha cap comentari al codi que expliqui aquesta decisió. Amb únicament tres vistes de primer nivell, un router complet no era estrictament necessari en el moment del disseny original.

---

## Decisió arquitectònica: taules de base de dades al dashboard

Quatre taules (`messages`, `editor_requests`, `contact_requests`, `editor_highlights`) i la columna `admin_reviewed` de `bookmarks` van ser creades directament al dashboard de Supabase en lloc d'afegir-les al fitxer de migració. No hi ha cap documentació al repositori que expliqui aquesta decisió. Com a conseqüència:

- Les polítiques RLS d'aquestes taules no estan versionades
- Cal crear-les manualment en qualsevol desplegament nou
- L'auditoria de seguretat d'aquestes taules requereix accés al dashboard de Supabase

---

## Limitacions i deute tècnic documentat

| Àmbit | Descripció |
|-------|-----------|
| **Arquitectura frontend** | `App.tsx` (~1622 línies, ~62KB) conté tota la lògica de la vista pública. Hauria de separar-se en components de pàgina individuals |
| **Tests** | El directori `src/` no té tests. L'extensió Chrome té 4 fitxers de test amb Vitest |
| **Tipatge TypeScript** | `types/database.ts` cobreix únicament 3 taules amb tipatge complet. Les taules de dashboard (`messages`, `editor_requests`, `contact_requests`) usen interfícies independents. `editor_highlights` no té tipatge |
| **Paginació** | `getBookmarks()` recupera tots els recursos sense paginació |
| **CI/CD** | No existeix cap pipeline d'integració contínua. El desplegament és completament manual |
| **Monitoratge** | No hi ha integració amb cap servei de logging ni error tracking extern. Els errors de les Edge Functions apareixen únicament als logs del dashboard de Supabase |

---

## Estructura de directoris

```
fp-recursos/
├── src/                          # Aplicació web React
│   ├── components/               # Components UI compartits
│   │   ├── BookmarkCard.tsx
│   │   ├── BookmarkForm.tsx
│   │   ├── Header.tsx
│   │   ├── MessagesModal.tsx
│   │   ├── ContactModal.tsx
│   │   ├── ContactsAdminModal.tsx
│   │   ├── EditorRequestModal.tsx
│   │   ├── EditorRequestsAdminModal.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── SetPasswordModal.tsx
│   │   ├── SkinPicker.tsx
│   │   ├── ScrollToTop.tsx
│   │   └── UI.tsx                # Primitives compartits (Button, Input, etc.)
│   ├── context/
│   │   ├── AuthContext.tsx        # Sessió, perfil, isAdmin, isEditor
│   │   └── SkinContext.tsx        # Tema actiu, persistència localStorage
│   ├── lib/
│   │   └── supabase.ts            # Instància client Supabase
│   ├── pages/
│   │   ├── EditorView.tsx
│   │   ├── AdminView.tsx
│   │   └── LoginPage.tsx
│   ├── services/                  # Capa d'accés a dades (supabase.from() wrappers)
│   │   ├── bookmarks.ts
│   │   ├── categories.ts
│   │   ├── profiles.ts
│   │   ├── messages.ts
│   │   ├── contacts.ts
│   │   ├── editorRequests.ts
│   │   ├── highlights.ts
│   │   └── ai.ts
│   ├── skins/
│   │   └── index.ts               # Metadades dels 5 temes
│   ├── types/
│   │   └── database.ts            # Tipus TypeScript (cobreix 3 taules)
│   ├── App.tsx                    # Component principal (~1622 línies)
│   └── main.tsx                   # Entry point: SkinProvider > AuthProvider > App
│
├── extension/                     # Extensió Chrome MV3 (build independent)
│   ├── background/
│   │   └── service-worker.ts      # 9 tipus de missatge; gestió sessió chrome.storage
│   ├── content/
│   │   └── content.ts             # Extracció metadades DOM
│   ├── popup/
│   │   └── popup.tsx              # UI React (mode pàgina + mode pestanyes)
│   ├── shared/
│   │   ├── api.ts                 # Crides Supabase REST + suggest-resource
│   │   ├── config.ts              # Constants hardcodejades (URL + anon key)
│   │   └── types.ts
│   ├── tests/                     # 4 fitxers Vitest
│   └── dist/                      # Build de l'extensió (commitejat)
│
├── supabase/
│   ├── functions/
│   │   ├── suggest-resource/
│   │   ├── handle-editor-request/
│   │   ├── create-editor/
│   │   ├── delete-editor/
│   │   └── change-user-password/
│   └── migrations/
│       └── 001_initial_schema.sql  # Única migració (3 taules + triggers + RLS)
│
├── public/                        # Estàtics públics
├── .env.example                   # Només VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── deploy-manual-steps.md         # Instruccions de desplegament (parcialment desactualitzades)
└── TODO.md                        # Llista de tasques del projecte
```

---

## Seguretat — resum d'arquitectura

Per a la guia completa de seguretat, consulteu el document de desplegament. A continuació el resum arquitectònic:

**Controls implementats correctament**:
- RLS a PostgreSQL per a `profiles`, `categories` i `bookmarks`
- Verificació de rol admin al servidor en 3 de 5 Edge Functions
- Protecció contra eliminació d'admins a `delete-editor`
- Missatge genèric al reset de contrasenya (evita enumeració d'usuaris)
- Renderitzat via React sense `dangerouslySetInnerHTML` (mitiga XSS a la UI)

**Vulnerabilitats arquitectòniques documentades**:

| Severitat | Descripció |
|-----------|-----------|
| CRÍTICA | `handle-editor-request` sense autenticació ni autorització. Opera amb service role sense validar cap JWT |
| ALTA | Credencials CallMeBot (`VITE_CALLMEBOT_PHONE`, `VITE_CALLMEBOT_APIKEY`) incloses al bundle JavaScript del navegador |
| ALTA | Injecció HTML possible als correus Resend via camps d'entrada d'usuari no escapats |
| MITJANA | SSRF parcial a `suggest-resource` (fetch de URL sense validació d'esquema/host) |
| MITJANA | CORS totalment obert (`*`) a totes les Edge Functions |
| BAIXA | Polítiques RLS de 4 taules no versionades al repositori |
