import React from 'react'
import { Edit2, Trash2, Star } from 'lucide-react'
import { Badge } from './UI'
import type { Bookmark } from '../types/database'

interface Props {
  bookmark: Bookmark
  canEdit: boolean
  canHighlight: boolean
  onEdit?: (b: Bookmark) => void
  onDelete?: (id: string) => void
  onToggleHighlight?: (id: string, highlighted: boolean) => void
}

export const BookmarkCard: React.FC<Props> = ({
  bookmark, canEdit, canHighlight, onEdit, onDelete, onToggleHighlight
}) => {
  const dateStr = new Date(bookmark.created_at).toLocaleDateString('ca-ES', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  return (
    <div className={`border-2 border-black p-5 h-full flex flex-col shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 ${bookmark.highlighted ? 'bg-orange-400/30' : 'bg-white'}`}>

      {/* Categories + accions */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-wrap gap-1.5">
          {bookmark.categories.map((cat, idx) => (
            <Badge key={idx} color="bg-cyan-300">{cat}</Badge>
          ))}
        </div>
        {(canEdit || canHighlight) && (
          <div className="flex gap-1 flex-shrink-0 ml-2">
            {canHighlight && (
              <button
                onClick={() => onToggleHighlight?.(bookmark.id, !bookmark.highlighted)}
                className={`p-1.5 border border-transparent transition-colors ${bookmark.highlighted ? 'bg-orange-400 border-black' : 'hover:bg-orange-100 hover:border-black'}`}
                title={bookmark.highlighted ? 'Treure destacat' : 'Destacar'}
              >
                <Star size={14} fill={bookmark.highlighted ? 'currentColor' : 'none'} />
              </button>
            )}
            {canEdit && (
              <>
                <button
                  onClick={() => onEdit?.(bookmark)}
                  className="p-1.5 hover:bg-orange-300 border border-transparent hover:border-black transition-colors"
                  title="Editar"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => onDelete?.(bookmark.id)}
                  className="p-1.5 hover:bg-red-500 hover:text-white border border-transparent hover:border-black transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Títol + URL */}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold font-mono text-base hover:underline mb-1 line-clamp-2 flex-shrink-0"
      >
        {bookmark.title}
      </a>

      {/* Descripció */}
      {bookmark.description && (
        <p className="text-sm text-gray-600 font-mono line-clamp-3 mb-3 flex-grow">
          {bookmark.description}
        </p>
      )}
      {!bookmark.description && <div className="flex-grow" />}

      {/* Footer: autor + data */}
      <div className="mt-auto pt-2 border-t border-gray-200 flex justify-between items-center text-xs font-mono text-gray-500">
        <span>{bookmark.profiles?.username ?? 'Editor'}</span>
        <span>{dateStr}</span>
      </div>
    </div>
  )
}
