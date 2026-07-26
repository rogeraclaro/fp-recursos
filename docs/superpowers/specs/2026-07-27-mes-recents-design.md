# Disseny: botó "Més recents"

## Context

Actualment els recursos es mostren agrupats per categoria (una secció per
categoria, ordenada alfabèticament, amb els bookmarks de cada categoria
ordenats cronològicament per dins). Es vol afegir una vista alternativa que
mostri **tots** els recursos en una única llista plana, ordenada
cronològicament (últim afegit primer), sense cap agrupació.

## Objectiu

Afegir un botó "Més recents" a la navegació (desktop i mòbil) que activi
aquesta vista plana cronològica com a alternativa a la vista agrupada per
categories.

## Abast

**Dins:**
- Botó nou a la nav sticky desktop (`src/App.tsx` ~línia 693).
- Botó nou al menú mòbil de categories (`src/App.tsx` ~línia 989).
- Nova vista de contingut: llista plana de tots els bookmarks ordenats per
  `created_at` descendent.
- Estat de toggle amb els punts de sortida especificats a "Comportament".

**Fora d'abast:**
- El modal de gestió de categories (admin/editor, ~línia 1300 i ~línia 1488)
  no es toca — el botó no hi apareix.
- No hi ha paginació ni límit de resultats — mateix comportament que la resta
  de llistats actuals (renderitzat complet).
- No es persisteix l'estat entre recàrregues de pàgina (no URL param, no
  localStorage) — és estat efímer de sessió, com `searchQuery`.

## Disseny

### Estat nou

```ts
const [showRecentView, setShowRecentView] = useState(false)
```

### Dada derivada nova

```ts
const recentBookmarks = useMemo(
  () => [...bookmarks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  [bookmarks],
)
```

Inclou **tots** els bookmarks visibles per l'usuari actual (destacats i
"Altres" inclosos) — no hi ha cap secció especial dins d'aquesta vista, tot
barrejat cronològicament.

### Botó — ubicació i estil

En ambdós llocs (nav sticky desktop i menú mòbil), s'insereix just després
del botó "CERCAR" i abans de la llista de categories.

- Estil base igual que "CERCAR" (`bg-accent`, mateixa mida de font/padding).
- Quan `showRecentView === true`, aplica l'estil "actiu": `bg-black
  text-white` (el mateix look que ja s'usa a l'estat `:hover` dels altres
  botons de nav) — és l'únic indicador visual que la vista està activa.
- Icona `Clock` (lucide-react, ja és una dependència del projecte).
- Text: "MÉS RECENTS".

### Comportament (toggle)

| Acció | Efecte |
|---|---|
| Click al botó, `showRecentView === false` | `setShowRecentView(true)`, `setSearchQuery('')`, tanca menú mòbil si obert, `window.scrollTo({ top: 0, behavior: 'smooth' })` |
| Click al botó, `showRecentView === true` | `setShowRecentView(false)` |
| Obrir el modal de cerca (`setIsSearchModalOpen(true)`) o executar `handleSearch` | `setShowRecentView(false)` (cerca i "Més recents" són mutuament excloents) |
| Click a una categoria concreta del nav mentre `showRecentView === true` | `setShowRecentView(false)`; després, amb `setTimeout` (mateix patró que `handleNavigateToBookmark`, ~150ms per permetre que el DOM normal es renderitzi), crida la lògica existent de `scrollToCategory(cat)` |

### Contingut principal

Nova secció al `<main>`, amb el mateix format visual que la secció
"Resultats de cerca" existent (~línia 1090):

- Capçalera: títol "Més recents" + comptador (`recentBookmarks.length`
  recursos).
- Graella `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4
  gap-6` amb `BookmarkCard` per cada element de `recentBookmarks`, amb les
  mateixes props que ja s'apliquen a les altres seccions
  (`canEdit`, `canHighlight`, `onEdit`, `onDelete`, `onToggleHighlight`,
  `isOrphan`, `isUnreviewed`, `isNew`, `highlighted` calculat igual que a
  la resta de seccions).
- Condició de renderitzat: `showRecentView && !searchQuery`.

Les tres seccions existents (categories, "Altres", "DESTACAT") passen a
estar gated per `!searchQuery && !showRecentView` (s'afegeix la nova
condició a la que ja hi havia, `!searchQuery`).

### Casos buit

Si `recentBookmarks.length === 0` (no hauria de passar mai que
`showRecentView` estigui actiu sense bookmarks, ja que el botó només té
sentit quan n'hi ha, però per coherència amb el patró de "Resultats de
cerca") es mostra el mateix bloc de "Cap resultat" reaprofitant l'estil
existent.

## Testing

No hi ha tests automatitzats de frontend a `src/` (confirmat prèviament —
només n'hi ha a `extension/`). Verificació manual:

1. Amb bookmarks de diverses categories i dates diferents, clicar "Més
   recents" → apareix una única graella amb tots els recursos, el més
   recent primer, sense capçaleres de categoria.
2. Tornar a clicar "Més recents" → torna la vista agrupada per categories.
3. Activar "Més recents" i després obrir "CERCAR" → la vista de recents es
   tanca, apareix la cerca.
4. Activar "Més recents" i clicar una categoria del nav → es tanca la vista
   de recents i fa scroll a la secció d'aquella categoria.
5. Provar al mòbil (menú burger): mateix comportament.
6. Provar amb rol admin, editor i visitant anònim — el botó i la vista han
   d'estar disponibles per a tothom igual que la resta de nav.
