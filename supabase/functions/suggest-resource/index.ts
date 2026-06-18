import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://fp-recursos.masellas.info',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractPageContent(html: string): { title: string; metaDesc: string; bodyText: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch?.[1]?.trim() ?? ''

  const metaMatch =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']{1,500})["']/i) ??
    html.match(/<meta\s+content=["']([^"']{1,500})["']\s+name=["']description["']/i)
  const metaDesc = metaMatch?.[1]?.trim() ?? ''

  const bodyText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)

  return { title, metaDesc, bodyText }
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPRecursos/1.0)' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('html')) return null
    return await res.text()
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autoritzat' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'No autoritzat' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { url, categories } = await req.json()
    if (!url) throw new Error('URL requerida')

    // Intentem obtenir el contingut real de la pàgina
    const html = await fetchPageContent(url)
    let contextBlock: string

    if (html) {
      const { title, metaDesc, bodyText } = extractPageContent(html)
      contextBlock = `URL: ${url}
Títol de la pàgina: ${title || '(no disponible)'}
Meta descripció: ${metaDesc || '(no disponible)'}
Contingut de la pàgina:
${bodyText}`
    } else {
      contextBlock = `URL: ${url}
(No s'ha pogut obtenir el contingut de la pàgina)`
    }

    const prompt = `Ets un assistent que ajuda a catalogar recursos educatius per a Formació Professional a Catalunya.

Analitza el següent recurs i genera un títol i una descripció en català per afegir-lo a una biblioteca de recursos FP.

${contextBlock}

Categories disponibles: ${(categories as string[]).join(', ')}

Respon NOMÉS amb JSON vàlid (sense markdown ni text addicional):
{
  "title": "títol concís i descriptiu en català (màxim 80 caràcters)",
  "description": "descripció útil de 2-3 frases en català explicant de què tracta el recurs i per a qui és útil",
  "category": "una de les categories disponibles que millor s'ajusti"
}`

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 400,
      }),
    })

    if (!response.ok) throw new Error(`Groq error: ${response.status}`)

    const groqData = await response.json()
    const text: string = groqData.choices?.[0]?.message?.content ?? ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)

    return new Response(JSON.stringify({ ...result, model: MODEL }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconegut'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
