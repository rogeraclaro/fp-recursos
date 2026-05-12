import { supabase } from '../lib/supabase'
import type { Category } from '../types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categories = () => supabase.from('categories') as any

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await categories()
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createCategory(name: string, userId: string): Promise<Category> {
  const { data, error } = await categories()
    .insert({ name, created_by: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const { data, error } = await categories()
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await categories()
    .delete()
    .eq('id', id)
  if (error) throw error
}
