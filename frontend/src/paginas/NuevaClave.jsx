import { useState } from 'react'
import { cambiarClave } from '../lib/datos'
import { useToast } from '../componentes/Toast'
import { CampoClave } from './Login'
import fotoFondo from '../../imagenes/cancha_1_wembley.jpeg'

// Pantalla a la que llega el usuario desde el enlace del correo de
// recuperación. El enlace ya abrió una sesión; aquí solo se cambia la clave.
// Si el enlace venció o ya se usó, no hay sesión y se le ofrece pedir otro.
export default function NuevaClave({ autenticado, onListo, onPedirOtro }) {
  const toast = useToast()
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    if (enviando) return

    if (clave.length < 8) {
      toast('La contraseña debe tener al menos 8 caracteres.', 'error')
      return
    }
    if (clave !== repetir) {
      toast('Las contraseñas no coinciden.', 'error')
      return
    }

    setEnviando(true)
    const { error } = await cambiarClave(clave)
    setEnviando(false)

    if (error) {
      toast(error, 'error')
      return
    }

    toast('Tu contraseña se actualizó correctamente. 🔐')
    onListo()
  }

  return (
    <main className="login-pagina">
      <section className="login-panel" style={{ backgroundImage: `url(${fotoFondo})` }}>
        <div className="login-panel-contenido">
          <span className="hero-badge">Recuperar cuenta</span>
          <h2 className="login-panel-titulo">
            De vuelta
            <br />
            a la <span>cancha.</span>
          </h2>
        </div>
      </section>

      <section className="login-lado-form">
        <div className="login-card">
          {!autenticado ? (
            <div className="login-form recuperar-enviado" role="alert">
              <span className="recuperar-icono">⏰</span>
              <h3>El enlace ya no es válido</h3>
              <p>Es posible que haya vencido (es válido durante una hora) o que ya se haya usado. Solicita uno nuevo.</p>
              <button type="button" className="btn-cta-primary login-submit" onClick={onPedirOtro}>
                Solicitar un nuevo enlace
              </button>
            </div>
          ) : (
            <>
              <h2 className="login-titulo">Crea tu nueva contraseña</h2>
              <p className="login-subtitulo">Usa al menos 8 caracteres. Al guardarla, iniciarás sesión automáticamente.</p>

              <form onSubmit={guardar} className="login-form">
                <CampoClave
                  etiqueta="Contraseña nueva"
                  valor={clave}
                  onCambio={setClave}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  autoComplete="new-password"
                />
                <CampoClave
                  etiqueta="Repite la contraseña"
                  valor={repetir}
                  onCambio={setRepetir}
                  placeholder="Escríbela de nuevo"
                  minLength={8}
                  autoComplete="new-password"
                />
                {repetir && clave !== repetir && (
                  <p className="recuperar-nota recuperar-error">Las contraseñas no coinciden.</p>
                )}

                <button type="submit" className="btn-cta-primary login-submit" disabled={enviando}>
                  {enviando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
