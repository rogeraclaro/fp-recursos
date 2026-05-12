import React from 'react'
import type { Category } from '../types/database'

interface Props {
  categories: Category[]
  onCategoriesChange: (cats: Category[]) => void
  onBack: () => void
}

export const AdminView: React.FC<Props> = ({ onBack }) => (
  <div className="min-h-screen flex items-center justify-center font-mono">
    <div className="text-center">
      <p className="mb-4">Panell admin — en construcció</p>
      <button onClick={onBack} className="border-2 border-black px-4 py-2 hover:bg-orange-400">Tornar</button>
    </div>
  </div>
)
