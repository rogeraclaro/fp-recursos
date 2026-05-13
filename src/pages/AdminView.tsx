import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Check, X, UserX, UserCheck } from 'lucide-react'
import { Header } from '../components/Header'
import { Button, Input, Label } from '../components/UI'
import { createCategory, updateCategory, deleteCategory } from '../services/categories'
import { getProfiles, setUserActive, createEditor } from '../services/profiles'
import { useAuth } from '../context/AuthContext'
import type { Category, Profile } from '../types/database'
import { theme } from '../theme'

interface Props {
  categories: Category[]
  onCategoriesChange: (cats: Category[]) => void
  onBack: () => void
}

export const AdminView: React.FC<Props> = ({ categories, onCategoriesChange, onBack }) => {
  const { user } = useAuth()
  const [cats, setCats] = useState<Category[]>(categories)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'categories' | 'editors'>('categories')
  const [newEditor, setNewEditor] = useState({ email: '', password: '', username: '' })
  const [creatingEditor, setCreatingEditor] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [editorSuccess, setEditorSuccess] = useState<string | null>(null)

  useEffect(() => {
    getProfiles().then(setProfiles)
  }, [])

  async function handleAddCat(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) return
    const cat = await createCategory(newCatName.trim(), user!.id)
    const updated = [...cats, cat]
    setCats(updated)
    onCategoriesChange(updated)
    setNewCatName('')
  }

  async function handleUpdateCat(id: string, name: string) {
    const updated = await updateCategory(id, name)
    const newCats = cats.map(c => c.id === id ? updated : c)
    setCats(newCats)
    onCategoriesChange(newCats)
    setEditingCat(null)
  }

  async function handleDeleteCat(id: string) {
    if (!confirm('Eliminar categoria? Els recursos que la tinguin perdran aquesta categoria.')) return
    await deleteCategory(id)
    const newCats = cats.filter(c => c.id !== id)
    setCats(newCats)
    onCategoriesChange(newCats)
  }

  async function handleCreateEditor(e: React.FormEvent) {
    e.preventDefault()
    setEditorError(null)
    setEditorSuccess(null)
    setCreatingEditor(true)
    try {
      await createEditor(newEditor.email, newEditor.password, newEditor.username)
      const updated = await getProfiles()
      setProfiles(updated)
      setNewEditor({ email: '', password: '', username: '' })
      setEditorSuccess(`Editor "${newEditor.username}" creat correctament.`)
    } catch (err: any) {
      setEditorError(err.message)
    } finally {
      setCreatingEditor(false)
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    await setUserActive(id, active)
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, active } : p))
  }

  return (
    <div className={theme.page}>
      <Header view="admin" onChangeView={() => onBack()} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="font-black font-mono text-2xl uppercase mb-6">Administració</h2>

        <div className="flex gap-0 mb-6 border-2 border-black w-fit">
          {(['categories', 'editors'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-mono font-bold text-sm px-6 py-2 transition-colors capitalize ${activeTab === tab ? 'bg-orange-400' : 'bg-white hover:bg-orange-100'}`}
            >
              {tab === 'categories' ? 'Categories' : 'Editors'}
            </button>
          ))}
        </div>

        {activeTab === 'categories' && (
          <div className="bg-white border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <form onSubmit={handleAddCat} className="flex gap-3 mb-6">
              <Input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="Nova categoria..."
                className="flex-grow"
              />
              <Button type="submit" icon={<Plus size={14} />}>Afegir</Button>
            </form>

            <ul className="space-y-2">
              {cats.map(cat => (
                <li key={cat.id} className="flex items-center gap-3 p-3 border-2 border-black">
                  {editingCat?.id === cat.id ? (
                    <>
                      <Input
                        value={editingCat.name}
                        onChange={e => setEditingCat({ ...editingCat, name: e.target.value })}
                        className="flex-grow py-1"
                      />
                      <button onClick={() => handleUpdateCat(cat.id, editingCat.name)} className="p-1 hover:bg-green-100"><Check size={14} /></button>
                      <button onClick={() => setEditingCat(null)} className="p-1 hover:bg-red-100"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span className="font-mono flex-grow">{cat.name}</span>
                      <button onClick={() => setEditingCat({ id: cat.id, name: cat.name })} className="p-1 hover:bg-orange-100 border border-transparent hover:border-black"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteCat(cat.id)} className="p-1 hover:bg-red-100 border border-transparent hover:border-black"><Trash2 size={14} /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'editors' && (
          <div className="space-y-6">
            {/* Formulari nou editor */}
            <div className="bg-white border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black font-mono uppercase text-sm mb-4 pb-2 border-b-2 border-black">Nou editor</h3>
              <form onSubmit={handleCreateEditor} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Nom d'usuari</Label>
                    <Input
                      value={newEditor.username}
                      onChange={e => setNewEditor(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="nom.cognom"
                      required
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newEditor.email}
                      onChange={e => setNewEditor(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="editor@centre.cat"
                      required
                    />
                  </div>
                  <div>
                    <Label>Contrasenya</Label>
                    <Input
                      type="password"
                      value={newEditor.password}
                      onChange={e => setNewEditor(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="mínim 6 caràcters"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                {editorError && (
                  <p className="font-mono text-xs text-red-600 border border-red-200 bg-red-50 p-2">{editorError}</p>
                )}
                {editorSuccess && (
                  <p className="font-mono text-xs text-green-700 border border-green-200 bg-green-50 p-2">{editorSuccess}</p>
                )}
                <Button type="submit" disabled={creatingEditor} icon={<Plus size={14} />}>
                  {creatingEditor ? 'Creant...' : 'Crear editor'}
                </Button>
              </form>
            </div>

            {/* Llista editors */}
            <div className="bg-white border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black font-mono uppercase text-sm mb-4 pb-2 border-b-2 border-black">Editors ({profiles.length})</h3>
              <ul className="space-y-2">
                {profiles.map(p => (
                  <li key={p.id} className="flex items-center gap-3 p-3 border-2 border-black">
                    <div className="flex-grow">
                      <span className="font-mono font-bold">{p.username}</span>
                      <span className={`ml-2 font-mono text-xs px-2 py-0.5 border ${p.role === 'admin' ? 'bg-orange-400 border-orange-600' : 'bg-cyan-100 border-cyan-400'}`}>
                        {p.role}
                      </span>
                      {!p.active && <span className="ml-2 font-mono text-xs text-red-500">inactiu</span>}
                    </div>
                    {p.role !== 'admin' && (
                      <button
                        onClick={() => handleToggleActive(p.id, !p.active)}
                        className={`p-1.5 border border-transparent hover:border-black transition-colors ${p.active ? 'hover:bg-red-100' : 'hover:bg-green-100'}`}
                        title={p.active ? 'Desactivar' : 'Activar'}
                      >
                        {p.active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
