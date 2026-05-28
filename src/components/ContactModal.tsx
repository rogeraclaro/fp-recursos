import React, { useState } from 'react'
import { X, Send, CheckCircle } from 'lucide-react'
import { submitContact } from '../services/contacts'
import { Button, Input, Label, TextArea } from './UI'

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
      <div className='w-full max-w-md relative'>
        <button
          onClick={onClose}
          className='absolute -top-3 -right-3 z-10 p-1.5 bg-surface border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_0px_#000]'
        >
          <X size={18} />
        </button>

        <div className='bg-accent border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000]'>
          <h2 className='font-black font-mono text-xl uppercase tracking-wider'>Contacte</h2>
        </div>

        {sent ? (
          <div className='bg-white border-4 border-t-0 border-black p-8 shadow-[8px_8px_0px_0px_#000] flex flex-col items-center gap-4 text-center'>
            <CheckCircle size={48} className='text-green-600' />
            <p className='font-skin font-bold text-lg'>Missatge enviat!</p>
            <p className='font-skin text-sm text-gray-600'>Gràcies pel teu contacte. Et respondrem aviat.</p>
            <Button onClick={onClose} className='w-full'>Tancar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='bg-white border-4 border-t-0 border-black p-6 shadow-[8px_8px_0px_0px_#000] space-y-4'>
            <div>
              <Label>Nom *</Label>
              <Input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder='El teu nom'
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder='el-teu@email.com'
              />
            </div>
            <div>
              <Label>Missatge *</Label>
              <TextArea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                placeholder='Escriu el teu missatge...'
              />
            </div>
            {error && (
              <p className='font-skin text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2'>{error}</p>
            )}
            <div className='flex justify-end gap-3 pt-1'>
              <Button type='button' variant='secondary' onClick={onClose}>Cancel·lar</Button>
              <Button
                type='submit'
                disabled={sending || !name.trim() || !email.trim() || !message.trim()}
                icon={<Send size={14} />}
              >
                {sending ? 'Enviant...' : 'Enviar'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
