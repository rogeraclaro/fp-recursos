import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, requestId, email, name } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (action === 'approve') {
      // Invitar l'usuari — Supabase envia l'email amb link per establir password
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { username: name, role: 'editor' },
        redirectTo: Deno.env.get('SITE_URL'),
      })
      if (inviteError) throw inviteError

      // Marcar petició com aprovada
      const { error: updateError } = await supabaseAdmin
        .from('editor_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
      if (updateError) throw updateError
    }

    if (action === 'reject') {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) throw new Error('RESEND_API_KEY no configurada')

      // Enviar email de rebuig via Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SSCE0110 Links <onboarding@resend.dev>',
          to: email,
          subject: "Sol·licitud d'editor — Resposta",
          html: `
            <p>Hola ${name},</p>
            <p>Gràcies per l'interès en participar com a editor a <strong>SSCE0110 Links</strong>.</p>
            <p>Lamentem informar-te que en aquest moment la teva sol·licitud no ha pogut ser aprovada.</p>
            <p>Si tens cap dubte, pots contactar-nos a través del lloc web.</p>
            <br>
            <p>Gràcies,<br>L'equip de SSCE0110 Links</p>
          `,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Resend error: ${body}`)
      }

      // Marcar petició com rebutjada
      const { error: updateError } = await supabaseAdmin
        .from('editor_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
      if (updateError) throw updateError
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconegut'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
