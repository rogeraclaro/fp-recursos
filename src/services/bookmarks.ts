import { supabase } from '../lib/supabase'
import type { Bookmark, BookmarkInsert, BookmarkUpdate } from '../types/database'
import { notifyWhatsApp } from './notify'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bookmarks = () => supabase.from('bookmarks') as any

export async function getBookmarks(): Promise<Bookmark[]> {
  const { data, error } = await bookmarks()
    .select('*, profiles(username, active)')
    .order('highlighted', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createBookmark(bookmark: BookmarkInsert): Promise<Bookmark> {
  const { data, error } = await bookmarks()
    .insert(bookmark)
    .select('*, profiles(username, active)')
    .single()
  if (error) throw error
  const username = (data.profiles as { username: string } | null)?.username ?? 'desconegut'
  await notifyWhatsApp(`📎 Nou recurs afegit per ${username}:\n${data.title}`)
  return data
}

export async function updateBookmark(id: string, updates: BookmarkUpdate): Promise<Bookmark> {
  const { data, error } = await bookmarks()
    .update(updates)
    .eq('id', id)
    .select('*, profiles(username, active)')
    .single()
  if (error) throw error
  return data
}

export async function deleteBookmark(id: string): Promise<void> {
  const { error } = await bookmarks()
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function toggleHighlight(id: string, highlighted: boolean): Promise<void> {
  const { error } = await bookmarks()
    .update({ highlighted })
    .eq('id', id)
  if (error) throw error
}

export async function reassignCategory(oldName: string, newName: string): Promise<void> {
  const { data, error } = await bookmarks()
    .select('id, categories')
    .contains('categories', [oldName])
  if (error) throw error
  if (!data || data.length === 0) return
  await Promise.all(
    (data as { id: string; categories: string[] }[]).map(b => {
      const updated = b.categories.map((c: string) => c === oldName ? newName : c)
      return bookmarks().update({ categories: updated }).eq('id', b.id)
    })
  )
}
