import React, { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { BookmarkCard } from '../components/BookmarkCard'
import { BookmarkForm } from '../components/BookmarkForm'
import { Header } from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { getBookmarks, createBookmark, updateBookmark, deleteBookmark } from '../services/bookmarks'
import type { Bookmark, BookmarkInsert, Category } from '../types/database'
import { theme } from '../theme'

interface Props {
  categories: Category[]
  onBack: () => void
  onBookmarksChange: (bks: Bookmark[]) => void
}

export const EditorView: React.FC<Props> = ({ categories, onBack, onBookmarksChange }) => {
  const { user, profile } = useAuth()
  const [myBookmarks, setMyBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)

  useEffect(() => {
    getBookmarks()
      .then(all => {
        const mine = all.filter(b => b.user_id === user!.id)
        setMyBookmarks(mine)
        onBookmarksChange(all)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(data: BookmarkInsert) {
    if (editing) {
      const { user_id: _, ...updates } = data
      const updated = await updateBookmark(editing.id, updates)
      setMyBookmarks(prev => prev.map(b => b.id === editing.id ? updated : b))
    } else {
      const created = await createBookmark(data)
      setMyBookmarks(prev => [created, ...prev])
    }
    setShowForm(false)
    setEditing(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar aquest recurs?')) return
    await deleteBookmark(id)
    setMyBookmarks(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className={theme.page}>
      <Header view="editor" onChangeView={() => onBack()} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-black font-mono text-2xl uppercase">Els meus recursos</h2>
            <p className="font-mono text-sm text-gray-500">{profile?.username} · {myBookmarks.length} recursos</p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 font-mono font-bold text-sm px-4 py-2 bg-orange-400 border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[6px_6px_0px_0px_#000] transition-all"
          >
            <Plus size={16} /> Nou recurs
          </button>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <BookmarkForm
              bookmark={editing}
              categories={categories}
              userId={user!.id}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className={theme.loadingSpinner} /></div>
        ) : myBookmarks.length === 0 ? (
          <div className="text-center py-20 font-mono text-gray-500">
            <p className="mb-4">Encara no has afegit cap recurs.</p>
            <button
              onClick={() => setShowForm(true)}
              className="font-mono text-sm px-4 py-2 bg-orange-400 border-2 border-black"
            >
              Afegir primer recurs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myBookmarks.map(b => (
              <BookmarkCard
                key={b.id}
                bookmark={b}
                canEdit
                canHighlight={false}
                onEdit={bk => { setEditing(bk); setShowForm(true) }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
