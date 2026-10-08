// Edge Function: iniciar sesión con el celular y la contraseña.
//
// Recibe { telefono, clave }, busca el correo de la cuenta con
// cuentas_por_telefono (migración 0018), inicia sesión con ese correo y
// devuelve { access_token, refresh_token } para que el navegador abra la
// sesión con setSession. El correo nunca sale de aquí.
//
// 5 contraseñas malas para un número lo bloquean 15 minutos.

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FALLOS_MAXIMOS = 5
const MINUTOS_BLOQUEO = 15
const INCORRECTO = 'Celular o contraseña incorrectos.'

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const url = Deno.env.get('SUPABASE_URL')!
const llave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(url, llave, { auth: { persistSession: false } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405)

  const { telefono, clave } = await req.json().catch(() => ({}))
  const diez = String(telefono ?? '').replace(/\D/g, '').slice(-10)
  if (diez.length < 10) return responder({ error: 'Escribe tu celular completo (10 dígitos).' }, 400)
  if (!clave) return responder({ error: 'Escribe tu contraseña.' }, 400)

  try {
    const desde = new Date(Date.now() - MINUTOS_BLOQUEO * 60_000).toISOString()
    const { count, error: errorConteo } = await admin
      .from('intentos_login_telefono')
      .select('id', { count: 'exact', head: true })
      .eq('telefono', diez)
      .eq('exito', false)
      .gte('creado_at', desde)
    if (errorConteo) throw errorConteo
    if ((count ?? 0) >= FALLOS_MAXIMOS) {
      return responder({
        error: `Demasiados intentos con este número. Espera ${MINUTOS_BLOQUEO} minutos o entra con tu correo.`,
      }, 429)
    }

    const { data: correos, error } = await admin.rpc('cuentas_por_telefono', { p_telefono: diez })
    if (error) throw error

    // Si varias cuentas comparten el número, entra a la que tenga esa clave.
    for (const correo of (correos ?? []) as string[]) {
      // Un cliente por intento: el que inicia sesión guarda la sesión
      // del jugador y no debe reutilizarse como admin.
      const cliente = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data, error: errorEntrar } = await cliente.auth.signInWithPassword({ email: correo, password: String(clave) })
      if (data?.session) {
        await admin.from('intentos_login_telefono').insert({ telefono: diez, exito: true })
        return responder({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }
      if (errorEntrar && /not confirmed/i.test(errorEntrar.message)) {
        return responder({ error: 'Confirma tu cuenta con el enlace que te llegó al correo.' }, 400)
      }
    }

    await admin.from('intentos_login_telefono').insert({ telefono: diez, exito: false })
    // Limpieza de vez en cuando: los intentos viejos no sirven.
    if (Math.random() < 0.05) {
      admin.from('intentos_login_telefono').delete()
        .lt('creado_at', new Date(Date.now() - 86_400_000).toISOString())
        .then(() => {}, () => {})
    }
    return responder({ error: INCORRECTO }, 400)
  } catch (error) {
    console.error('[entrar-con-telefono]', error)
    return responder({ error: 'No pudimos iniciar sesión. Intenta más tarde.' }, 500)
  }
})
