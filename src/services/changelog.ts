import { supabase } from '../lib/supabase'
import type { ChangelogPost, ChangelogPostInsert, ChangelogPostUpdate } from '../types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => supabase.from('changelog_posts') as any

const PAGE_SIZE = 5

export async function getChangelogPosts(page: number, isAdmin: boolean): Promise<{ posts: ChangelogPost[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = table()
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to + 1) // +1 per detectar si hi ha més

  if (!isAdmin) {
    query = query.eq('status', 'published')
  }

  const { data, error } = await query
  if (error) throw error

  const posts = (data ?? []).slice(0, PAGE_SIZE) as ChangelogPost[]
  const hasMore = (data ?? []).length > PAGE_SIZE

  return { posts, hasMore }
}

export async function createChangelogPost(post: ChangelogPostInsert): Promise<ChangelogPost> {
  const { data, error } = await table().insert(post).select().single()
  if (error) throw error
  return data
}

export async function updateChangelogPost(id: string, updates: ChangelogPostUpdate): Promise<ChangelogPost> {
  const { data, error } = await table().update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteChangelogPost(id: string): Promise<void> {
  const { error } = await table().delete().eq('id', id)
  if (error) throw error
}

export async function getNewPostsCount(since: string): Promise<number> {
  const { count, error } = await table()
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .gt('created_at', since)
  if (error) return 0
  return count ?? 0
}
