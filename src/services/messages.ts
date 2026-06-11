import { supabase } from '../lib/supabase'
import type { Message } from '../types/database'
import { notifyWhatsApp } from './notify'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const msg = () => supabase.from('messages') as any

export async function getThread(userAId: string, userBId: string): Promise<Message[]> {
  const { data, error } = await msg()
    .select('*')
    .or(`and(sender_id.eq.${userAId},recipient_id.eq.${userBId}),and(sender_id.eq.${userBId},recipient_id.eq.${userAId})`)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getAllAdminMessages(adminId: string): Promise<Message[]> {
  const { data, error } = await msg()
    .select('*')
    .or(`sender_id.eq.${adminId},recipient_id.eq.${adminId}`)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function sendMessage(senderId: string, recipientId: string, content: string): Promise<Message> {
  const { data, error } = await msg()
    .insert({ sender_id: senderId, recipient_id: recipientId, content })
    .select()
    .single()
  if (error) throw error
  await notifyWhatsApp('💬 Nou missatge a fp-recursos')
  return data
}

export async function markThreadAsRead(recipientId: string, senderId: string): Promise<void> {
  const { error } = await msg()
    .update({ read_by_recipient: true })
    .eq('recipient_id', recipientId)
    .eq('sender_id', senderId)
    .eq('read_by_recipient', false)
  if (error) throw error
}

export async function updateMessage(id: string, content: string): Promise<Message> {
  const { data, error } = await msg()
    .update({ content })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await msg().delete().eq('id', id)
  if (error) throw error
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const { count, error } = await msg()
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .eq('read_by_recipient', false)
  if (error) throw error
  return count ?? 0
}
