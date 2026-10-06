import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------
// Cliente único de Supabase.
//
// Reemplaza a tu api.js y a todo el backend de Express. Se crea una sola
// vez y se importa donde se necesite: si creas varios clientes, la sesión
// se desincroniza entre ellos.
// ---------------------------------------------------------------------

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !clave) {
  throw new Error(
    'Faltan las variables de entorno de Supabase. ' +
    'Revisa tu archivo .env.local y reinicia npm run dev.'
  )
}

// El enlace del correo de recuperación vuelve a la app con ?recuperar=1.
// Se lee antes de crear el cliente porque este limpia la URL al leer la
// sesión que trae el enlace.
export const MARCA_RECUPERAR = 'recuperar'
export const vieneDeRecuperacion =
  new URLSearchParams(window.location.search).has(MARCA_RECUPERAR)

export const supabase = createClient(url, clave, {
  auth: {
    persistSession: true,     // la sesión sobrevive al refrescar la página
    autoRefreshToken: true,   // renueva el token antes de que expire
    detectSessionInUrl: true, // necesario para el enlace de confirmación
  },
})

// ---------------------------------------------------------------------
// Traducción de errores
// ---------------------------------------------------------------------
// PostgreSQL devuelve códigos, no frases. Sin esta capa, el usuario ve
// "duplicate key value violates unique constraint reservas_sin_solape".
// Es lo mismo que hacía tu errorHandler.js, pero del lado del cliente.
// ---------------------------------------------------------------------

// Las pantallas comparan contra este texto para saber que la franja se
// ocupó entre que se consultó la disponibilidad y se pulsó "Reservar".
export const ERROR_FRANJA_OCUPADA =
  'Otro usuario acaba de reservar este horario. Elige uno diferente.'

const POR_RESTRICCION = {
  reservas_sin_solape: ERROR_FRANJA_OCUPADA,
  inscripcion_equipo_unico:
    'Ese nombre de equipo ya está inscrito en este torneo.',
  inscripcion_capitan_unico:
    'Ya inscribiste un equipo en este torneo.',
  partidos_sin_solape:
    'Ya hay un partido publicado en esa cancha, ese día y a esa hora. Elige otro horario.',
  partido_jugador_unico:
    'Ya tienes un cupo en este partido.',
  canchas_nombre_unico_por_sede:
    'Esa sede ya tiene una cancha con ese nombre.',
  sedes_slug_key:
    'Ya existe una sede registrada con ese nombre.',
  partidos_cupos_coherentes:
    'Ese partido ya no tiene cupos disponibles.',
  torneos_cupos_rango:
    'Un torneo debe tener entre 4 y 12 equipos.',
  reservas_horario_valido:
    'La hora de fin debe ser posterior a la hora de inicio.',
}

const POR_MENSAJE_AUTH = [
  ['Invalid login credentials',  'Correo o contraseña incorrectos.'],
  ['User already registered',    'Ya existe una cuenta con ese correo. Inicia sesión.'],
  ['Email not confirmed',        'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.'],
  ['Password should be at least','La contraseña debe tener al menos 8 caracteres.'],
  ['For security purposes',      'Espera unos segundos antes de volver a intentarlo.'],
  ['New password should be different', 'La contraseña nueva debe ser distinta de la anterior.'],
  ['rate limit exceeded',        'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.'],
  ['Auth session missing',       'El enlace ya no es válido. Solicita uno nuevo.'],
]

export function traducirError(error) {
  if (!error) return null

  // Errores que lanzamos a propósito desde las funciones de PostgreSQL:
  // el mensaje ya viene escrito para el usuario.
  if (error.code && /^P00\d\d$/.test(error.code)) return error.message

  // Violación de restricción única o de CHECK.
  // 23P01: la restricción de exclusión de 0010 (dos reservas que se pisan).
  if (error.code === '23P01') return ERROR_FRANJA_OCUPADA

  if (error.code === '23505' || error.code === '23514') {
    const texto = `${error.message} ${error.details ?? ''}`
    for (const [clave, mensaje] of Object.entries(POR_RESTRICCION)) {
      if (texto.includes(clave)) return mensaje
    }
    return 'Ese registro ya existe o no cumple una regla del sistema.'
  }

  if (error.code === '23503') {
    return 'El registro que intentas usar no existe o fue eliminado.'
  }

  // RLS rechazó la operación.
  if (error.code === '42501' || error.code === 'PGRST301') {
    return 'No tienes permiso para realizar esta acción.'
  }

  // Errores de autenticación.
  for (const [fragmento, mensaje] of POR_MENSAJE_AUTH) {
    if (error.message?.includes(fragmento)) return mensaje
  }

  // Sin conexión.
  if (error.message?.includes('Failed to fetch')) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión a internet.'
  }

  console.error('[supabase]', error)
  return error.message || 'Ocurrió un error inesperado. Intenta de nuevo.'
}

// ---------------------------------------------------------------------
// Atajo: ejecuta una consulta y devuelve { datos, error } ya traducido.
// ---------------------------------------------------------------------
export async function consultar(promesa) {
  const { data, error } = await promesa
  return { datos: data, error: traducirError(error) }
}
