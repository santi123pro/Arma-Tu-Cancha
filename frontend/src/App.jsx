import { useState } from 'react'
import { useSesion } from './lib/useSesion'
import { cerrarSesion } from './lib/datos'
import { ToastProvider, useToast } from './componentes/Toast'
import { logo } from './lib/imagenes'
import Marketplace from './paginas/Marketplace'
import Sede from './paginas/sede'
import Portada from './paginas/Portada'
import Login from './paginas/Login'
import PaginaPartidos from './paginas/PaginaPartidos'
import PanelAdmin from './paginas/PanelAdmin'

function Contenido() {
  const { perfil, cargando, autenticado, esAdmin } = useSesion()
  const toast = useToast()

  // Sin sesion: 'portada' o 'login'.
  // Con sesion: 'marketplace', el slug de una sede, 'partidos/<slug>', 'torneos/<slug>'
  // o 'admin' (solo superadmin).
  const [vista, setVista] = useState('portada')
  // Sede que el visitante toco antes de iniciar sesion.
  const [sedePendiente, setSedePendiente] = useState(null)

  if (cargando) {
    return <p style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Cargando…</p>
  }

  function irA(destino) {
    setVista(destino)
    window.scrollTo({ top: 0 })
  }

  function verSedeSinSesion(slug) {
    setSedePendiente(slug)
    irA('login')
  }

  function alAutenticarse() {
    irA(sedePendiente ?? 'marketplace')
    setSedePendiente(null)
  }

  async function salir() {
    await cerrarSesion()
    irA('portada')
    toast('Sesión cerrada.')
  }

  // Si hay sesion pero la vista quedo en una pantalla publica, mostramos las sedes.
  const esSuperadmin = perfil?.rol === 'superadmin'
  let vistaPrivada = vista === 'portada' || vista === 'login' ? 'marketplace' : vista
  if (vistaPrivada === 'admin' && !esSuperadmin) vistaPrivada = 'marketplace'
  // 'torneos/wembley' → ['torneos', 'wembley']
  const [, seccion, slugSeccion] = vistaPrivada.match(/^(partidos|torneos)\/(.+)$/) ?? []

  return (
    <>
      <header className="header-wembley">
        <button
          type="button"
          className="logo-container logo-boton"
          onClick={function () {
            irA(autenticado ? 'marketplace' : 'portada')
          }}
        >
          <img src={logo} alt="Logo de Arma Tu Cancha" className="logo-img" />
          <div>
            <h1>Arma Tu Cancha ⚽</h1>
            <p className="info-contacto">📞 +57 316 2528100</p>
          </div>
        </button>

        <div className="auth-box-header">
          {autenticado ? (
            <div>
              <span id="saludo-usuario">
                👤 <strong>{perfil?.nombre ?? 'Jugador'}</strong>
                <span style={{
                  fontSize: 11, background: esAdmin ? '#22c55e' : '#38bdf8',
                  color: '#0f172a', padding: '2px 7px', borderRadius: 4,
                  fontWeight: 700, textTransform: 'uppercase', marginLeft: 6,
                }}>
                  {perfil?.rol ?? 'jugador'}
                </span>
              </span>
              {esSuperadmin && (
                <button
                  type="button"
                  className={'btn-panel-admin' + (vista === 'admin' ? ' activo' : '')}
                  onClick={() => irA('admin')}
                >
                  📊 Panel admin
                </button>
              )}
              <button onClick={salir} className="btn-logout" style={{ marginLeft: 12 }}>
                Cerrar Sesión
              </button>
            </div>
          ) : vista !== 'portada' ? (
            <button type="button" className="btn-cta-secondary" onClick={() => irA('portada')}>
              ← Volver al inicio
            </button>
          ) : (
            <button type="button" className="btn-cta-header" onClick={() => irA('login')}>
              Iniciar sesión
            </button>
          )}
        </div>
      </header>

      {!autenticado && vista === 'portada' && (
        <Portada onIrLogin={() => irA('login')} onVerSede={verSedeSinSesion} />
      )}

      {/* Tras entrar, la vista cambia un instante antes de que llegue la sesion:
          seguimos mostrando el login hasta entonces. */}
      {!autenticado && vista !== 'portada' && (
        <Login
          sedePendiente={sedePendiente}
          onAutenticado={alAutenticarse}
          onVolver={() => irA('portada')}
        />
      )}

      {autenticado && vistaPrivada === 'admin' && (
        <PanelAdmin nombre={perfil?.nombre} onVolver={() => irA('marketplace')} />
      )}

      {autenticado && vistaPrivada === 'marketplace' && (
        <Marketplace onElegirSede={(slug) => irA(slug)} />
      )}

      {autenticado && seccion && (
        <PaginaPartidos
          key={vistaPrivada}
          slug={slugSeccion}
          tipo={seccion}
          onVolver={() => irA(slugSeccion)}
          onCambiar={() => irA((seccion === 'partidos' ? 'torneos/' : 'partidos/') + slugSeccion)}
        />
      )}

      {autenticado && vistaPrivada !== 'marketplace' && vistaPrivada !== 'admin' && !seccion && (
        <Sede
          slug={vistaPrivada}
          onVolver={() => irA('marketplace')}
          onVerPartidos={() => irA('partidos/' + vistaPrivada)}
          onVerTorneos={() => irA('torneos/' + vistaPrivada)}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Contenido />
    </ToastProvider>
  )
}
