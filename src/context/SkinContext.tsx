import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { SKINS } from '../skins'

const DEFAULT_SKIN = 'brutal'
const STORAGE_KEY = 'fp-skin'

interface SkinContextValue {
  currentSkin: string
  setSkin: (id: string) => void
  previewSkin: (id: string | null) => void
}

const SkinContext = createContext<SkinContextValue>({
  currentSkin: DEFAULT_SKIN,
  setSkin: () => {},
  previewSkin: () => {},
})

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [currentSkin, setCurrentSkin] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return SKINS.some(s => s.id === saved) ? saved! : DEFAULT_SKIN
  })

  useEffect(() => {
    document.documentElement.dataset.skin = currentSkin
  }, [currentSkin])

  const setSkin = useCallback((id: string) => {
    setCurrentSkin(id)
    localStorage.setItem(STORAGE_KEY, id)
    document.documentElement.dataset.skin = id
  }, [])

  const previewSkin = useCallback((id: string | null) => {
    document.documentElement.dataset.skin = id ?? currentSkin
  }, [currentSkin])

  return (
    <SkinContext.Provider value={{ currentSkin, setSkin, previewSkin }}>
      {children}
    </SkinContext.Provider>
  )
}

export function useSkin() {
  return useContext(SkinContext)
}
