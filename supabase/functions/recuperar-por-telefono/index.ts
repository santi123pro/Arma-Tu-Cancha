// Edge Function: recuperar la contraseña con el número de teléfono.
//
// Recibe { telefono, redirectTo }, busca el correo de la cuenta con
// correos_por_telefono (migración 0008) y le envía el enlace normal de
// Supabase para cambiar la contraseña.
//
// Siempre responde lo mismo, exista o no el número: así nadie puede usar
// este formulario para averiguar qué teléfonos están registrados.

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405)

  const { telefono, redirectTo } = await req.json().catch(() => ({}))
  const digitos = String(telefono ?? '').replace(/\D/g, '')
  if (digitos.length < 7) {
    return responder({ error: 'Escribe un número de teléfono válido.' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: correos, error } = await admin.rpc('correos_por_telefono', { p_telefono: digitos })
  if (error) {
    console.error('[recuperar-por-telefono]', error)
    return responder({ error: 'No pudimos procesar la solicitud. Intenta más tarde.' }, 500)
  }

  // Supabase valida redirectTo contra las Redirect URLs del proyecto.
  for (const correo of (correos ?? []) as string[]) {
    const { error: errorEnvio } = await admin.auth.resetPasswordForEmail(correo, { redirectTo })
    if (errorEnvio) console.error('[recuperar-por-telefono]', errorEnvio)
  }

  return responder({ ok: true })
})
