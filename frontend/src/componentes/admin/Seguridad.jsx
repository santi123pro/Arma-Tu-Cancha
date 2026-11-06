import { useEffect, useState } from 'react'
import { desactivar, factorActivo, iniciarInscripcion, verificarCodigo } from '../../lib/mfa'
import { useToast } from '../../lib/useToast'
import { CampoCodigo } from '../../paginas/VerificarCodigo'
import Cargando from '../Cargando'

// Activar o quitar la verificación en dos pasos de la propia cuenta.
// Pasos: QR → escanear con la app → escribir el código → activa.
export default function Seguridad() {
  const toast = useToast()
  const [cargando, setCargando] = useState(true)
  const [factor, setFactor] = useState(null)
  // { factorId, qr, secreto } mientras se está inscribiendo.
  const [inscripcion, setInscripcion] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verSecreto, setVerSecreto] = useState(false)
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)

  async function cargar() {
    const { datos, error } = await factorActivo()
    if (error) toast(error, 'error')
    setFactor(datos)
    setCargando(false)
  }

  useEffect(() => {
    let vivo = true
    factorActivo().then(({ datos, error }) => {
      if (!vivo) return
      if (error) toast(error, 'error')
      setFactor(datos)
      setCargando(false)
    })
    return () => { vivo = false }
  }, [toast])

  async function empezar() {
    setOcupado(true)
    const { datos, error } = await iniciarInscripcion()
    setOcupado(false)
    if (error) return toast(error, 'error')
    setCodigo('')
    setVerSecreto(false)
    setInscripcion(datos)
  }

  async function confirmar(e) {
    e.preventDefault()
    if (ocupado || codigo.length !== 6) return
    setOcupado(true)
    const { error } = await verificarCodigo(inscripcion.factorId, codigo)
    setOcupado(false)
    if (error) {
      setCodigo('')
      return toast(error, 'error')
    }
    setInscripcion(null)
    toast('Verificación en dos pasos activada. 🔐')
    cargar()
  }

  async function quitar() {
    setOcupado(true)
    const { error } = await desactivar(factor.id)
    setOcupado(false)
    setConfirmarQuitar(false)
    if (error) return toast(error, 'error')
    toast('Verificación en dos pasos desactivada.')
    cargar()
  }

  if (cargando) return <Cargando texto="Revisando tu cuenta" />

  return (
    <article className="admin-tarjeta seguridad-mfa">
      <header>
        <h3>🔐 Verificación en dos pasos</h3>
        <p>Además de la contraseña, al entrar te pediremos un código de tu celular.</p>
      </header>

      {factor ? (
        <div className="seguridad-estado">
          <p><span className="torneo-estado estado-curso">Activada</span> Tu cuenta pide el código de la app al iniciar sesión.</p>
          {confirmarQuitar ? (
            <div className="seguridad-botones">
              <span className="admin-pregunta">¿Seguro? Tu cuenta quedará menos protegida.</span>
              <button type="button" className="btn-cta-primary btn-chico" onClick={quitar} disabled={ocupado}>
                {ocupado ? 'Quitando…' : 'Sí, desactivar'}
              </button>
              <button type="button" className="login-link" onClick={() => setConfirmarQuitar(false)}>Cancelar</button>
            </div>
          ) : (
            <button type="button" className="login-link" onClick={() => setConfirmarQuitar(true)}>
              Desactivar verificación
            </button>
          )}
        </div>
      ) : inscripcion ? (
        <form onSubmit={confirmar} className="seguridad-pasos">
          <ol>
            <li>Instala <strong>Microsoft Authenticator</strong> (o Google Authenticator, Authy…).</li>
            <li>En la app toca <strong>+ → Otra cuenta</strong> y escanea este código:</li>
          </ol>
          <img className="seguridad-qr" src={inscripcion.qr} alt="Código QR para la app autenticadora" />
          <p className="recuperar-nota">
            ¿No puedes escanear?{' '}
            {verSecreto ? (
              <>Escribe esta clave en la app: <code className="seguridad-secreto">{inscripcion.secreto}</code></>
            ) : (
              <button type="button" className="login-link" onClick={() => setVerSecreto(true)}>Ver la clave</button>
            )}
          </p>
          <ol start={3}>
            <li>Escribe el código que te muestra la app:</li>
          </ol>
          <CampoCodigo valor={codigo} onCambio={setCodigo} />
          <div className="seguridad-botones">
            <button type="submit" className="btn-cta-primary btn-chico" disabled={ocupado || codigo.length !== 6}>
              {ocupado ? 'Verificando…' : 'Activar'}
            </button>
            <button type="button" className="login-link" onClick={() => setInscripcion(null)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="seguridad-estado">
          <p><span className="torneo-estado estado-fin">Desactivada</span> Cualquiera con tu contraseña puede entrar al panel.</p>
          <button type="button" className="btn-cta-primary btn-chico" onClick={empezar} disabled={ocupado}>
            {ocupado ? 'Preparando…' : 'Activar verificación'}
          </button>
        </div>
      )}
    </article>
  )
}
