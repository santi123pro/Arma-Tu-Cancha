import { supabase } from '../lib/supabase'
import Seguridad from '../componentes/admin/Seguridad'
import fotoFondo from '../../imagenes/cancha_1_wembley.webp'

// El superadmin le exige la verificación en dos pasos a esta cuenta y aún
// no la tiene: hasta activarla no ve nada más (como en Entra ID). La base
// de datos ya le niega los permisos de admin mientras tanto (0023).
export default function ActivarVerificacion({ onSalir }) {
  // Pide la sesión de nuevo para que traiga el factor recién activado y
  // useSesion deje pasar.
  function activada() {
    supabase.auth.refreshSession()
  }

  return (
    <main className="login-pagina">
      <section className="login-panel" style={{ backgroundImage: `url(${fotoFondo})` }}>
        <div className="login-panel-contenido">
          <span className="hero-badge">Verificación en dos pasos</span>
          <h2 className="login-panel-titulo">
            Protege
            <br />
            tu <span>cuenta.</span>
          </h2>
        </div>
      </section>

      <section className="login-lado-form">
        <div className="login-card">
          <h2 className="login-titulo">Activa la verificación</h2>
          <p className="login-subtitulo">
            El administrador la exige para tu cuenta. Tarda un minuto y solo necesitas tu celular.
          </p>
          <Seguridad obligatoria onActivada={activada} />
          <p className="login-pie">
            <button type="button" className="login-link" onClick={onSalir}>
              Salir
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}
