# Botó "Més recents" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afegir un botó "Més recents" a la navegació (desktop i mòbil) que mostri tots els bookmarks en una llista plana ordenada cronològicament, com a alternativa a la vista agrupada per categories.

**Architecture:** Tot el treball és dins `src/App.tsx` (component monolític existent, sense refactor addicional). S'afegeix un `useState` de toggle (`showRecentView`), un `useMemo` derivat (`recentBookmarks`), es reaprofita el patró visual ja existent de "Resultats de cerca" per al contingut, i es reaprofiten els botons de nav ja existents (CERCAR) com a referència d'estil pel botó nou.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind. Sense tests automatitzats de frontend (no n'hi ha a `src/`); verificació via `npx tsc -b`, `npm run build` i comprovació manual al navegador.

**Spec de referència:** `docs/superpowers/specs/2026-07-27-mes-recents-design.md`

---

### Task 1: Estat, dada derivada i lògica de sortida (toggle)

**Goal:** Afegir l'estat `showRecentView`, la llista `recentBookmarks` ordenada cronològicament, i connectar la lògica que fa que cerca/categories desactivin la vista de recents en entrar-hi.

**Files:**
- Modify: `src/App.tsx:2-16` (import d'icona `Clock`)
- Modify: `src/App.tsx:73` (nou estat, just després de `isSearchModalOpen`)
- Modify: `src/App.tsx:233` (nou `useMemo`, just després de `searchResults`)
- Modify: `src/App.tsx:248-256` (`scrollToCategory` — afegir sortida de `showRecentView`)
- Modify: `src/App.tsx:259-262` (`handleSearch` — desactivar `showRecentView`)
- Modify: `src/App.tsx:701` (botó CERCAR desktop — desactivar `showRecentView` en obrir)
- Modify: `src/App.tsx:1000-1010` (botó CERCAR mòbil — desactivar `showRecentView` en obrir)

**Acceptance Criteria:**
- [ ] `showRecentView` existeix com a estat booleà, per defecte `false`
- [ ] `recentBookmarks` és un array memoitzat amb tots els `bookmarks`, ordenat per `created_at` descendent (més recent primer)
- [ ] `toggleRecentView()` alterna `showRecentView`; quan l'activa, buida `searchQuery`, tanca el menú mòbil i fa scroll a dalt
- [ ] Obrir el cercador (desktop o mòbil) desactiva `showRecentView`
- [ ] Executar una cerca (`handleSearch`) desactiva `showRecentView`
- [ ] Clicar una categoria mentre `showRecentView` és `true` desactiva la vista de recents i fa scroll a la secció de la categoria un cop renderitzada
- [ ] `npx tsc -b` passa sense errors nous

**Verify:** `npx tsc -b` → exit 0

**Steps:**

- [ ] **Step 1: Afegir la icona `Clock` a la importació de `lucide-react`**

A `src/App.tsx:2-16`, el bloc actual és:

```tsx
import {
	Search,
	Menu,
	X,
	Settings,
	Plus,
	LogOut,
	Download,
	Trash2,
	Edit2,
	Check,
	User,
	MessageSquare,
	Mail,
} from 'lucide-react'
```

Afegeix `Clock` a la llista:

```tsx
import {
	Search,
	Menu,
	X,
	Settings,
	Plus,
	LogOut,
	Download,
	Trash2,
	Edit2,
	Check,
	User,
	MessageSquare,
	Mail,
	Clock,
} from 'lucide-react'
```

- [ ] **Step 2: Afegir l'estat `showRecentView`**

A `src/App.tsx:73`, just després de:

```tsx
	const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
```

afegeix:

```tsx
	const [showRecentView, setShowRecentView] = useState(false)
```

- [ ] **Step 3: Afegir el `useMemo` de `recentBookmarks`**

A `src/App.tsx`, just després del bloc `searchResults` (acaba a la línia 233 amb `}, [bookmarks, searchQuery])`), afegeix:

```tsx
	const recentBookmarks = useMemo(
		() =>
			[...bookmarks].sort(
				(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
			),
		[bookmarks],
	)
```

- [ ] **Step 4: Afegir `toggleRecentView` i actualitzar `scrollToCategory`**

A `src/App.tsx:248-256`, el codi actual és:

```tsx
	function scrollToCategory(cat: string) {
		const el = document.getElementById(`category-${cat}`)
		if (el) {
			const offset = 80
			const bodyRect = document.body.getBoundingClientRect().top
			const top = el.getBoundingClientRect().top - bodyRect - offset
			window.scrollTo({ top, behavior: 'smooth' })
			setIsMobileMenuOpen(false)
		}
	}
```

Substitueix-lo per (separa la lògica de scroll en `scrollToCategoryElement` i fa que `scrollToCategory` surti primer de `showRecentView` si cal):

```tsx
	function scrollToCategoryElement(cat: string) {
		const el = document.getElementById(`category-${cat}`)
		if (el) {
			const offset = 80
			const bodyRect = document.body.getBoundingClientRect().top
			const top = el.getBoundingClientRect().top - bodyRect - offset
			window.scrollTo({ top, behavior: 'smooth' })
			setIsMobileMenuOpen(false)
		}
	}

	function scrollToCategory(cat: string) {
		if (showRecentView) {
			setShowRecentView(false)
			setTimeout(() => scrollToCategoryElement(cat), 150)
			return
		}
		scrollToCategoryElement(cat)
	}

	function toggleRecentView() {
		setIsMobileMenuOpen(false)
		if (showRecentView) {
			setShowRecentView(false)
			return
		}
		setShowRecentView(true)
		setSearchQuery('')
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}
```

- [ ] **Step 5: Desactivar `showRecentView` en executar una cerca**

A `src/App.tsx:259-262`, el codi actual és:

```tsx
	function handleSearch(query: string) {
		setSearchQuery(query)
		setIsSearchModalOpen(false)
	}
```

Substitueix-lo per:

```tsx
	function handleSearch(query: string) {
		setSearchQuery(query)
		setIsSearchModalOpen(false)
		setShowRecentView(false)
	}
```

- [ ] **Step 6: Desactivar `showRecentView` en obrir el cercador (desktop)**

A `src/App.tsx:701`, el codi actual és:

```tsx
						<button
							onClick={() => setIsSearchModalOpen(true)}
							className='px-3 py-1 bg-accent border-skin text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000]'
						>
							<Search size={14} /> CERCAR
						</button>
```

Substitueix l'`onClick`:

```tsx
						<button
							onClick={() => {
								setIsSearchModalOpen(true)
								setShowRecentView(false)
							}}
							className='px-3 py-1 bg-accent border-skin text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000]'
						>
							<Search size={14} /> CERCAR
						</button>
```

- [ ] **Step 7: Desactivar `showRecentView` en obrir el cercador (mòbil)**

A `src/App.tsx:1000-1010`, el codi actual és:

```tsx
							<button
								onClick={() => {
									setIsMobileMenuOpen(false)
									setIsSearchModalOpen(true)
								}}
								className='text-left font-bold font-skin text-lg border-skin p-3 bg-accent hover:bg-black hover:text-white transition-all flex justify-between items-center shadow-skin-sm'
							>
								<span className='flex items-center gap-2'>
									<Search size={18} /> CERCAR
								</span>
							</button>
```

Substitueix l'`onClick`:

```tsx
							<button
								onClick={() => {
									setIsMobileMenuOpen(false)
									setIsSearchModalOpen(true)
									setShowRecentView(false)
								}}
								className='text-left font-bold font-skin text-lg border-skin p-3 bg-accent hover:bg-black hover:text-white transition-all flex justify-between items-center shadow-skin-sm'
							>
								<span className='flex items-center gap-2'>
									<Search size={18} /> CERCAR
								</span>
							</button>
```

- [ ] **Step 8: Verificar tipus**

Run: `npx tsc -b`
Expected: exit 0, sense errors nous (l'app encara no compila el JSX del botó/secció nous — això és normal, arriba a Tasks 2 i 3; aquest pas només verifica que la lògica de Task 1 tipa correctament).

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: afegir estat i lògica de toggle per a la vista Més recents"
```

---

### Task 2: Botó "Més recents" a la navegació (desktop + mòbil)

**Goal:** Mostrar el botó "Més recents" a la nav sticky desktop i al menú mòbil, just després de "CERCAR" i abans de la llista de categories, amb estil actiu quan `showRecentView` és `true`.

**Files:**
- Modify: `src/App.tsx:706` (nav sticky desktop, abans del `<div className='flex flex-wrap gap-2'>` de categories)
- Modify: `src/App.tsx:1011` (menú mòbil, abans del `.map` de categories)

**Acceptance Criteria:**
- [ ] El botó apareix a la nav sticky desktop, entre "CERCAR" i la llista de categories
- [ ] El botó apareix al menú mòbil, entre "CERCAR" i la llista de categories
- [ ] Quan `showRecentView` és `true`, el botó es mostra amb `bg-black text-white` (estil actiu); quan és `false`, amb `bg-accent` (estil per defecte, igual que CERCAR)
- [ ] El botó crida `toggleRecentView` en fer click
- [ ] `npx tsc -b` i `npm run build` passen sense errors

**Verify:** `npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Afegir el botó a la nav sticky desktop**

A `src/App.tsx`, dins del bloc de la nav sticky desktop (~línia 693-750), just després del botó CERCAR (acaba a la línia 705 amb `</button>`) i abans de:

```tsx
						<div className='flex flex-wrap gap-2'>
							{[...categories]
```

insereix:

```tsx
						<button
							onClick={toggleRecentView}
							className={`px-3 py-1 border-skin text-xs font-bold uppercase transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000] ${
								showRecentView ? 'bg-black text-white' : 'bg-accent hover:bg-black hover:text-white'
							}`}
						>
							<Clock size={14} /> MÉS RECENTS
						</button>
```

- [ ] **Step 2: Afegir el botó al menú mòbil**

A `src/App.tsx`, dins del menú mòbil (~línia 989-1050), just després del botó CERCAR mòbil (acaba amb `</button>` després de l'`onClick` actualitzat a la Task 1) i abans de:

```tsx
							{[...categories]
								.sort((a, b) => a.name.localeCompare(b.name))
								.map((cat) => {
```

insereix:

```tsx
							<button
								onClick={toggleRecentView}
								className={`text-left font-bold font-skin text-lg border-skin p-3 transition-all flex justify-between items-center shadow-skin-sm ${
									showRecentView ? 'bg-black text-white' : 'bg-accent hover:bg-black hover:text-white'
								}`}
							>
								<span className='flex items-center gap-2'>
									<Clock size={18} /> MÉS RECENTS
								</span>
							</button>
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: afegir botó Més recents a la nav desktop i mòbil"
```

---

### Task 3: Vista de contingut cronològica i gating de les seccions existents

**Goal:** Mostrar la llista plana `recentBookmarks` quan `showRecentView` és `true`, i amagar les seccions de categories/Altres/DESTACAT mentre hi és.

**Files:**
- Modify: `src/App.tsx:1138` (gate seccions per categoria)
- Modify: `src/App.tsx:1181` (gate secció Altres)
- Modify: `src/App.tsx:1220` (gate secció DESTACAT)
- Modify: `src/App.tsx` (nova secció, inserida abans del comentari `{/* Seccions per categoria */}`, ~línia 1137)

**Acceptance Criteria:**
- [ ] Quan `showRecentView` és `true` i no hi ha `searchQuery`, es mostra una graella única amb tots els bookmarks de `recentBookmarks`, sense agrupar, amb capçalera "Més recents" i comptador
- [ ] Cada `BookmarkCard` de la nova secció rep les mateixes props que a la resta de seccions (`canEdit`, `canHighlight`, `onEdit`, `onDelete`, `onToggleHighlight`, `isOrphan`, `isUnreviewed`, `isNew`, `highlighted`)
- [ ] Mentre `showRecentView` és `true`, les seccions de categories, "Altres" i "DESTACAT" no es renderitzen
- [ ] Quan `showRecentView` torna a `false`, les seccions normals tornen a aparèixer
- [ ] `npm run build` passa sense errors i `grep -rl "callmebot" dist/` segueix sense resultats (no relacionat amb aquest canvi, comprovació de regressió ràpida)

**Verify:** `npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Afegir la nova secció "Més recents"**

A `src/App.tsx`, just abans del comentari:

```tsx
				{/* Seccions per categoria */}
```

(~línia 1137, immediatament després del tancament del bloc de "Resultats de cerca"), insereix:

```tsx
				{/* Vista "Més recents" */}
				{showRecentView && !searchQuery && (
					<div>
						<div className='flex items-center gap-4 mb-6 flex-wrap'>
							<h2 className='text-3xl font-black uppercase bg-black text-white px-4 py-2 inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]'>
								Més recents
							</h2>
							<span className='font-skin font-bold text-xl text-gray-500'>
								{recentBookmarks.length} recurs{recentBookmarks.length !== 1 ? 'os' : ''}
							</span>
						</div>
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6'>
							{recentBookmarks.map((b) => (
								<BookmarkCard
									key={b.id}
									bookmark={{
										...b,
										highlighted: isAdmin ? b.highlighted : isPersonalHighlight(b.id),
									}}
									canEdit={isAdmin || (isEditor && b.user_id === user?.id)}
									canHighlight={isAdmin || isEditor}
									onEdit={handleEditBookmark}
									onDelete={handleDelete}
									onToggleHighlight={
										isAdmin ? handleToggleHighlight : handleToggleEditorHighlight
									}
									isOrphan={orphanBookmarkIds.has(b.id)}
									isUnreviewed={isAdmin && !b.admin_reviewed && b.user_id !== user?.id}
									isNew={newBookmarkIds.has(b.id)}
								/>
							))}
						</div>
					</div>
				)}
```

- [ ] **Step 2: Gate la secció de categories**

A `src/App.tsx:1138`, el codi actual és:

```tsx
				{/* Seccions per categoria */}
				{!searchQuery &&
					[...categories]
```

Canvia la condició:

```tsx
				{/* Seccions per categoria */}
				{!searchQuery &&
					!showRecentView &&
					[...categories]
```

- [ ] **Step 3: Gate la secció "Altres"**

A `src/App.tsx:1181`, el codi actual és:

```tsx
				{/* Secció Altres */}
				{!searchQuery && groupedBookmarks['Altres'] && groupedBookmarks['Altres'].length > 0 && (
```

Canvia la condició:

```tsx
				{/* Secció Altres */}
				{!searchQuery &&
					!showRecentView &&
					groupedBookmarks['Altres'] &&
					groupedBookmarks['Altres'].length > 0 && (
```

- [ ] **Step 4: Gate la secció "DESTACAT"**

A `src/App.tsx:1220`, el codi actual és:

```tsx
				{/* Secció virtual DESTACAT */}
				{!searchQuery && displayHighlighted.length > 0 && (
```

Canvia la condició:

```tsx
				{/* Secció virtual DESTACAT */}
				{!searchQuery && !showRecentView && displayHighlighted.length > 0 && (
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 6: Comprovació manual**

Amb `npm run dev`, al navegador:
1. Clicar "MÉS RECENTS" → apareix una única graella amb tots els recursos, el més recent primer, sense capçaleres de categoria, cap secció DESTACAT/Altres separada. El botó es veu amb fons negre (actiu).
2. Tornar a clicar "MÉS RECENTS" → torna la vista agrupada per categories, botó torna a l'estil normal.
3. Activar "MÉS RECENTS" i clicar "CERCAR" → la vista de recents es tanca (botó torna a l'estil normal), s'obre el cercador.
4. Activar "MÉS RECENTS" i clicar una categoria del nav → es tanca la vista de recents i fa scroll a la secció d'aquella categoria.
5. Repetir 1-4 al menú mòbil (burger).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: mostrar llista cronològica plana a la vista Més recents"
```

---

## Self-Review

**Cobertura de l'spec:**
- Botó a nav sticky desktop + menú mòbil, no al modal de categories → Task 2 ✓
- Posició: després de CERCAR, abans de categories → Task 2 ✓
- Estat toggle amb estil actiu `bg-black text-white` → Task 2 ✓
- Tots els bookmarks barrejats cronològicament (destacats + Altres inclosos) → Task 1 (`recentBookmarks`) + Task 3 ✓
- Cerca desactiva "Més recents" → Task 1 Steps 5-7 ✓
- Clicar categoria desactiva "Més recents" i fa scroll → Task 1 Step 4 ✓
- Toggle click per sortir → Task 1 Step 4 (`toggleRecentView`) ✓
- Seccions existents amagades mentre `showRecentView` és actiu → Task 3 Steps 2-4 ✓

**Sense placeholders:** cada step té el codi complet, sense "TODO" ni "similar a l'anterior".

**Consistència de tipus:** `showRecentView`/`setShowRecentView`, `recentBookmarks`, `toggleRecentView`, `scrollToCategoryElement` s'usen amb el mateix nom a totes les tasks on apareixen.
