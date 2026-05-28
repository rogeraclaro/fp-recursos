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
      // Intentar convidar (cas usuari nou)
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { username: name, role: 'editor' },
        redirectTo: Deno.env.get('SITE_URL'),
      })

      if (inviteError) {
        // Si l'usuari ja existeix, reactivar el perfil en lloc de tornar a convidar
        const alreadyExists =
          inviteError.message?.toLowerCase().includes('already') ||
          inviteError.message?.toLowerCase().includes('registered') ||
          (inviteError as any).status === 422

        if (!alreadyExists) throw inviteError

        // Buscar l'usuari existent per email
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
        if (listError) throw listError

        const existingUser = listData.users.find((u) => u.email === email)
        if (!existingUser) throw new Error(`Usuari amb email ${email} no trobat a Auth`)

        // Reactivar el perfil
        const { error: reactivateError } = await supabaseAdmin
          .from('profiles')
          .update({ active: true, role: 'editor' })
          .eq('id', existingUser.id)
        if (reactivateError) throw reactivateError

        // Enviar email de restabliment de contrasenya
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: Deno.env.get('SITE_URL'),
        })
        if (resetError) throw resetError
      }

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
