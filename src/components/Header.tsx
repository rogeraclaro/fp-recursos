import React from 'react'
import { LogOut, Settings, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type View = 'public' | 'editor' | 'admin'

interface Props {
  view: View
  onChangeView: (v: View) => void
}

export const Header: React.FC<Props> = ({ view, onChangeView }) => {
  const { user, profile, signOut, isAdmin, isEditor } = useAuth()

  return (
    <header className="bg-white border-b-4 border-black p-4 shadow-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => onChangeView('public')}
          className="flex items-baseline gap-2 hover:opacity-80 transition-opacity"
        >
          <h1 className="font-black font-mono text-xl uppercase tracking-wider">
            <span className="bg-orange-400 px-2 border-2 border-black">FP</span>
            <span className="ml-2">Recursos</span>
          </h1>
        </button>

        {/* Nav + accions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isEditor && view !== 'editor' && (
            <button
              onClick={() => onChangeView('editor')}
              className="flex items-center gap-1 font-mono text-sm px-3 py-1.5 border-2 border-black hover:bg-orange-400 transition-colors shadow-[2px_2px_0px_0px_#000]"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Els meus recursos</span>
              <span className="sm:hidden">Recursos</span>
            </button>
          )}
          {isAdmin && view !== 'admin' && (
            <button
              onClick={() => onChangeView('admin')}
              className="flex items-center gap-1 font-mono text-sm px-3 py-1.5 border-2 border-black hover:bg-orange-400 transition-colors shadow-[2px_2px_0px_0px_#000]"
            >
              <Settings size={14} />
              Admin
            </button>
          )}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-500 hidden sm:block">{profile?.username}</span>
              <button
                onClick={signOut}
                className="p-1.5 border-2 border-black hover:bg-red-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
                title="Tancar sessió"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onChangeView('editor')}
              className="font-mono text-sm px-3 py-1.5 border-2 border-black hover:bg-orange-400 transition-colors shadow-[2px_2px_0px_0px_#000]"
            >
              Accés editors
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
