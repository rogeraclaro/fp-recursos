import React, { useState, useEffect } from 'react'
import { X, Mail, CheckCheck } from 'lucide-react'
import { getContactRequests, markContactAsRead } from '../services/contacts'
import type { ContactRequest } from '../types/database'

interface Props {
  onClose: () => void
  onUnreadChange: (count: number) => void
}

export const ContactsAdminModal: React.FC<Props> = ({ onClose, onUnreadChange }) => {
  const [contacts, setContacts] = useState<ContactRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getContactRequests()
      .then(setContacts)
      .finally(() => setLoading(false))
  }, [])

  async function handleMarkRead(id: string) {
    await markContactAsRead(id)
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, read: true } : c)))
    const remaining = contacts.filter((c) => !c.read && c.id !== id).length
    onUnreadChange(remaining)
  }

  async function handleMarkAllRead() {
    const unread = contacts.filter((c) => !c.read)
    await Promise.all(unread.map((c) => markContactAsRead(c.id)))
    setContacts((prev) => prev.map((c) => ({ ...c, read: true })))
    onUnreadChange(0)
  }

  const unreadCount = contacts.filter((c) => !c.read).length

  return (
    <div className='fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4'>
      <div className='bg-surface border-4 border-black w-full max-w-xl shadow-skin-lg flex flex-col max-h-[80vh]'>
        <div className='flex justify-between items-center p-4 border-b-2 border-black bg-accent flex-shrink-0'>
          <h2 className='font-bold text-xl font-skin uppercase flex items-center gap-2'>
            <Mail size={20} /> Contactes
            {unreadCount > 0 && (
              <span className='bg-black text-accent text-xs font-bold px-2 py-0.5 border border-black rounded-full'>
                {unreadCount} nous
              </span>
            )}
          </h2>
          <div className='flex items-center gap-2'>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className='font-skin text-xs font-bold px-3 py-1.5 border-skin bg-surface hover:bg-gray-100 transition-colors flex items-center gap-1'
                title='Marcar tots com llegits'
              >
                <CheckCheck size={14} /> Tots llegits
              </button>
            )}
            <button
              onClick={onClose}
              className='p-1 hover:bg-black hover:text-white transition-colors border border-black'
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto'>
          {loading ? (
            <div className='flex items-center justify-center p-12'>
              <div className='w-8 h-8 border-4 border-black border-t-accent rounded-full animate-spin' />
            </div>
          ) : contacts.length === 0 ? (
            <p className='font-skin text-sm text-gray-400 text-center p-12'>
              Encara no hi ha cap contacte.
            </p>
          ) : (
            <ul className='divide-y-2 divide-black'>
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className={`p-4 flex flex-col gap-2 ${c.read ? 'bg-surface' : 'bg-orange-50'}`}
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <span className='font-skin font-bold text-sm'>{c.name}</span>
                        {!c.read && (
                          <span className='bg-accent text-black text-[10px] font-bold px-1.5 py-0.5 border border-black'>
                            NOU
                          </span>
                        )}
                        <span className='font-skin text-xs text-gray-500'>
                          {new Date(c.created_at).toLocaleString('ca', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <a
                        href={`mailto:${c.email}`}
                        className='font-skin text-xs text-blue-700 hover:underline'
                      >
                        {c.email}
                      </a>
                    </div>
                    {!c.read && (
                      <button
                        onClick={() => handleMarkRead(c.id)}
                        className='flex-shrink-0 font-skin text-xs font-bold px-2.5 py-1 border-skin bg-surface hover:bg-gray-100 transition-colors flex items-center gap-1'
                        title='Marcar com llegit'
                      >
                        <CheckCheck size={12} /> Llegit
                      </button>
                    )}
                  </div>
                  <p className='font-skin text-sm whitespace-pre-wrap break-words text-gray-800'>
                    {c.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
