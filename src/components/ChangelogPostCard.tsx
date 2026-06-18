import React from 'react'
import DOMPurify from 'dompurify'
import { Edit2, Trash2 } from 'lucide-react'
import type { ChangelogPost } from '../types/database'

interface Props {
  post: ChangelogPost
  canEdit: boolean
  onEdit?: (post: ChangelogPost) => void
  onDelete?: (id: string) => void
  onBookmarkClick?: (bookmarkId: string) => void
}

export const ChangelogPostCard: React.FC<Props> = ({ post, canEdit, onEdit, onDelete, onBookmarkClick }) => {
  const dateStr = new Date(post.created_at).toLocaleDateString('ca-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const safeHtml = DOMPurify.sanitize(post.content, {
    ADD_ATTR: ['data-bookmark-id', 'target'],
  })

  return (
    <article className='relative border-skin bg-surface shadow-skin-card p-6 w-full'>
      {/* Badge estat (només admin veu esborranys) */}
      {post.status === 'draft' && (
        <span className='absolute top-4 right-4 bg-yellow-300 border border-black text-black text-xs font-bold uppercase px-2 py-0.5 font-skin'>
          Esborrany
        </span>
      )}

      {/* Capçalera */}
      <div className='flex items-start justify-between gap-4 mb-4 border-b-2 border-black pb-4'>
        <div>
          <p className='font-skin text-xs text-gray-500 uppercase tracking-wider mb-1'>{dateStr}</p>
          <h2 className='text-2xl font-black uppercase leading-tight'>{post.title}</h2>
        </div>
        {canEdit && (
          <div className='flex gap-1 flex-shrink-0'>
            <button
              onClick={() => onEdit?.(post)}
              className='p-1.5 hover:bg-accent-hover border border-transparent hover:border-black transition-colors'
              title='Editar'
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => onDelete?.(post.id)}
              className='p-1.5 hover:bg-red-500 hover:text-white border border-transparent hover:border-black transition-colors'
              title='Eliminar'
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Contingut HTML del TipTap */}
      <div
        className='changelog-content font-skin text-sm leading-relaxed'
        dangerouslySetInnerHTML={{ __html: safeHtml }}
        onClick={(e) => {
          const anchor = (e.target as HTMLElement).closest('[data-bookmark-id]') as HTMLElement | null
          if (anchor) {
            e.preventDefault()
            onBookmarkClick?.(anchor.dataset.bookmarkId!)
          }
        }}
      />
    </article>
  )
}
