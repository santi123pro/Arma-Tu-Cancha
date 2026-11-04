// Edge Function: envía los correos de "reserva confirmada".
//
// La llama pg_cron cada minuto (migración 0022) si hay correos en la cola,
// con el encabezado x-correos-token. No la llama el navegador. Se despliega
// sin verificar JWT, por eso el token se revisa antes de cualquier otra cosa.
//
// Usa el puerto 465 porque Supabase bloquea las conexiones al 25 y al 587.

import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'
import { opcionesSmtp, procesarLote, tokenValido } from './lote.ts'
import { armarCorreo, type DatosCorreo } from './plantilla.ts'

const TAMANO_LOTE = 10

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  })
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405)

  if (!tokenValido(req.headers.get('x-correos-token'), Deno.env.get('CORREOS_TOKEN') ?? '')) {
    return responder({ error: 'No autorizado.' }, 401)
  }

  const usuario = Deno.env.get('GMAIL_USUARIO')
  const clave = Deno.env.get('GMAIL_CLAVE_APP')
  const appUrl = Deno.env.get('APP_URL')
  if (!usuario || !clave || !appUrl) {
    console.error('[enviar-correos-reserva] faltan secretos de configuración')
    return responder({ error: 'Falta configuración.' }, 500)
  }

  try {
    const { data, error } = await admin.rpc('tomar_correos_reserva', { p_limite: TAMANO_LOTE })
    if (error) throw error

    const transporte = nodemailer.createTransport(opcionesSmtp(usuario, clave))

    const resultado = await procesarLote(
      (data ?? []) as DatosCorreo[],
      async (correo) => {
        const { asunto, html, texto } = armarCorreo(correo, appUrl)
        await transporte.sendMail({
          from: { name: 'Arma Tu Cancha', address: usuario },
          to: correo.destinatario,
          subject: asunto,
          html,
          text: texto,
        })
      },
      async (id, exito, detalle) => {
        const { error: errorMarcar } = await admin.rpc('marcar_correo_reserva', {
          p_id: id,
          p_exito: exito,
          p_error: detalle ?? null,
        })
        if (errorMarcar) throw errorMarcar
      },
    )

    transporte.close()
    return responder(resultado)
  } catch (error) {
    console.error('[enviar-correos-reserva]', error instanceof Error ? error.message : 'error desconocido')
    return responder({ error: 'No se pudieron procesar los correos.' }, 500)
  }
})
