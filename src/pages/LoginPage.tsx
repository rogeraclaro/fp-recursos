import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button, Input, Label } from '../components/UI'

export const LoginPage: React.FC<{
  onSuccess?: () => void
  onClose?: () => void
  onRequestAccess?: () => void
}> = ({ onSuccess, onClose, onRequestAccess }) => {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError('Credencials incorrectes. Comprova email i contrasenya.')
    } else {
      onSuccess?.()
    }
  }

  return (
    <div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-sm relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000] flex items-center justify-between gap-4">
          <div>
            <h1 className="font-black font-mono text-xl uppercase tracking-wider">FP Recursos</h1>
            <p className="font-mono text-sm">Accés editors</p>
          </div>
          {onRequestAccess && (
            <button
              type="button"
              onClick={onRequestAccess}
              className="font-mono text-xs font-bold underline hover:no-underline whitespace-nowrap transition-colors"
            >
              Encara no ets editor?
            </button>
          )}
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white border-4 border-t-0 border-black p-6 shadow-[8px_8px_0px_0px_#000]"
        >
          <div className="mb-4">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="editor@centre.cat"
              required
              autoFocus
            />
          </div>
          <div className="mb-6">
            <Label>Contrasenya</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <p className="text-red-600 font-mono text-sm mb-4 border border-red-300 bg-red-50 p-2">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrant...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
