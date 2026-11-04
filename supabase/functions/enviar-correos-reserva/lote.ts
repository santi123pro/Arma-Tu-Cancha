import type { DatosCorreo } from './plantilla.ts'

// Puerto 465 porque Supabase bloquea el 25 y el 587. Sin estos límites, un
// cuelgue de Gmail tardaría minutos y la función moriría a mitad de lote,
// gastando intentos de correos que ni se intentaron. Una sola conexión
// reutilizada evita repetir el saludo TLS en cada correo.
export function opcionesSmtp(usuario: string, clave: string) {
  return {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 1,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: { user: usuario, pass: clave },
  }
}

// Los errores de SMTP suelen citar direcciones. Nunca se guardan ni se registran.
function sinCorreos(texto: string): string {
  return texto.replace(/[^\s<>"',;:]+@[^\s<>"',;:]+/g, '[correo]')
}

// Envía uno por uno: un fallo no detiene a los demás. Si el correo salió pero
// no se pudo marcar, cuenta como enviado; el reintento podría repetirlo, y eso
// es preferible a que el jugador no reciba el aviso.
export async function procesarLote(
  correos: DatosCorreo[],
  enviar: (c: DatosCorreo) => Promise<void>,
  marcar: (id: number, exito: boolean, error?: string) => Promise<void>,
): Promise<{ enviados: number; fallidos: number }> {
  let enviados = 0
  let fallidos = 0

  for (const correo of correos) {
    let error: string | undefined
    try {
      await enviar(correo)
      enviados++
    } catch (e) {
      error = sinCorreos(e instanceof Error ? e.message : String(e))
      fallidos++
      console.error(`[enviar-correos-reserva] reserva ${correo.reserva_id}: ${error}`)
    }

    try {
      await marcar(correo.id, error === undefined, error)
    } catch (e) {
      const detalle = sinCorreos(e instanceof Error ? e.message : String(e))
      console.error(`[enviar-correos-reserva] no se pudo marcar la reserva ${correo.reserva_id}: ${detalle}`)
    }
  }

  return { enviados, fallidos }
}

// Compara todo el texto aunque ya haya una diferencia, para que el tiempo de
// respuesta no revele cuánto del token es correcto.
export function tokenValido(recibido: string | null, esperado: string): boolean {
  if (!recibido || !esperado) return false
  const a = new TextEncoder().encode(recibido)
  const b = new TextEncoder().encode(esperado)
  let diferencia = a.length ^ b.length
  for (let i = 0; i < b.length; i++) diferencia |= (a[i] ?? 0) ^ b[i]
  return diferencia === 0
}
