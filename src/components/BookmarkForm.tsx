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
  const [aiModel, setAiModel] = useState<string | null>(null)
  const [suggested, setSuggested] = useState(false)
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
    try {
      const result = await suggestResource(url.trim(), categories.map(c => c.name))
      setTitle(result.title)
      setDescription(result.description)
      if (result.category) setSelectedCats([result.category])
      if (result.model) setAiModel(result.model)
      setSuggested(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut a la IA.')
    } finally {
      setSuggesting(false)
    }
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
    <div className="w-full max-w-lg relative flex flex-col max-h-[calc(100svh-2rem)]">
      <button onClick={onCancel} className="absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]">
        <X size={18} />
      </button>
      <div className="bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000] flex-shrink-0">
        <h2 className="font-black font-mono text-xl uppercase tracking-wider">{bookmark ? 'Editar recurs' : 'Nou recurs'}</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-white border-4 border-t-0 border-black shadow-[8px_8px_0px_0px_#000]">
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <Label>URL *</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." type="url" required />
            <button
              type="button"
              onClick={handleSuggest}
              disabled={!url.trim() || suggesting || suggested}
              className="mt-2 flex items-center gap-1.5 font-skin text-xs px-3 py-1.5 bg-accent border-skin hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles size={12} />
              {suggesting ? 'Analitzant...' : `Suggerir amb IA (${aiModel ?? 'llama-3.1-8b-instant'})`}
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
                  className={`font-skin text-xs px-3 py-1.5 border-skin transition-colors ${selectedCats.includes(cat.name) ? 'bg-accent' : 'bg-surface hover:bg-orange-100'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-600 font-skin text-sm">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t-2 border-black flex gap-3 flex-shrink-0">
          <Button type="submit" disabled={saving}>{saving ? 'Guardant...' : 'Guardar'}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel·lar</Button>
        </div>
      </form>
    </div>
  )
}
