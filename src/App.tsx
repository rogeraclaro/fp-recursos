import React, { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Header } from './components/Header'
import { BookmarkCard } from './components/BookmarkCard'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ScrollToTop } from './components/ScrollToTop'
import { useAuth } from './context/AuthContext'
import { getBookmarks, deleteBookmark, toggleHighlight } from './services/bookmarks'
import { getCategories } from './services/categories'
import type { Bookmark, Category } from './types/database'
import { theme } from './theme'

type View = 'public' | 'editor' | 'admin'

// Lazy imports per evitar carregar tot el codi d'editor/admin a la vista pública
const EditorView = React.lazy(() => import('./pages/EditorView').then(m => ({ default: m.EditorView })))
const AdminView = React.lazy(() => import('./pages/AdminView').then(m => ({ default: m.AdminView })))

export default function App() {
  const { isAdmin, isEditor, user } = useAuth()
  const [view, setView] = useState<View>('public')
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getBookmarks(), getCategories()])
      .then(([bks, cats]) => {
        setBookmarks(bks)
        setCategories(cats)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return bookmarks.filter(b => {
      const matchCat = !filterCategory || b.categories.includes(filterCategory)
      const matchSearch = !search ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        (b.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        b.url.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [bookmarks, filterCategory, search])

  async function handleDelete(id: string) {
    if (!confirm('Eliminar aquest recurs?')) return
    await deleteBookmark(id)
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }

  async function handleToggleHighlight(id: string, highlighted: boolean) {
    await toggleHighlight(id, highlighted)
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, highlighted } : b))
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
      <Header view={view} onChangeView={setView} />

      {/* Barra de cerca i filtres */}
      <div className="sticky top-0 z-40 bg-[#f0f0f0]/95 backdrop-blur border-b-2 border-black py-3 px-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex gap-3 flex-wrap items-center">
          <div className="relative flex-grow min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="w-full bg-white border-2 border-black pl-8 pr-3 py-2 font-mono text-sm focus:outline-none focus:bg-orange-50 shadow-[2px_2px_0px_0px_#ccc] focus:shadow-[2px_2px_0px_0px_#000] transition-all"
              placeholder="Cercar recursos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterCategory(null)}
              className={`font-mono text-xs px-3 py-1.5 border-2 border-black transition-colors ${!filterCategory ? 'bg-orange-400 shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-orange-100'}`}
            >
              Tots
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)}
                className={`font-mono text-xs px-3 py-1.5 border-2 border-black transition-colors ${filterCategory === cat.name ? 'bg-orange-400 shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-orange-100'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de recursos */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className={theme.loadingSpinner} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-mono text-gray-500">
              {search || filterCategory ? 'Cap recurs trobat amb aquests filtres.' : 'Encara no hi ha recursos. Sigues el primer a afegir-ne!'}
            </p>
          </div>
        ) : (
          <>
            <p className="font-mono text-xs text-gray-400 mb-4">{filtered.length} recurs{filtered.length !== 1 ? 'os' : ''}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(b => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  canEdit={isEditor && b.user_id === user?.id}
                  canHighlight={isAdmin}
                  onDelete={handleDelete}
                  onToggleHighlight={handleToggleHighlight}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <ScrollToTop />
    </div>
  )
}
