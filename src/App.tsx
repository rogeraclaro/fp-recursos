import React, { useState, useMemo, useEffect } from 'react'
import { Search, Menu, X, Settings, Plus, LogOut, Download, Trash2, Edit2, Check } from 'lucide-react'
import { BookmarkCard } from './components/BookmarkCard'
import { BookmarkForm } from './components/BookmarkForm'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ScrollToTop } from './components/ScrollToTop'
import { useAuth } from './context/AuthContext'
import { getBookmarks, createBookmark, deleteBookmark, toggleHighlight, updateBookmark } from './services/bookmarks'
import { getCategories, createCategory, updateCategory, deleteCategory } from './services/categories'
import type { Bookmark, BookmarkInsert, Category } from './types/database'
import { theme } from './theme'

type View = 'public' | 'editor' | 'admin'

const EditorView = React.lazy(() => import('./pages/EditorView').then(m => ({ default: m.EditorView })))
const AdminView = React.lazy(() => import('./pages/AdminView').then(m => ({ default: m.AdminView })))

export default function App() {
  const { isAdmin, isEditor, user, profile, signOut } = useAuth()
  const [view, setView] = useState<View>('public')
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null)
  const [showNewResourceForm, setShowNewResourceForm] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    Promise.all([getBookmarks(), getCategories()])
      .then(([bks, cats]) => {
        setBookmarks(bks)
        setCategories(cats)
      })
      .finally(() => setLoading(false))
  }, [])

  const groupedBookmarks = useMemo(() => {
    const groups: Record<string, Bookmark[]> = {}
    categories.forEach(c => { groups[c.name] = [] })
    bookmarks.forEach(b => {
      b.categories.forEach(cat => {
        if (groups[cat]) {
          groups[cat].push(b)
        } else {
          if (!groups['Altres']) groups['Altres'] = []
          groups['Altres'].push(b)
        }
      })
    })
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    })
    return groups
  }, [bookmarks, categories])

  const highlightedBookmarks = useMemo(() => {
    return bookmarks
      .filter(b => b.highlighted)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [bookmarks])

  const orphanCategories = useMemo(() => {
    const known = new Set(categories.map(c => c.name))
    const orphans = new Set<string>()
    bookmarks.forEach(b => b.categories.forEach(cat => { if (!known.has(cat)) orphans.add(cat) }))
    return [...orphans].sort()
  }, [bookmarks, categories])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const lq = searchQuery.toLowerCase()
    return bookmarks.filter(b =>
      b.title.toLowerCase().includes(lq) ||
      b.description?.toLowerCase().includes(lq) ||
      b.url.toLowerCase().includes(lq)
    )
  }, [bookmarks, searchQuery])

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

  function handleSearch(query: string) {
    setSearchQuery(query)
    setIsSearchModalOpen(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar aquest recurs?')) return
    await deleteBookmark(id)
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }

  async function handleToggleHighlight(id: string, highlighted: boolean) {
    await toggleHighlight(id, highlighted)
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, highlighted } : b))
  }

  async function handleEditSave(data: BookmarkInsert) {
    if (!editingBookmark) return
    const { user_id: _, ...updates } = data
    const updated = await updateBookmark(editingBookmark.id, updates)
    setBookmarks(prev => prev.map(b => b.id === updated.id ? updated : b))
    setEditingBookmark(null)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const bks = await getBookmarks()
      const blob = new Blob([JSON.stringify(bks, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fp-recursos-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function handleCreateBookmark(data: BookmarkInsert) {
    const created = await createBookmark(data)
    setBookmarks(prev => [created, ...prev])
    setShowNewResourceForm(false)
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim() || !user) return
    const cat = await createCategory(newCategoryName.trim(), user.id)
    setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
    setNewCategoryName('')
  }

  async function handleUpdateCategory(id: string, name: string) {
    const updated = await updateCategory(id, name)
    setCategories(prev => prev.map(c => c.id === id ? updated : c).sort((a, b) => a.name.localeCompare(b.name)))
    setEditingCat(null)
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Eliminar categoria? Els recursos que la tinguin perdran aquesta categoria.')) return
    await deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  async function handlePromoteOrphan(catName: string) {
    if (!user) return
    const cat = await createCategory(catName, user.id)
    setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handlePurgeOrphan(catName: string) {
    if (!confirm(`Eliminar "${catName}" de tots els recursos que la tinguin?`)) return
    const affected = bookmarks.filter(b => b.categories.includes(catName))
    for (const b of affected) {
      const newCats = b.categories.filter(c => c !== catName)
      const updated = await updateBookmark(b.id, { categories: newCats.length > 0 ? newCats : ['Altres'] })
      setBookmarks(prev => prev.map(bk => bk.id === updated.id ? updated : bk))
    }
  }

  const Fallback = () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className={theme.loadingSpinner} />
    </div>
  )

  if (view === 'editor') return (
    <ProtectedRoute>
      <React.Suspense fallback={<Fallback />}>
        <EditorView
          categories={categories}
          onBack={() => setView('public')}
          onBookmarksChange={setBookmarks}
        />
      </React.Suspense>
    </ProtectedRoute>
  )

  if (view === 'admin') return (
    <ProtectedRoute requireAdmin>
      <React.Suspense fallback={<Fallback />}>
        <AdminView
          categories={categories}
          onCategoriesChange={setCategories}
          onBack={() => setView('public')}
        />
      </React.Suspense>
    </ProtectedRoute>
  )

  return (
    <div className={theme.page}>
      {/* Header */}
      <header className="bg-white border-b-4 border-black p-6 shadow-md">
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black uppercase tracking-tighter bg-black text-white px-3 py-1 inline-block transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              FP Recursos
            </h1>
            <div className="hidden md:block h-8 w-0.5 bg-black/20" />
            <p className="hidden md:block font-mono text-sm text-gray-600 font-bold">
              Total: {bookmarks.length} | Categories: {categories.length}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-end">
            {isAdmin && (
              <>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex items-center gap-1.5 font-mono font-bold text-sm px-4 py-2.5 border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] hover:bg-orange-400 transition-colors disabled:opacity-50"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">{exporting ? 'Exportant...' : 'Exportar'}</span>
                </button>
                <button
                  onClick={() => setShowNewResourceForm(true)}
                  className="flex items-center gap-1.5 font-mono font-bold text-sm px-4 py-2.5 border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] hover:bg-orange-400 transition-colors"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Nou recurs</span>
                </button>
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="flex items-center gap-1.5 font-mono font-bold text-sm px-4 py-2.5 border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] hover:bg-orange-400 transition-colors"
                >
                  <Settings size={16} />
                  <span className="hidden sm:inline">Categories</span>
                </button>
                <button
                  onClick={() => setView('admin')}
                  className="flex items-center gap-1.5 font-mono font-bold text-sm px-4 py-2.5 border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] hover:bg-orange-400 transition-colors"
                >
                  Editors
                </button>
              </>
            )}
            {!isAdmin && isEditor && (
              <button
                onClick={() => setView('editor')}
                className="flex items-center gap-1.5 font-mono font-bold text-sm px-4 py-2.5 border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] hover:bg-orange-400 transition-colors"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Els meus recursos</span>
                <span className="sm:hidden">Recursos</span>
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-gray-500 hidden sm:block">{profile?.username}</span>
                <button
                  onClick={signOut}
                  className="font-mono font-bold text-sm px-4 py-2.5 border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center gap-2"
                  title="Tancar sessió"
                >
                  <LogOut size={16} /> LOGOUT
                </button>
              </div>
            ) : (
              <button
                onClick={() => setView('editor')}
                className="font-mono font-bold text-sm px-5 py-2.5 border-2 border-black bg-orange-400 shadow-[4px_4px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                LOGIN
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Nav sticky de categories (desktop) */}
      {bookmarks.length > 0 && (
        <div className="hidden md:block sticky top-0 z-40 bg-[#f0f0f0]/95 backdrop-blur border-b-2 border-black py-3 px-6 shadow-sm">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-3">
            <span className="font-mono font-bold uppercase text-xs text-gray-500 whitespace-nowrap">
              SALTAR A:
            </span>
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="px-3 py-1 bg-orange-400 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000]"
            >
              <Search size={14} /> CERCAR
            </button>
            <div className="flex flex-wrap gap-2">
              {[...categories]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(cat => {
                  const count = groupedBookmarks[cat.name]?.length || 0
                  return (
                    <button
                      key={cat.id}
                      onClick={() => scrollToCategory(cat.name)}
                      className="px-3 py-1 bg-white text-black border border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#ccc]"
                    >
                      {cat.name}
                      <span className="bg-orange-400 text-black px-1.5 py-0.5 text-[10px] border border-black">
                        {count}
                      </span>
                    </button>
                  )
                })}
              {highlightedBookmarks.length > 0 && (
                <button
                  onClick={() => scrollToCategory('DESTACAT')}
                  className="px-3 py-1 bg-orange-400 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#000]"
                >
                  ★ DESTACAT
                  <span className="bg-black text-orange-400 px-1.5 py-0.5 text-[10px] border border-black">
                    {highlightedBookmarks.length}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botó burger mòbil (fix, centrat) */}
      <div className="md:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="bg-orange-400 border-2 border-black px-4 py-2 font-bold font-mono text-sm shadow-[4px_4px_0px_0px_#000] flex items-center gap-2 active:translate-y-[2px] active:shadow-none"
        >
          <Menu size={18} /> CATEGORIES
        </button>
      </div>

      {/* Modal mòbil de categories */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-sm max-h-[80vh] overflow-y-auto flex flex-col shadow-[8px_8px_0px_0px_#fff]">
            <div className="p-4 border-b-2 border-black bg-orange-400 flex justify-between items-center">
              <h2 className="font-bold text-xl uppercase font-mono">Categories</h2>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <button
                onClick={() => { setIsMobileMenuOpen(false); setIsSearchModalOpen(true) }}
                className="text-left font-bold font-mono text-lg border-2 border-black p-3 bg-orange-400 hover:bg-black hover:text-white transition-all flex justify-between items-center shadow-[4px_4px_0px_0px_#000]"
              >
                <span className="flex items-center gap-2"><Search size={18} /> CERCAR</span>
              </button>
              {[...categories]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(cat => {
                  const count = groupedBookmarks[cat.name]?.length || 0
                  return (
                    <button
                      key={cat.id}
                      onClick={() => scrollToCategory(cat.name)}
                      className="text-left font-bold font-mono text-lg border-2 border-black p-3 hover:bg-black hover:text-white transition-all flex justify-between items-center bg-white shadow-[4px_4px_0px_0px_#ccc]"
                    >
                      {cat.name}
                      <span className="bg-orange-300 text-black text-xs px-2 py-1 border border-black">{count}</span>
                    </button>
                  )
                })}
              {highlightedBookmarks.length > 0 && (
                <button
                  onClick={() => scrollToCategory('DESTACAT')}
                  className="text-left font-bold font-mono text-lg border-2 border-black p-3 hover:bg-black hover:text-white transition-all flex justify-between items-center bg-orange-400 shadow-[4px_4px_0px_0px_#000]"
                >
                  <span>★ DESTACAT</span>
                  <span className="bg-black text-orange-400 text-xs px-2 py-1 border border-black">{highlightedBookmarks.length}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contingut principal */}
      <main className="max-w-[1600px] mx-auto p-6 flex flex-col gap-12 mt-4 md:mt-4 pt-16 md:pt-4">
        {/* Estat buit */}
        {bookmarks.length === 0 && !loading && (
          <div className="text-center py-32 border-4 border-dashed border-gray-300 m-8 bg-gray-50">
            <p className="font-mono text-3xl font-bold text-gray-400 mb-4">Sense recursos</p>
            <p className="font-mono text-gray-500">
              {user ? 'Afegeix el primer recurs des de "Els meus recursos".' : 'Accedeix com a editor per afegir recursos.'}
            </p>
          </div>
        )}

        {/* Resultats de cerca */}
        {searchQuery && (
          <div>
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <h2 className="text-3xl font-black uppercase bg-orange-400 text-black px-4 py-2 inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] border-2 border-black">
                Resultats: "{searchQuery}"
              </h2>
              <span className="font-mono font-bold text-xl text-gray-500">
                {searchResults.length} resultat{searchResults.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="font-mono font-bold text-sm px-4 py-2 border-2 border-black bg-white hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
              >
                ✕ Netejar cerca
              </button>
            </div>
            {searchResults.length === 0 ? (
              <div className="text-center py-20">
                <p className="font-mono text-xl text-gray-600">Cap resultat per "{searchQuery}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                {searchResults.map(b => (
                  <BookmarkCard
                    key={b.id}
                    bookmark={b}
                    canEdit={isAdmin || (isEditor && b.user_id === user?.id)}
                    canHighlight={isAdmin}
                    onEdit={setEditingBookmark}
                    onDelete={handleDelete}
                    onToggleHighlight={handleToggleHighlight}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seccions per categoria */}
        {!searchQuery && [...categories]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(cat => {
            const items = groupedBookmarks[cat.name]
            if (!items || items.length === 0) return null
            return (
              <div key={cat.id} id={`category-${cat.name}`} className="scroll-mt-48">
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="text-3xl font-black uppercase bg-black text-white px-4 py-2 inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                    {cat.name}
                  </h2>
                  <span className="font-mono font-bold text-xl text-gray-500">{items.length}</span>
                  <div className="h-1 flex-grow bg-black" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {items.map(b => (
                    <BookmarkCard
                      key={b.id}
                      bookmark={b}
                      canEdit={isAdmin || (isEditor && b.user_id === user?.id)}
                      canHighlight={isAdmin}
                      onEdit={setEditingBookmark}
                      onDelete={handleDelete}
                      onToggleHighlight={handleToggleHighlight}
                    />
                  ))}
                </div>
              </div>
            )
          })}

        {/* Secció virtual DESTACAT */}
        {!searchQuery && highlightedBookmarks.length > 0 && (
          <div id="category-DESTACAT" className="scroll-mt-48">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-3xl font-black uppercase bg-orange-400 text-black px-4 py-2 inline-block border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                ★ DESTACAT
              </h2>
              <span className="font-mono font-bold text-xl text-gray-500">{highlightedBookmarks.length}</span>
              <div className="h-1 flex-grow bg-orange-400 border border-black" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
              {highlightedBookmarks.map(b => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  canEdit={isAdmin || (isEditor && b.user_id === user?.id)}
                  canHighlight={isAdmin}
                  onEdit={setEditingBookmark}
                  onDelete={handleDelete}
                  onToggleHighlight={handleToggleHighlight}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal d'edició */}
      {editingBookmark && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <BookmarkForm
            bookmark={editingBookmark}
            categories={categories}
            userId={editingBookmark.user_id}
            onSave={handleEditSave}
            onCancel={() => setEditingBookmark(null)}
          />
        </div>
      )}

      {/* Modal de cerca */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-lg shadow-[8px_8px_0px_0px_#000]">
            <div className="flex justify-between items-center p-4 border-b-2 border-black bg-orange-400">
              <h2 className="font-bold text-xl font-mono uppercase">Cercar Recursos</h2>
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="p-1 hover:bg-black hover:text-white transition-colors border border-black"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="Cercar per títol, descripció o URL..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(searchQuery) }}
                className="w-full border-2 border-black p-3 font-mono focus:outline-none focus:bg-orange-50"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsSearchModalOpen(false)}
                  className="font-mono font-bold text-sm px-4 py-2 border-2 border-black bg-white hover:bg-gray-100 transition-colors"
                >
                  Cancel·lar
                </button>
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="font-mono font-bold text-sm px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 flex items-center gap-2 transition-colors"
                >
                  <Search size={16} /> Cercar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal categories */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-md shadow-[8px_8px_0px_0px_#000]">
            <div className="flex justify-between items-center p-4 border-b-2 border-black bg-orange-400">
              <h2 className="font-bold text-xl font-mono uppercase">Categories</h2>
              <button
                onClick={() => { setIsCategoryModalOpen(false); setNewCategoryName('') }}
                className="p-1 hover:bg-black hover:text-white transition-colors border border-black"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nova categoria..."
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
                  className="flex-grow border-2 border-black p-2 font-mono text-sm focus:outline-none focus:bg-orange-50"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="font-mono font-bold text-sm px-4 py-2 border-2 border-black bg-orange-400 hover:bg-orange-500 disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <Plus size={14} /> Afegir
                </button>
              </div>
              <ul className="space-y-2 max-h-60 overflow-y-auto">
                {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                  <li key={cat.id} className="flex items-center gap-2 p-3 border-2 border-black">
                    {editingCat?.id === cat.id ? (
                      <>
                        <input
                          autoFocus
                          value={editingCat.name}
                          onChange={e => setEditingCat({ ...editingCat, name: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleUpdateCategory(cat.id, editingCat.name)
                            if (e.key === 'Escape') setEditingCat(null)
                          }}
                          className="flex-grow border-2 border-black p-1 font-mono text-sm focus:outline-none focus:bg-orange-50"
                        />
                        <button onClick={() => handleUpdateCategory(cat.id, editingCat.name)} className="p-1.5 hover:bg-green-100 border border-transparent hover:border-black transition-colors" title="Guardar"><Check size={14} /></button>
                        <button onClick={() => setEditingCat(null)} className="p-1.5 hover:bg-gray-100 border border-transparent hover:border-black transition-colors" title="Cancel·lar"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span className="font-mono flex-grow">{cat.name}</span>
                        <button onClick={() => setEditingCat({ id: cat.id, name: cat.name })} className="p-1.5 hover:bg-orange-100 border border-transparent hover:border-black transition-colors" title="Editar"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 hover:bg-red-100 border border-transparent hover:border-black transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                      </>
                    )}
                  </li>
                ))}
              </ul>

              {orphanCategories.length > 0 && (
                <div className="mt-4 border-t-2 border-black pt-4">
                  <p className="font-mono text-xs font-bold uppercase text-orange-600 mb-2">
                    Categories òrfenes ({orphanCategories.length}) — existeixen en recursos però no a la taula
                  </p>
                  <ul className="space-y-2">
                    {orphanCategories.map(catName => (
                      <li key={catName} className="flex items-center justify-between p-3 border-2 border-orange-400 bg-orange-50">
                        <span className="font-mono font-bold">{catName}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePromoteOrphan(catName)}
                            className="font-mono text-xs font-bold px-2 py-1 border-2 border-black bg-orange-400 hover:bg-orange-500 transition-colors"
                            title="Crear-la com a categoria oficial"
                          >
                            + Crear
                          </button>
                          <button
                            onClick={() => handlePurgeOrphan(catName)}
                            className="font-mono text-xs font-bold px-2 py-1 border-2 border-black bg-white hover:bg-red-100 transition-colors"
                            title="Eliminar de tots els recursos"
                          >
                            Purgar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nou recurs (admin) */}
      {showNewResourceForm && user && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <BookmarkForm
            categories={categories}
            userId={user.id}
            onSave={handleCreateBookmark}
            onCancel={() => setShowNewResourceForm(false)}
          />
        </div>
      )}

      <ScrollToTop />
    </div>
  )
}
