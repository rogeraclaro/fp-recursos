import React, { useState, useEffect, useRef } from 'react'
import { X, Send, MessageSquare, Edit2, Trash2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getThread, getAllAdminMessages, sendMessage, markThreadAsRead, updateMessage, deleteMessage } from '../services/messages'
import { getProfiles, getAdminId } from '../services/profiles'
import type { Message, Profile } from '../types/database'

interface Props {
  onClose: () => void
  onUnreadChange: (count: number) => void
}

function ThreadView({
  messages,
  currentUserId,
  canEditAll,
  onSend,
  onEdit,
  onDelete,
}: {
  messages: Message[]
  currentUserId: string
  canEditAll: boolean
  onSend: (text: string) => Promise<void>
  onEdit: (id: string, content: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const lastOwnMessageId = [...messages].reverse().find(m => m.sender_id === currentUserId)?.id

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    setSending(true)
    try { await onSend(trimmed); setText('') } finally { setSending(false) }
  }

  async function handleSaveEdit(id: string) {
    const trimmed = editText.trim()
    if (!trimmed) return
    await onEdit(id, trimmed)
    setEditingId(null)
  }

  function startEdit(m: Message) {
    setEditingId(m.id)
    setEditText(m.content)
  }

  function canModify(m: Message) {
    if (m.sender_id !== currentUserId) return false
    return canEditAll || m.id === lastOwnMessageId
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="font-skin text-sm text-gray-400 text-center pt-8">
            Encara no hi ha missatges. Escriu el primer!
          </p>
        )}
        {messages.map(m => {
          const isOwn = m.sender_id === currentUserId
          const editable = canModify(m)
          return (
            <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`group max-w-[75%] border-skin px-3 py-2 font-skin text-sm shadow-skin-sm ${isOwn ? 'bg-accent' : 'bg-surface'}`}>
                {editingId === m.id ? (
                  <div className="flex flex-col gap-1">
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(m.id) }
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      rows={2}
                      className="w-full border border-black p-1 bg-white text-black resize-none focus:outline-none text-sm font-skin"
                    />
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => handleSaveEdit(m.id)} className="p-1 hover:bg-green-100 border border-black transition-colors" title="Guardar"><Check size={12} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 hover:bg-gray-100 border border-black transition-colors" title="Cancel·lar"><X size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="break-words">{m.content}</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-[10px] text-gray-600">
                        {new Date(m.created_at).toLocaleString('ca', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {editable && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(m)} className="p-0.5 hover:bg-black/10 rounded transition-colors" title="Editar"><Edit2 size={11} /></button>
                          <button onClick={() => onDelete(m.id)} className="p-0.5 hover:bg-black/10 rounded transition-colors" title="Eliminar"><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t-2 border-black p-3 flex gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Escriu un missatge... (Enter per enviar)"
          rows={2}
          className="flex-1 border-skin p-2 font-skin text-sm resize-none focus:outline-none focus:bg-orange-50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="px-3 py-2 border-skin bg-black text-white hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-1 self-end"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

export const MessagesModal: React.FC<Props> = ({ onClose, onUnreadChange }) => {
  const { user, isAdmin } = useAuth()
  const [adminId, setAdminId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [selectedEditorId, setSelectedEditorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    if (isAdmin) {
      Promise.all([getProfiles(), getAllAdminMessages(user.id)])
        .then(([profs, msgs]) => {
          setProfiles(profs.filter(p => p.role === 'editor'))
          setAllMessages(msgs)
        })
        .finally(() => setLoading(false))
    } else {
      getAdminId().then(async id => {
        setAdminId(id)
        if (id) {
          const msgs = await getThread(user.id, id)
          setAllMessages(msgs)
          await markThreadAsRead(user.id, id)
          onUnreadChange(0)
        }
        setLoading(false)
      })
    }
  }, [])

  async function handleAdminSelectEditor(editorId: string) {
    if (!user) return
    setSelectedEditorId(editorId)
    const msgs = await getThread(user.id, editorId)
    setAllMessages(prev => {
      const otherMsgs = prev.filter(
        m => !(
          (m.sender_id === user.id && m.recipient_id === editorId) ||
          (m.sender_id === editorId && m.recipient_id === user.id)
        )
      )
      return [...otherMsgs, ...msgs]
    })
    await markThreadAsRead(user.id, editorId)
    const remaining = allMessages.filter(
      m => m.recipient_id === user.id && !m.read_by_recipient && m.sender_id !== editorId
    ).length
    onUnreadChange(remaining)
  }

  async function handleEditorSend(text: string) {
    if (!user || !adminId) return
    const msg = await sendMessage(user.id, adminId, text)
    setAllMessages(prev => [...prev, msg])
  }

  async function handleAdminSend(text: string) {
    if (!user || !selectedEditorId) return
    const msg = await sendMessage(user.id, selectedEditorId, text)
    setAllMessages(prev => [...prev, msg])
  }

  async function handleEdit(id: string, content: string) {
    const updated = await updateMessage(id, content)
    setAllMessages(prev => prev.map(m => m.id === id ? updated : m))
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar aquest missatge?')) return
    await deleteMessage(id)
    setAllMessages(prev => prev.filter(m => m.id !== id))
  }

  const editorThreads = React.useMemo(() => {
    if (!isAdmin || !user) return []
    const editorIds = new Set<string>()
    allMessages.forEach(m => {
      if (m.sender_id !== user.id) editorIds.add(m.sender_id)
      if (m.recipient_id !== user.id) editorIds.add(m.recipient_id)
    })
    return [...editorIds].map(editorId => {
      const profile = profiles.find(p => p.id === editorId)
      const unread = allMessages.filter(
        m => m.sender_id === editorId && m.recipient_id === user.id && !m.read_by_recipient
      ).length
      const lastMsg = allMessages
        .filter(m => m.sender_id === editorId || m.recipient_id === editorId)
        .at(-1)
      return { editorId, username: profile?.username ?? editorId.slice(0, 8), unread, lastMsg }
    }).sort((a, b) => {
      const aTime = a.lastMsg?.created_at ?? ''
      const bTime = b.lastMsg?.created_at ?? ''
      return bTime.localeCompare(aTime)
    })
  }, [allMessages, profiles, isAdmin, user])

  const threadMessages = React.useMemo(() => {
    if (!user) return []
    const otherId = isAdmin ? selectedEditorId : adminId
    if (!otherId) return []
    return allMessages.filter(
      m =>
        (m.sender_id === user.id && m.recipient_id === otherId) ||
        (m.sender_id === otherId && m.recipient_id === user.id)
    )
  }, [allMessages, selectedEditorId, adminId, isAdmin, user])

  return (
    <div className="fixed inset-0 z-50 flex flex-col modal-overlay sm:items-center sm:justify-center sm:p-4">
      <div className={`bg-surface border-4 border-black flex flex-col h-full w-full sm:shadow-skin-lg ${isAdmin ? 'sm:max-w-3xl sm:h-[600px]' : 'sm:max-w-lg sm:h-[520px]'}`}>
        {/* Capçalera */}
        <div className="flex justify-between items-center p-4 border-b-2 border-black bg-accent flex-shrink-0">
          <h2 className="font-bold text-xl font-skin uppercase flex items-center gap-2">
            <MessageSquare size={20} /> Missatges
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black hover:text-white transition-colors border border-black">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-black border-t-accent rounded-full animate-spin" />
          </div>
        ) : isAdmin ? (
          <div className="flex flex-1 min-h-0">
            <div className="w-48 border-r-2 border-black flex-shrink-0 overflow-y-auto">
              {editorThreads.length === 0 && (
                <p className="font-skin text-xs text-gray-400 p-4 text-center">Sense missatges</p>
              )}
              {editorThreads.map(t => (
                <button
                  key={t.editorId}
                  onClick={() => handleAdminSelectEditor(t.editorId)}
                  className={`w-full text-left p-3 border-b border-gray-200 hover:bg-orange-50 transition-colors flex items-center justify-between gap-2 ${selectedEditorId === t.editorId ? 'bg-orange-100' : ''}`}
                >
                  <span className="font-skin text-sm font-bold truncate">{t.username}</span>
                  {t.unread > 0 && (
                    <span className="bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {t.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              {selectedEditorId ? (
                <ThreadView
                  messages={threadMessages}
                  currentUserId={user!.id}
                  canEditAll={true}
                  onSend={handleAdminSend}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 font-skin text-sm">
                  Selecciona un editor per veure la conversa
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            {adminId ? (
              <ThreadView
                messages={threadMessages}
                currentUserId={user!.id}
                canEditAll={false}
                onSend={handleEditorSend}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : (
              <p className="font-skin text-sm text-gray-400 p-6 text-center">No s'ha trobat l'administrador.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
