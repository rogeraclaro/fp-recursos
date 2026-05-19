import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const profiles = () => supabase.from('profiles') as any

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await profiles()
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  const { error } = await profiles()
    .update({ active })
    .eq('id', id)
  if (error) throw error
}

export async function updateProfile(id: string, username: string): Promise<Profile> {
  const { data, error } = await profiles()
    .update({ username })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createEditor(email: string, password: string, username: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase.functions.invoke('create-editor', {
    body: { email, password, username },
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (error) throw error
}

export async function getAdminId(): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('id').eq('role', 'admin').single()
  return data?.id ?? null
}

export async function deleteEditor(userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Cal estar autenticat.')
  const { error } = await supabase.functions.invoke('delete-editor', {
    body: { userId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) throw error
}
