import { supabase } from '../lib/supabase'
import type { Bookmark, BookmarkInsert, BookmarkUpdate } from '../types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bookmarks = () => supabase.from('bookmarks') as any

export async function getBookmarks(): Promise<Bookmark[]> {
  const { data, error } = await bookmarks()
    .select('*, profiles(username)')
    .order('highlighted', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createBookmark(bookmark: BookmarkInsert): Promise<Bookmark> {
  const { data, error } = await bookmarks()
    .insert(bookmark)
    .select('*, profiles(username)')
    .single()
  if (error) throw error
  return data
}

export async function updateBookmark(id: string, updates: BookmarkUpdate): Promise<Bookmark> {
  const { data, error } = await bookmarks()
    .update(updates)
    .eq('id', id)
    .select('*, profiles(username)')
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
