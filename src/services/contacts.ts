import { supabase } from '../lib/supabase'
import type { ContactRequest } from '../types/database'

const tbl = () => supabase.from('contact_requests') as any

export async function submitContact(name: string, email: string, message: string): Promise<void> {
  const { error } = await tbl().insert({ name, email, message })
  if (error) throw error
  await sendWhatsApp(name, email, message)
}

export async function getContactRequests(): Promise<ContactRequest[]> {
  const { data, error } = await tbl()
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getUnreadContactCount(): Promise<number> {
  const { count, error } = await tbl()
    .select('*', { count: 'exact', head: true })
    .eq('read', false)
  if (error) throw error
  return count ?? 0
}

export async function markContactAsRead(id: string): Promise<void> {
  const { error } = await tbl().update({ read: true }).eq('id', id)
  if (error) throw error
}

async function sendWhatsApp(name: string, email: string, message: string): Promise<void> {
  const phone = import.meta.env.VITE_CALLMEBOT_PHONE
  const apikey = import.meta.env.VITE_CALLMEBOT_APIKEY
  if (!phone || !apikey) return

  const text = `📩 Nou contacte SSCE0110:\n👤 ${name}\n📧 ${email}\n💬 ${message}`
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apikey}`

  try {
    await fetch(url, { mode: 'no-cors' })
  } catch {
    // notificació WhatsApp best-effort, no bloqueja l'enviament
  }
}
