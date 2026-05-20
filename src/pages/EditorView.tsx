import React, { useState, useEffect } from 'react'
import { X, Edit2, Check, Trash2 } from 'lucide-react'
import { BookmarkCard } from '../components/BookmarkCard'
import { BookmarkForm } from '../components/BookmarkForm'
import { Header } from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { getBookmarks, createBookmark, updateBookmark, deleteBookmark } from '../services/bookmarks'
import { createCategory, updateCategory, deleteCategory } from '../services/categories'
import type { Bookmark, BookmarkInsert, Category } from '../types/database'
import { theme } from '../theme'

interface Props {
  categories: Category[]
  onBack: () => void
  onBookmarksChange: (bks: Bookmark[]) => void
  onCategoriesChange: (cats: Category[]) => void
}

export const EditorView: React.FC<Props> = ({ categories, onBack, onBookmarksChange, onCategoriesChange }) => {
  const { user, profile } = useAuth()
  const [myBookmarks, setMyBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const [catError, setCatError] = useState('')
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null)

  const myCategories = categories.filter(c => c.created_by === user?.id)

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

  async function handleAddCategory() {
    if (!newCatName.trim() || !user) return
    setCatSaving(true)
    setCatError('')
    try {
      const cat = await createCategory(newCatName.trim(), user.id)
      onCategoriesChange([...categories, cat].sort((a, b) => a.name.localeCompare(b.name)))
      setNewCatName('')
    } catch (err) {
      setCatError((err as { message?: string })?.message ?? 'Error desconegut')
    } finally {
      setCatSaving(false)
    }
  }

  async function handleEditCat(id: string, name: string) {
    try {
      const updated = await updateCategory(id, name)
      onCategoriesChange(categories.map(c => c.id === id ? updated : c).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingCat(null)
    } catch (err) {
      setCatError((err as { message?: string })?.message ?? 'Error en editar')
    }
  }

  async function handleDeleteCat(id: string, name: string) {
    if (!confirm(`Eliminar la categoria "${name}"?`)) return
    try {
      await deleteCategory(id)
      onCategoriesChange(categories.filter(c => c.id !== id))
    } catch (err) {
      setCatError((err as { message?: string })?.message ?? 'Error en eliminar')
    }
  }

  function closeModal() {
    setShowCategoryModal(false)
    setNewCatName('')
    setCatError('')
    setEditingCat(null)
  }

  return (
    <div className={theme.page}>
      <Header
        view="editor"
        onChangeView={() => onBack()}
        onNewResource={() => { setEditing(null); setShowForm(true) }}
        onCategories={() => setShowCategoryModal(true)}
      />

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="font-black font-skin text-2xl uppercase">Els meus recursos</h2>
          <p className="font-skin text-sm text-gray-500">{profile?.username} · {myBookmarks.length} recursos</p>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4">
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
          <div className="text-center py-20 font-skin text-gray-500">
            <p className="mb-4">Encara no has afegit cap recurs.</p>
            <button
              onClick={() => setShowForm(true)}
              className="font-skin text-sm px-4 py-2 bg-accent border-skin"
            >
              Afegir primer recurs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
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

      {/* Modal categories */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-black w-full max-w-md shadow-skin-lg">
            <div className="flex justify-between items-center p-4 border-b-2 border-black bg-accent">
              <h3 className="font-bold text-xl font-skin uppercase">Les meves categories</h3>
              <button onClick={closeModal} className="p-1 hover:bg-black hover:text-white transition-colors border border-black">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  placeholder="Nova categoria..."
                  className="flex-1 font-skin text-sm border-skin px-3 py-2 focus:outline-none focus:bg-orange-50"
                  autoFocus
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCatName.trim() || catSaving}
                  className="font-skin font-bold text-sm px-4 py-2 border-skin bg-accent hover:bg-accent-hover disabled:opacity-40 transition-colors"
                >
                  {catSaving ? '...' : '+ Afegir'}
                </button>
              </div>

              {catError && (
                <p className="font-skin text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2">{catError}</p>
              )}

              {myCategories.length > 0 ? (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {myCategories.map(cat => (
                    <li key={cat.id} className="flex items-center gap-2 p-3 border-skin">
                      {editingCat?.id === cat.id ? (
                        <>
                          <input
                            autoFocus
                            value={editingCat.name}
                            onChange={e => setEditingCat({ ...editingCat, name: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleEditCat(cat.id, editingCat.name)
                              if (e.key === 'Escape') setEditingCat(null)
                            }}
                            className="flex-1 border-skin p-1 font-skin text-sm focus:outline-none focus:bg-orange-50"
                          />
                          <button onClick={() => handleEditCat(cat.id, editingCat.name)} className="p-1.5 hover:bg-green-100 border border-transparent hover:border-black transition-colors" title="Guardar"><Check size={14} /></button>
                          <button onClick={() => setEditingCat(null)} className="p-1.5 hover:bg-gray-100 border border-transparent hover:border-black transition-colors" title="Cancel·lar"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <span className="font-skin flex-1">{cat.name}</span>
                          <button onClick={() => setEditingCat({ id: cat.id, name: cat.name })} className="p-1.5 hover:bg-orange-100 border border-transparent hover:border-black transition-colors" title="Editar"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteCat(cat.id, cat.name)} className="p-1.5 hover:bg-red-100 border border-transparent hover:border-black transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-skin text-sm text-gray-400 text-center py-4">Encara no has creat cap categoria.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
