import { useState } from 'react'
import { factorActivo, verificarCodigo } from '../lib/mfa'
import { useToast } from '../lib/useToast'
import fotoFondo from '../../imagenes/cancha_1_wembley.webp'

// Campo de 6 dígitos que también usa la inscripción en el panel.
// autoComplete="one-time-code" deja que el celular sugiera el código.
export function CampoCodigo({ valor, onCambio, autoFocus }) {
  return (
    <label className="login-campo">
      <span>Código de 6 dígitos</span>
      <input
        className="input-moderno codigo-mfa"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus={autoFocus}
        value={valor}
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
      />
    </label>
  )
}

// Segundo paso del inicio de sesión: la contraseña ya entró (sesión aal1)
// y la cuenta tiene la verificación activa. Hasta escribir el código no
// se muestra nada más de la app. Sirve igual para correo, celular y para
// el enlace de recuperar la contraseña.
export default function VerificarCodigo({ onSalir }) {
  const toast = useToast()
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function verificar(e) {
    e.preventDefault()
    if (enviando || codigo.length !== 6) return
    setError(null)
    setEnviando(true)

    const { datos: factor, error: errorFactor } = await factorActivo()
    const { error } = factor
      ? await verificarCodigo(factor.id, codigo)
      : { error: errorFactor ?? 'No encontramos tu app autenticadora. Vuelve a iniciar sesión.' }
    setEnviando(false)

    if (error) {
      setError(error)
      setCodigo('')
      return
    }
    // useSesion ve la sesión aal2 y la app sigue sola.
    toast('Sesión iniciada.')
  }

  return (
    <main className="login-pagina">
      <section className="login-panel" style={{ backgroundImage: `url(${fotoFondo})` }}>
        <div className="login-panel-contenido">
          <span className="hero-badge">Verificación en dos pasos</span>
          <h2 className="login-panel-titulo">
            Un paso
            <br />
            más y <span>a jugar.</span>
          </h2>
        </div>
      </section>

      <section className="login-lado-form">
        <div className="login-card">
          <h2 className="login-titulo">Escribe tu código</h2>
          <p className="login-subtitulo">
            Abre Microsoft Authenticator (o la app que usaste) y escribe el código de <strong>Arma Tu Cancha</strong>.
          </p>

          <form onSubmit={verificar} className="login-form">
            <CampoCodigo valor={codigo} onCambio={setCodigo} autoFocus />
            {error && <p className="login-error" role="alert">⚠️ {error}</p>}
            <button type="submit" className="btn-cta-primary login-submit" disabled={enviando || codigo.length !== 6}>
              {enviando ? 'Verificando…' : 'Verificar'}
            </button>
          </form>

          <p className="recuperar-nota">
            ¿Perdiste el celular? Pídele al administrador general que te restablezca la verificación.
          </p>
          <p className="login-pie">
            <button type="button" className="login-link" onClick={onSalir}>
              Salir y entrar con otra cuenta
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}
