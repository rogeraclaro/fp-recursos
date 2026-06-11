import React, { useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { X, Bold, Italic, Link2, List, ListOrdered, Quote, Heading2, Heading3, Link2Off } from 'lucide-react'
import { Button, Label, Input } from './UI'
import type { ChangelogPost } from '../types/database'

interface Props {
  post?: ChangelogPost
  authorId: string
  onSave: (data: { title: string; content: string; status: 'draft' | 'published'; author_id: string }) => Promise<void>
  onCancel: () => void
}

const ToolbarBtn: React.FC<{
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}> = ({ onClick, active, title, children }) => (
  <button
    type='button'
    onMouseDown={(e) => { e.preventDefault(); onClick() }}
    title={title}
    className={`p-1.5 border transition-colors ${active ? 'bg-black text-white border-black' : 'bg-surface border-transparent hover:border-black hover:bg-accent'}`}
  >
    {children}
  </button>
)

export const ChangelogEditor: React.FC<Props> = ({ post, authorId, onSave, onCancel }) => {
  const [title, setTitle] = useState(post?.title ?? '')
  const [status, setStatus] = useState<'draft' | 'published'>(post?.status ?? 'draft')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'underline text-blue-600 hover:text-blue-800' } }),
      Placeholder.configure({ placeholder: 'Escriu el contingut del post...' }),
    ],
    content: post?.content ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] p-4 focus:outline-none font-skin text-sm leading-relaxed',
      },
    },
  })

  const handleSetLink = useCallback(() => {
    if (!editor) return
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run()
      setShowLinkInput(false)
      return
    }
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
    editor.chain().focus().setLink({ href: url }).run()
    setLinkUrl('')
    setShowLinkInput(false)
  }, [editor, linkUrl])

  async function handleSave() {
    if (!title.trim()) { setError('El títol és obligatori.'); return }
    if (!editor) return
    setSaving(true)
    setError('')
    try {
      await onSave({ title: title.trim(), content: editor.getHTML(), status, author_id: authorId })
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error en guardar')
      setSaving(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
      <div className='w-full max-w-2xl relative max-h-[90vh] flex flex-col'>
        <button
          onClick={onCancel}
          className='absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]'
        >
          <X size={18} />
        </button>

        {/* Capçalera */}
        <div className='bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000] flex-shrink-0'>
          <h2 className='font-black font-mono text-xl uppercase tracking-wider'>
            {post ? 'Editar post' : 'Nou post'}
          </h2>
        </div>

        {/* Contingut */}
        <div className='bg-white border-4 border-t-0 border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4 overflow-y-auto flex-1'>
          {/* Títol */}
          <div>
            <Label>Títol</Label>
            <Input
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Títol del post...'
              autoFocus
            />
          </div>

          {/* Editor */}
          <div>
            <Label>Contingut</Label>
            {/* Barra d'eines */}
            <div className='flex flex-wrap gap-1 p-2 border-skin border-b-0 bg-gray-50'>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title='Negreta'>
                <Bold size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title='Cursiva'>
                <Italic size={14} />
              </ToolbarBtn>
              <div className='w-px bg-gray-300 mx-0.5 self-stretch' />
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title='Títol H2'>
                <Heading2 size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title='Títol H3'>
                <Heading3 size={14} />
              </ToolbarBtn>
              <div className='w-px bg-gray-300 mx-0.5 self-stretch' />
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title='Llista de punts'>
                <List size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title='Llista numerada'>
                <ListOrdered size={14} />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title='Cita'>
                <Quote size={14} />
              </ToolbarBtn>
              <div className='w-px bg-gray-300 mx-0.5 self-stretch' />
              <ToolbarBtn
                onClick={() => {
                  if (editor?.isActive('link')) {
                    editor.chain().focus().unsetLink().run()
                  } else {
                    setLinkUrl(editor?.getAttributes('link').href ?? '')
                    setShowLinkInput((v) => !v)
                  }
                }}
                active={editor?.isActive('link')}
                title={editor?.isActive('link') ? 'Treure link' : 'Afegir link'}
              >
                {editor?.isActive('link') ? <Link2Off size={14} /> : <Link2 size={14} />}
              </ToolbarBtn>
            </div>

            {/* Input URL del link */}
            {showLinkInput && (
              <div className='flex gap-2 p-2 bg-blue-50 border-skin border-t-0 border-b-0'>
                <input
                  type='text'
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSetLink() }}
                  placeholder='https://...'
                  className='flex-grow border-skin p-1.5 font-skin text-sm focus:outline-none focus:bg-orange-50'
                  autoFocus
                />
                <button
                  type='button'
                  onClick={handleSetLink}
                  className='font-skin font-bold text-xs px-3 py-1.5 border-skin bg-accent hover:bg-accent-hover transition-colors'
                >
                  Aplicar
                </button>
              </div>
            )}

            {/* Àrea d'edició */}
            <div className='border-skin min-h-[200px] bg-surface'>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Estat */}
          <div>
            <Label>Estat</Label>
            <div className='flex gap-3'>
              {(['draft', 'published'] as const).map((s) => (
                <button
                  key={s}
                  type='button'
                  onClick={() => setStatus(s)}
                  className={`font-skin font-bold text-sm px-4 py-2 border-skin transition-colors ${status === s ? 'bg-black text-white' : 'bg-surface hover:bg-gray-50'}`}
                >
                  {s === 'draft' ? 'Esborrany' : 'Publicat'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className='font-skin text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2'>{error}</p>
          )}

          <div className='flex justify-end gap-3 pt-2'>
            <Button variant='secondary' onClick={onCancel}>Cancel·lar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardant...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
