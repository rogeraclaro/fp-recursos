import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button, Input, Label } from '../components/UI'

export const LoginPage: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
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
    <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-orange-400 border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="font-black font-mono text-xl uppercase tracking-wider">FP Recursos</h1>
          <p className="font-mono text-sm">Accés editors</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white border-2 border-t-0 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
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
