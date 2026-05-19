import { supabase } from '../lib/supabase'

export interface AISuggestion {
  title: string
  description: string
  category: string
  model?: string
}

export async function suggestResource(url: string, categories: string[]): Promise<AISuggestion> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Cal estar autenticat per usar la IA.')

  const { data, error } = await supabase.functions.invoke('suggest-resource', {
    body: { url, categories },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (error) {
    // FunctionsHttpError amaga l'error real — intentem llegir el body
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const body = await context.json()
        throw new Error(body?.error ?? error.message)
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr
      }
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)

  return data as AISuggestion
}
