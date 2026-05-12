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
