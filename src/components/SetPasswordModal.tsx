import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Input, Label } from './UI'

export const SetPasswordModal: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('La contrasenya ha de tenir mínim 6 caràcters.')
      return
    }
    if (password !== confirm) {
      setError('Les contrasenyes no coincideixen.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError('Error en desar la contrasenya. Torna-ho a provar.')
    } else {
      window.location.hash = ''
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000]">
          <h1 className="font-black font-mono text-xl uppercase tracking-wider">Benvingut/da!</h1>
          <p className="font-mono text-sm mt-1">Crea la teva contrasenya per continuar.</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white border-4 border-t-0 border-black p-6 shadow-[8px_8px_0px_0px_#000]"
        >
          <div className="mb-4">
            <Label>Nova contrasenya</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="mínim 6 caràcters"
              required
              autoFocus
            />
          </div>
          <div className="mb-6">
            <Label>Confirma la contrasenya</Label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
            {loading ? 'Desant...' : 'Crear contrasenya'}
          </Button>
        </form>
      </div>
    </div>
  )
}
