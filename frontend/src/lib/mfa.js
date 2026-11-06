import { supabase, traducirError } from './supabase'

// ---------------------------------------------------------------------
// Verificación en dos pasos (MFA) con app autenticadora (TOTP):
// Microsoft Authenticator, Google Authenticator, Authy, etc.
//
// Niveles de la sesión (claim "aal" del JWT):
//   aal1 — entró solo con contraseña
//   aal2 — además escribió el código de la app
// ---------------------------------------------------------------------

// Lee el claim "aal" del token sin llamar a Supabase. Se usa dentro de
// onAuthStateChange, donde llamar a supabase.auth puede bloquear el cliente.
function nivelDelToken(token) {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(parte)).aal ?? 'aal1'
  } catch {
    return 'aal1'
  }
}

// true si la cuenta ya activó la app autenticadora.
export function tieneFactor(usuario) {
  return (usuario?.factors ?? []).some((f) => f.status === 'verified')
}

// true si la cuenta tiene la verificación activa pero esta sesión aún no
// pasó el código. Mismo criterio que mfa.getAuthenticatorAssuranceLevel().
export function faltaCodigo(session) {
  if (!session) return false
  return tieneFactor(session.user) && nivelDelToken(session.access_token) === 'aal1'
}

// El factor TOTP ya verificado, o null.
export async function factorActivo() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return { datos: null, error: traducirError(error) }
  return { datos: data.totp.find((f) => f.status === 'verified') ?? null, error: null }
}

// Empieza la inscripción: devuelve el QR (como URL de imagen) y el secreto
// por si no puede escanear. Borra antes los intentos que quedaron a medias,
// que si no Supabase rechaza el nombre repetido.
export async function iniciarInscripcion() {
  const { data: lista } = await supabase.auth.mfa.listFactors()
  for (const f of lista?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Arma Tu Cancha',
    friendlyName: 'App autenticadora',
  })
  if (error) return { datos: null, error: traducirError(error) }

  const qr = data.totp.qr_code.startsWith('data:')
    ? data.totp.qr_code
    : 'data:image/svg+xml;utf-8,' + encodeURIComponent(data.totp.qr_code)
  return { datos: { factorId: data.id, qr, secreto: data.totp.secret }, error: null }
}

// Confirma un código de la app. Sirve para terminar la inscripción y para
// el paso del código al iniciar sesión: en ambos casos la sesión sube a aal2.
export async function verificarCodigo(factorId, codigo) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: codigo.replace(/\D/g, ''),
  })
  return { error: traducirError(error) }
}

// Quita la verificación. Supabase exige una sesión aal2 para hacerlo.
export async function desactivar(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  return { error: traducirError(error) }
}
