import React, { useState, useEffect } from 'react'
import { Plus, UserX, UserCheck, Edit2, Check, X, KeyRound } from 'lucide-react'
import { Header } from '../components/Header'
import { Button, Input, Label } from '../components/UI'
import { getProfiles, setUserActive, createEditor, updateProfile, changeUserPassword } from '../services/profiles'
import type { Category, Profile } from '../types/database'

interface Props {
  categories: Category[]
  onCategoriesChange: (cats: Category[]) => void
  onBack: () => void
}

export const AdminView: React.FC<Props> = ({ onBack }) => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [newEditor, setNewEditor] = useState({ email: '', password: '', username: '' })
  const [creatingEditor, setCreatingEditor] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [editorSuccess, setEditorSuccess] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<{ id: string; username: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState<{ id: string; password: string; confirm: string; error: string | null; saving: boolean } | null>(null)

  useEffect(() => {
    getProfiles().then(setProfiles)
  }, [])

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

  async function handleUpdateUsername(id: string, username: string) {
    try {
      const updated = await updateProfile(id, username)
      setProfiles(prev => prev.map(p => p.id === id ? updated : p))
      setEditingProfile(null)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  async function handleChangePassword(id: string) {
    if (!changingPassword) return
    if (changingPassword.password.length < 6) {
      setChangingPassword(prev => prev && ({ ...prev, error: 'Mínim 6 caràcters.' }))
      return
    }
    if (changingPassword.password !== changingPassword.confirm) {
      setChangingPassword(prev => prev && ({ ...prev, error: 'Les contrasenyes no coincideixen.' }))
      return
    }
    setChangingPassword(prev => prev && ({ ...prev, saving: true, error: null }))
    try {
      await changeUserPassword(id, changingPassword.password)
      setChangingPassword(null)
    } catch (err: any) {
      setChangingPassword(prev => prev && ({ ...prev, saving: false, error: err.message }))
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <Header view="admin" onChangeView={() => onBack()} />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h2 className="font-black font-skin text-2xl uppercase">Editors</h2>

        {/* Formulari nou editor */}
        <div className="bg-surface border-skin p-6 shadow-skin-card">
          <h3 className="font-black font-skin uppercase text-sm mb-4 pb-2 border-b-2 border-black">Nou editor</h3>
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
              <p className="font-skin text-xs text-red-600 border border-red-200 bg-red-50 p-2">{editorError}</p>
            )}
            {editorSuccess && (
              <p className="font-skin text-xs text-green-700 border border-green-200 bg-green-50 p-2">{editorSuccess}</p>
            )}
            <Button type="submit" disabled={creatingEditor} icon={<Plus size={14} />}>
              {creatingEditor ? 'Creant...' : 'Crear editor'}
            </Button>
          </form>
        </div>

        {/* Llista editors */}
        <div className="bg-surface border-skin p-6 shadow-skin-card">
          <h3 className="font-black font-skin uppercase text-sm mb-4 pb-2 border-b-2 border-black">
            Editors ({profiles.length})
          </h3>
          <ul className="space-y-2">
            {profiles.map(p => (
              <li key={p.id} className="border-skin p-3">
                {/* Fila principal */}
                {editingProfile?.id === p.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editingProfile.username}
                      onChange={e => setEditingProfile({ ...editingProfile, username: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleUpdateUsername(p.id, editingProfile.username)
                        if (e.key === 'Escape') setEditingProfile(null)
                      }}
                      className="flex-grow border-skin p-1 font-skin text-sm focus:outline-none focus:bg-orange-50"
                    />
                    <button onClick={() => handleUpdateUsername(p.id, editingProfile.username)} className="p-1.5 hover:bg-green-100 border border-transparent hover:border-black transition-colors" title="Guardar"><Check size={14} /></button>
                    <button onClick={() => setEditingProfile(null)} className="p-1.5 hover:bg-gray-100 border border-transparent hover:border-black transition-colors" title="Cancel·lar"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-grow">
                      <span className="font-skin font-bold">{p.username}</span>
                      <span className={`ml-2 font-skin text-xs px-2 py-0.5 border ${p.role === 'admin' ? 'bg-accent border-orange-600' : 'bg-cyan-100 border-cyan-400'}`}>
                        {p.role}
                      </span>
                      {!p.active && <span className="ml-2 font-skin text-xs text-red-500">inactiu</span>}
                    </div>
                    {p.role !== 'admin' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingProfile({ id: p.id, username: p.username })}
                          className="p-1.5 hover:bg-orange-100 border border-transparent hover:border-black transition-colors"
                          title="Editar nom"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setChangingPassword({ id: p.id, password: '', confirm: '', error: null, saving: false })}
                          className="p-1.5 hover:bg-blue-100 border border-transparent hover:border-black transition-colors"
                          title="Canviar contrasenya"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(p.id, !p.active)}
                          className={`p-1.5 border border-transparent hover:border-black transition-colors ${p.active ? 'hover:bg-red-100' : 'hover:bg-green-100'}`}
                          title={p.active ? 'Desactivar' : 'Activar'}
                        >
                          {p.active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Form canvi de contrasenya (inline, només per l'usuari seleccionat) */}
                {changingPassword?.id === p.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Nova contrasenya</Label>
                        <Input
                          type="password"
                          autoFocus
                          placeholder="mínim 6 caràcters"
                          value={changingPassword.password}
                          onChange={e => setChangingPassword(prev => prev && ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Confirma</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={changingPassword.confirm}
                          onChange={e => setChangingPassword(prev => prev && ({ ...prev, confirm: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleChangePassword(p.id)
                            if (e.key === 'Escape') setChangingPassword(null)
                          }}
                        />
                      </div>
                    </div>
                    {changingPassword.error && (
                      <p className="font-skin text-xs text-red-600 border border-red-200 bg-red-50 p-2">{changingPassword.error}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleChangePassword(p.id)}
                        disabled={changingPassword.saving}
                        className="font-skin text-xs font-bold px-3 py-1.5 border-skin bg-black text-white hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-1"
                      >
                        <Check size={13} /> {changingPassword.saving ? 'Desant...' : 'Desar'}
                      </button>
                      <button
                        onClick={() => setChangingPassword(null)}
                        className="font-skin text-xs font-bold px-3 py-1.5 border-skin bg-surface hover:bg-gray-100 transition-colors"
                      >
                        Cancel·lar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
