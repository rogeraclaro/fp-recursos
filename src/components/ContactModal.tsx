import React, { useState } from 'react'
import { X, Send, CheckCircle } from 'lucide-react'
import { submitContact } from '../services/contacts'

interface Props {
  onClose: () => void
}

export const ContactModal: React.FC<Props> = ({ onClose }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) return
    setSending(true)
    setError('')
    try {
      await submitContact(name.trim(), email.trim(), message.trim())
      setSent(true)
    } catch {
      setError('Error en enviar. Torna-ho a intentar.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
      <div className='bg-surface border-4 border-black w-full max-w-md shadow-skin-lg'>
        <div className='flex justify-between items-center p-4 border-b-2 border-black bg-accent'>
          <h2 className='font-bold text-xl font-skin uppercase'>Contacte</h2>
          <button
            onClick={onClose}
            className='p-1 hover:bg-black hover:text-white transition-colors border border-black'
          >
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className='p-8 flex flex-col items-center gap-4 text-center'>
            <CheckCircle size={48} className='text-green-600' />
            <p className='font-skin font-bold text-lg'>Missatge enviat!</p>
            <p className='font-skin text-sm text-gray-600'>
              Gràcies pel teu contacte. Et respondrem aviat.
            </p>
            <button
              onClick={onClose}
              className='font-skin font-bold text-sm px-6 py-2.5 border-skin bg-black text-white hover:bg-gray-800 transition-colors'
            >
              Tancar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='p-6 space-y-4'>
            <div>
              <label className='font-skin text-xs font-bold uppercase text-gray-500 block mb-1'>
                Nom *
              </label>
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className='w-full border-skin p-2.5 font-skin text-sm focus:outline-none focus:bg-orange-50'
                placeholder='El teu nom'
              />
            </div>
            <div>
              <label className='font-skin text-xs font-bold uppercase text-gray-500 block mb-1'>
                Email *
              </label>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='w-full border-skin p-2.5 font-skin text-sm focus:outline-none focus:bg-orange-50'
                placeholder='el-teu@email.com'
              />
            </div>
            <div>
              <label className='font-skin text-xs font-bold uppercase text-gray-500 block mb-1'>
                Missatge *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                className='w-full border-skin p-2.5 font-skin text-sm focus:outline-none focus:bg-orange-50 resize-none'
                placeholder='Escriu el teu missatge...'
              />
            </div>
            {error && (
              <p className='font-skin text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2'>
                {error}
              </p>
            )}
            <div className='flex justify-end gap-3 pt-1'>
              <button
                type='button'
                onClick={onClose}
                className='font-skin font-bold text-sm px-4 py-2.5 border-skin bg-surface hover:bg-gray-100 transition-colors'
              >
                Cancel·lar
              </button>
              <button
                type='submit'
                disabled={sending || !name.trim() || !email.trim() || !message.trim()}
                className='font-skin font-bold text-sm px-4 py-2.5 border-skin bg-black text-white hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2'
              >
                <Send size={14} />
                {sending ? 'Enviant...' : 'Enviar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
