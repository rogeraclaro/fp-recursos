import { supabase } from '../lib/supabase'

export interface AISuggestion {
  title: string
  description: string
  category: string
}

export async function suggestResource(url: string, categories: string[]): Promise<AISuggestion | null> {
  try {
    const { data, error } = await supabase.functions.invoke('suggest-resource', {
      body: { url, categories },
    })
    if (error) throw error
    return data as AISuggestion
  } catch (err) {
    console.error('AI suggest error:', err)
    return null
  }
}
