import React, { useState, useEffect } from 'react'
import { X, Check, XCircle, Clock } from 'lucide-react'
import { getEditorRequests, approveEditorRequest, rejectEditorRequest } from '../services/editorRequests'
import type { EditorRequest } from '../types/database'

interface Props {
  onClose: () => void
  onPendingChange: (count: number) => void
}

const STATUS_LABELS: Record<EditorRequest['status'], string> = {
  pending: 'Pendent',
  approved: 'Aprovada',
  rejected: 'Rebutjada',
}

const STATUS_STYLES: Record<EditorRequest['status'], string> = {
  pending: 'bg-accent text-black border border-black',
  approved: 'bg-green-100 text-green-800 border border-green-400',
  rejected: 'bg-red-100 text-red-800 border border-red-400',
}

export const EditorRequestsAdminModal: React.FC<Props> = ({ onClose, onPendingChange }) => {
  const [requests, setRequests] = useState<EditorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getEditorRequests()
      .then(setRequests)
      .finally(() => setLoading(false))
  }, [])

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  async function handleApprove(r: EditorRequest) {
    if (!confirm(`Aprovar la sol·licitud de "${r.name}" (${r.email})?`)) return
    setProcessingId(r.id)
    setError('')
    try {
      await approveEditorRequest(r.id, r.email, r.name)
      setRequests((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: 'approved' as const } : x)),
      )
      onPendingChange(Math.max(0, pendingCount - 1))
    } catch {
      setError(`Error en aprovar "${r.name}". Comprova que la Edge Function està desplegada.`)
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(r: EditorRequest) {
    if (!confirm(`Rebutjar la sol·licitud de "${r.name}" (${r.email})?`)) return
    setProcessingId(r.id)
    setError('')
    try {
      await rejectEditorRequest(r.id, r.email, r.name)
      setRequests((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: 'rejected' as const } : x)),
      )
      onPendingChange(Math.max(0, pendingCount - 1))
    } catch {
      setError(`Error en rebutjar "${r.name}". Comprova que la Edge Function està desplegada.`)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
      <div className='bg-surface border-4 border-black w-full max-w-xl shadow-[8px_8px_0px_0px_#000] flex flex-col max-h-[85vh] relative'>
        <button
          onClick={onClose}
          className='absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]'
        >
          <X size={18} />
        </button>
        <div className='flex items-center p-4 border-b-2 border-black bg-accent flex-shrink-0'>
          <h2 className='font-black font-mono text-xl uppercase tracking-wider flex items-center gap-2'>
            <Clock size={20} /> Sol·licituds d'editor
            {pendingCount > 0 && (
              <span className='bg-black text-accent text-xs font-bold px-2 py-0.5 border border-black rounded-full'>
                {pendingCount} pendent{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
        </div>

        {error && (
          <div className='mx-4 mt-3 font-skin text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2 flex-shrink-0'>
            {error}
          </div>
        )}

        <div className='flex-1 overflow-y-auto'>
          {loading ? (
            <div className='flex items-center justify-center p-12'>
              <div className='w-8 h-8 border-4 border-black border-t-accent rounded-full animate-spin' />
            </div>
          ) : requests.length === 0 ? (
            <p className='font-skin text-sm text-gray-400 text-center p-12'>
              Encara no hi ha cap sol·licitud.
            </p>
          ) : (
            <ul className='divide-y-2 divide-black'>
              {requests.map((r) => (
                <li
                  key={r.id}
                  className={`p-4 flex flex-col gap-2 ${r.status === 'pending' ? 'bg-orange-50' : 'bg-surface'}`}
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <span className='font-skin font-bold text-sm'>{r.name}</span>
                        <span
                          className={`font-skin text-[10px] font-bold px-1.5 py-0.5 ${STATUS_STYLES[r.status]}`}
                        >
                          {STATUS_LABELS[r.status]}
                        </span>
                        <span className='font-skin text-xs text-gray-500'>
                          {new Date(r.created_at).toLocaleString('ca', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className='font-skin text-xs text-blue-700'>{r.email}</p>
                    </div>
                    {r.status === 'pending' && (
                      <div className='flex gap-2 flex-shrink-0'>
                        <button
                          onClick={() => handleApprove(r)}
                          disabled={processingId === r.id}
                          className='font-skin text-xs font-bold px-3 py-1.5 border-skin bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-1'
                        >
                          <Check size={13} /> Aprovar
                        </button>
                        <button
                          onClick={() => handleReject(r)}
                          disabled={processingId === r.id}
                          className='font-skin text-xs font-bold px-3 py-1.5 border-skin bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1'
                        >
                          <XCircle size={13} /> Rebutjar
                        </button>
                      </div>
                    )}
                  </div>
                  {r.comment && (
                    <p className='font-skin text-sm text-gray-700 italic'>"{r.comment}"</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
