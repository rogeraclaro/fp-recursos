import React, { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button, Input, Label, TextArea } from './UI'
import type { Bookmark, BookmarkInsert, Category } from '../types/database'
import { suggestResource } from '../services/ai'

interface Props {
  bookmark?: Bookmark | null
  categories: Category[]
  userId: string
  onSave: (data: BookmarkInsert) => Promise<void>
  onCancel: () => void
}

export const BookmarkForm: React.FC<Props> = ({ bookmark, categories, userId, onSave, onCancel }) => {
  const [title, setTitle] = useState(bookmark?.title ?? '')
  const [description, setDescription] = useState(bookmark?.description ?? '')
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [selectedCats, setSelectedCats] = useState<string[]>(bookmark?.categories ?? [])
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCat(name: string) {
    setSelectedCats(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    )
  }

  async function handleSuggest() {
    if (!url.trim()) return
    setSuggesting(true)
    setError(null)
    const result = await suggestResource(url.trim(), categories.map(c => c.name))
    if (result) {
      setTitle(result.title)
      setDescription(result.description)
      if (result.category && !selectedCats.includes(result.category)) {
        setSelectedCats([result.category])
      }
    } else {
      setError('No s\'ha pogut obtenir suggeriment. Comprova que la Edge Function està desplegada.')
    }
    setSuggesting(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !url.trim()) { setError('Títol i URL són obligatoris.'); return }
    if (selectedCats.length === 0) { setError('Selecciona almenys una categoria.'); return }
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        url: url.trim(),
        categories: selectedCats,
        user_id: userId,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-lg w-full">
      <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-black">
        <h2 className="font-black font-mono uppercase">{bookmark ? 'Editar recurs' : 'Nou recurs'}</h2>
        <button onClick={onCancel} className="p-1 hover:bg-red-100 border border-transparent hover:border-black">
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>URL *</Label>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." type="url" required />
          <button
            type="button"
            onClick={handleSuggest}
            disabled={!url.trim() || suggesting}
            className="mt-2 flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 bg-orange-400 border-2 border-black hover:bg-orange-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={12} />
            {suggesting ? 'Analitzant...' : 'Suggerir amb IA'}
          </button>
        </div>
        <div>
          <Label>Títol *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Títol del recurs" required />
        </div>
        <div>
          <Label>Descripció</Label>
          <TextArea value={description} onChange={e => setDescription(e.target.value)} placeholder="Breu descripció opcional..." rows={3} />
        </div>
        <div>
          <Label>Categories *</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCat(cat.name)}
                className={`font-mono text-xs px-3 py-1.5 border-2 border-black transition-colors ${selectedCats.includes(cat.name) ? 'bg-orange-400' : 'bg-white hover:bg-orange-100'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-red-600 font-mono text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>{saving ? 'Guardant...' : 'Guardar'}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel·lar</Button>
        </div>
      </form>
    </div>
  )
}
