// Sustituye a src/lib/supabase.js en la simulación, para que funcione sin
// archivo .env: ese módulo se detiene si faltan las variables de Supabase.
// Los datos de la simulación salen de datosDemo.js; este cliente no conecta.

// Mismo texto que en src/lib/supabase.js: las pantallas lo comparan.
export const ERROR_FRANJA_OCUPADA =
  'Otro usuario acaba de reservar este horario. Elige uno diferente.'

export const MARCA_RECUPERAR = 'recuperar'
export const vieneDeRecuperacion = false

const SIN_CONEXION = { message: 'La simulación no se conecta a Supabase.' }

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: null, error: SIN_CONEXION }),
    signUp: async () => ({ data: null, error: SIN_CONEXION }),
    signOut: async () => ({ error: null }),
  },
}

export function traducirError(error) {
  return error?.message ?? null
}

export async function consultar(promesa) {
  const { data, error } = await promesa
  return { datos: data ?? null, error: traducirError(error) }
}
