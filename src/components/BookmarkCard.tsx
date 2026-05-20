import React from 'react'
import { Edit2, Trash2, Link2 } from 'lucide-react'
import { Badge } from './UI'
import type { Bookmark } from '../types/database'

interface Props {
  bookmark: Bookmark
  canEdit: boolean
  canHighlight: boolean
  isOrphan?: boolean
  isUnreviewed?: boolean
  onEdit?: (b: Bookmark) => void
  onDelete?: (id: string) => void
  onToggleHighlight?: (id: string, highlighted: boolean) => void
}

export const BookmarkCard: React.FC<Props> = ({
  bookmark, canEdit, canHighlight, isOrphan, isUnreviewed, onEdit, onDelete, onToggleHighlight
}) => {
  const dateStr = new Date(bookmark.created_at).toISOString().split('T')[0]

  return (
    <div
      onClick={() => window.open(bookmark.url, '_blank', 'noopener,noreferrer')}
      className={`cursor-pointer border-skin p-5 h-full flex flex-col shadow-skin-card hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-skin-lg transition-all duration-200 ${bookmark.highlighted ? 'bg-orange-100' : (isUnreviewed || isOrphan) ? 'bg-blue-100' : 'bg-surface'}`}
    >
      {/* Categories + accions edició */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-wrap gap-1.5">
          {bookmark.categories.map((cat, idx) => (
            <Badge key={idx} color="bg-accent">{cat}</Badge>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0 ml-2">
            <button
              onClick={e => { e.stopPropagation(); onEdit?.(bookmark) }}
              className="p-1.5 hover:bg-accent-hover border border-transparent hover:border-black transition-colors"
              title="Editar"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete?.(bookmark.id) }}
              className="p-1.5 hover:bg-red-500 hover:text-white border border-transparent hover:border-black transition-colors"
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Meta: data + autor */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs font-skin text-gray-500 border-b border-gray-200 pb-2">
        <span>{dateStr}</span>
        {bookmark.profiles?.username && (
          <span className="font-bold text-black">{bookmark.profiles.username}</span>
        )}
      </div>

      {/* Títol */}
      <h3 className="font-bold text-xl leading-tight mb-3">{bookmark.title}</h3>

      {/* Descripció */}
      {bookmark.description ? (
        <p className="text-gray-700 font-skin mb-6 flex-grow leading-relaxed text-sm line-clamp-4">
          {bookmark.description}
        </p>
      ) : (
        <div className="flex-grow" />
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 border-t-2 border-black/10 flex items-center justify-between gap-2">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-xs font-bold uppercase flex items-center gap-2 hover:bg-black hover:text-white w-fit px-2 py-1 transition-colors border border-black"
        >
          <Link2 size={14} /> VEURE RECURS
        </a>
        {canHighlight && (
          <button
            onClick={e => { e.stopPropagation(); onToggleHighlight?.(bookmark.id, !bookmark.highlighted) }}
            className={`text-xs font-bold uppercase px-2 py-1 border border-black transition-colors whitespace-nowrap font-skin ${
              bookmark.highlighted ? 'bg-accent hover:bg-surface' : 'bg-surface hover:bg-accent'
            }`}
          >
            {bookmark.highlighted ? '★ DESTACAT' : '☆ DESTACAR'}
          </button>
        )}
      </div>
    </div>
  )
}
