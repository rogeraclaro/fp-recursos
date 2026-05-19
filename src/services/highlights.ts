import { supabase } from '../lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => supabase.from('editor_highlights') as any

export async function getEditorHighlights(userId: string): Promise<string[]> {
  const { data, error } = await table().select('bookmark_id').eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((r: { bookmark_id: string }) => r.bookmark_id)
}

export async function toggleEditorHighlight(userId: string, bookmarkId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await table().insert({ user_id: userId, bookmark_id: bookmarkId })
    if (error) throw error
  } else {
    const { error } = await table().delete().eq('user_id', userId).eq('bookmark_id', bookmarkId)
    if (error) throw error
  }
}
