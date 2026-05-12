import React from 'react'
import { useAuth } from '../context/AuthContext'
import { LoginPage } from '../pages/LoginPage'

interface Props {
  children: React.ReactNode
  requireAdmin?: boolean
}

export const ProtectedRoute: React.FC<Props> = ({ children, requireAdmin = false }) => {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (requireAdmin && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono">
        <p className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          Accés restringit a administradors.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
