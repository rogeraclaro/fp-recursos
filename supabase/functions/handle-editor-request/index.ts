import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://fp-recursos.masellas.info',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Bloquejar accés no autenticat: sense token JWT no es pot continuar
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validar JWT i comprovar que el caller és admin (client anon + token del caller)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user: caller } } = await supabaseUser.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { action, requestId, email, name, userId } = await req.json()

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

        // Generar link de recuperació i enviar-lo via Resend (evita rate limit de Supabase)
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: Deno.env.get('SITE_URL') },
        })
        if (linkError) throw linkError

        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (!resendApiKey) throw new Error('RESEND_API_KEY no configurada')

        const recoveryUrl = linkData.properties?.action_link
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SSCE0110 Links <noreply@masellas.info>',
            to: email,
            subject: 'SSCE0110 Links — Compte reactivat',
            html: `
              <div style="font-family: monospace; max-width: 520px; margin: 40px auto; background: #fff; border: 3px solid #000; box-shadow: 6px 6px 0 #000;">
                <div style="background: #f5c842; border-bottom: 3px solid #000; padding: 20px 28px;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;">SSCE0110 Links</h1>
                </div>
                <div style="padding: 28px;">
                  <p style="margin: 0 0 16px; font-size: 15px;">Hola ${name},</p>
                  <p style="margin: 0 0 16px; font-size: 15px;">
                    El teu compte a <strong>SSCE0110 Links</strong> ha estat reactivat.
                  </p>
                  <p style="margin: 0 0 24px; font-size: 15px;">
                    Fes clic al botó per establir una nova contrasenya i accedir:
                  </p>
                  <a href="${recoveryUrl}"
                     style="display: inline-block; background: #000; color: #fff; font-family: monospace; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 28px; text-decoration: none; border: 2px solid #000; box-shadow: 3px 3px 0 #f5c842;">
                    Establir nova contrasenya
                  </a>
                  <p style="margin: 24px 0 8px; font-size: 12px; color: #666;">
                    Si el botó no funciona, copia i enganxa aquest enllaç al navegador:
                  </p>
                  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all;">
                    <a href="${recoveryUrl}" style="color: #000;">${recoveryUrl}</a>
                  </p>
                  <hr style="border: none; border-top: 2px solid #000; margin: 24px 0;">
                  <p style="margin: 0; font-size: 12px; color: #666;">
                    Si no esperaves aquest correu, pots ignorar-lo.<br>
                    <a href="https://fp-recursos.masellas.info/" style="color: #000;">fp-recursos.masellas.info</a>
                  </p>
                </div>
              </div>
            `,
          }),
        })
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`Resend error: ${body}`)
        }
      }

      // Marcar petició com aprovada
      const { error: updateError } = await supabaseAdmin
        .from('editor_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
      if (updateError) throw updateError
    }

    if (action === 'reactivate') {
      // Obtenir email i nom de l'usuari via Auth Admin
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (userError) throw userError

      const userEmail = userData.user.email!
      const userName = userData.user.user_metadata?.username ?? userEmail

      // Generar link de recuperació
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: userEmail,
        options: { redirectTo: Deno.env.get('SITE_URL') },
      })
      if (linkError) throw linkError

      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) throw new Error('RESEND_API_KEY no configurada')

      const recoveryUrl = linkData.properties?.action_link
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SSCE0110 Links <noreply@masellas.info>',
          to: userEmail,
          subject: 'SSCE0110 Links — Compte reactivat',
          html: `
            <div style="font-family: monospace; max-width: 520px; margin: 40px auto; background: #fff; border: 3px solid #000; box-shadow: 6px 6px 0 #000;">
              <div style="background: #f5c842; border-bottom: 3px solid #000; padding: 20px 28px;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase;">SSCE0110 Links</h1>
              </div>
              <div style="padding: 28px;">
                <p style="margin: 0 0 16px; font-size: 15px;">Hola ${userName},</p>
                <p style="margin: 0 0 16px; font-size: 15px;">El teu compte a <strong>SSCE0110 Links</strong> ha estat reactivat.</p>
                <p style="margin: 0 0 24px; font-size: 15px;">Fes clic al botó per establir una nova contrasenya i accedir:</p>
                <a href="${recoveryUrl}" style="display: inline-block; background: #000; color: #fff; font-family: monospace; font-weight: 700; font-size: 14px; text-transform: uppercase; padding: 12px 28px; text-decoration: none; border: 2px solid #000; box-shadow: 3px 3px 0 #f5c842;">
                  Establir nova contrasenya
                </a>
                <p style="margin: 24px 0 8px; font-size: 12px; color: #666;">Si el botó no funciona, copia i enganxa aquest enllaç:</p>
                <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all;"><a href="${recoveryUrl}" style="color:#000;">${recoveryUrl}</a></p>
                <hr style="border: none; border-top: 2px solid #000; margin: 24px 0;">
                <p style="margin: 0; font-size: 12px; color: #666;"><a href="https://fp-recursos.masellas.info/" style="color:#000;">fp-recursos.masellas.info</a></p>
              </div>
            </div>
          `,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Resend error: ${body}`)
      }
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
