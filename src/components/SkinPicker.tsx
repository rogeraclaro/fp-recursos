import React, { useState, useEffect, useRef } from 'react'
import { Palette } from 'lucide-react'
import { SKINS } from '../skins'
import { useSkin } from '../context/SkinContext'

export const SkinPicker: React.FC = () => {
  const { currentSkin, setSkin, previewSkin } = useSkin()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        previewSkin(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, previewSkin])

  function handleSelect(id: string) {
    setSkin(id)
    setOpen(false)
  }

  return (
    <div ref={ref} className='fixed bottom-20 right-6 z-50'>
      {open && (
        <div
          className='absolute bottom-full right-0 mb-2 bg-surface border-skin shadow-skin-lg min-w-[160px]'
          onMouseLeave={() => previewSkin(null)}
        >
          {SKINS.map(skin => (
            <button
              key={skin.id}
              onClick={() => handleSelect(skin.id)}
              onMouseEnter={() => previewSkin(skin.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 font-skin text-sm font-bold text-left transition-colors hover:bg-accent ${currentSkin === skin.id ? 'bg-accent' : ''}`}
            >
              <span
                className='w-4 h-4 border border-black flex-shrink-0'
                style={{ backgroundColor: skin.accentColor }}
              />
              {skin.name}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        title='Canviar skin'
        className='p-3 bg-surface border-skin shadow-skin-sm hover:bg-accent transition-colors'
      >
        <Palette size={18} />
      </button>
    </div>
  )
}
