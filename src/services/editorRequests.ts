import { supabase } from '../lib/supabase'
import type { EditorRequest } from '../types/database'

const tbl = () => supabase.from('editor_requests') as any

export async function submitEditorRequest(
  name: string,
  email: string,
  comment: string,
): Promise<void> {
  const { error } = await tbl().insert({ name, email, comment: comment || null })
  if (error) throw error
  await sendWhatsApp(name, email, comment)
}

export async function getEditorRequests(): Promise<EditorRequest[]> {
  const { data, error } = await tbl()
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getPendingEditorRequestCount(): Promise<number> {
  const { count, error } = await tbl()
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

export async function approveEditorRequest(
  requestId: string,
  email: string,
  name: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('handle-editor-request', {
    body: { action: 'approve', requestId, email, name },
  })
  if (error) {
    // Extreure el missatge real del cos de la resposta
    const body = await (error as any).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? error.message)
  }
  if (data?.error) throw new Error(data.error)
}

export async function rejectEditorRequest(
  requestId: string,
  email: string,
  name: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('handle-editor-request', {
    body: { action: 'reject', requestId, email, name },
  })
  if (error) throw error
}

async function sendWhatsApp(name: string, email: string, comment: string): Promise<void> {
  const phone = import.meta.env.VITE_CALLMEBOT_PHONE
  const apikey = import.meta.env.VITE_CALLMEBOT_APIKEY
  if (!phone || !apikey) return

  const text = `🙋 Petició alta editor SSCE0110:\n👤 ${name}\n📧 ${email}${comment ? `\n💬 ${comment}` : ''}`
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apikey}`

  try {
    await fetch(url, { mode: 'no-cors' })
  } catch {
    // best-effort
  }
}
