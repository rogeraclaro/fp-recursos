import { SUPABASE_URL, SUPABASE_ANON_KEY, EDGE_FUNCTION_URL } from './config'

async function supabaseRequest<T>(path: string, method: string, jwt?: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Prefer': 'return=minimal',
  }
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`

  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Supabase error ${res.status}: ${text}`)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json() as Promise<T>
}

export interface AuthSession {
  access_token: string
  user_id: string
  username: string
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const data = await supabaseRequest<{ access_token: string; user: { id: string } }>(
    '/auth/v1/token?grant_type=password',
    'POST',
    undefined,
    { email, password }
  )

  const profiles = await supabaseRequest<{ username: string }[]>(
    `/rest/v1/profiles?id=eq.${data.user.id}&select=username`,
    'GET',
    data.access_token
  )

  return {
    access_token: data.access_token,
    user_id: data.user.id,
    username: profiles[0]?.username ?? email.split('@')[0],
  }
}

export async function getCategories(jwt: string): Promise<string[]> {
  const data = await supabaseRequest<{ name: string }[]>(
    '/rest/v1/categories?select=name&order=name',
    'GET',
    jwt
  )
  return data.map(c => c.name)
}

export async function isDuplicate(url: string, jwt: string): Promise<boolean> {
  const data = await supabaseRequest<{ id: string }[]>(
    `/rest/v1/bookmarks?url=eq.${encodeURIComponent(url)}&select=id`,
    'GET',
    jwt
  )
  return data.length > 0
}

export interface BookmarkSaveData {
  title: string
  description: string
  url: string
  categories: string[]
  user_id: string
}

export async function saveBookmark(data: BookmarkSaveData, jwt: string): Promise<void> {
  await supabaseRequest<void>(
    '/rest/v1/bookmarks',
    'POST',
    jwt,
    data
  )
}

export async function getSavedUrls(jwt: string): Promise<string[]> {
  const data = await supabaseRequest<{ url: string }[]>(
    '/rest/v1/bookmarks?select=url',
    'GET',
    jwt
  )
  return data.map(b => b.url)
}

export interface AISuggestion {
  title: string
  description: string
  category: string
}

export async function suggestResource(
  url: string,
  categories: string[],
  jwt: string
): Promise<AISuggestion | null> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({ url, categories }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    return await res.json() as AISuggestion
  } catch {
    return null
  }
}
