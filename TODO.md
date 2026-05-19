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
