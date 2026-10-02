import { useEffect, useState } from 'react'
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
import TodasMisReservas from './paginas/TodasMisReservas'
import NuevaClave from './paginas/NuevaClave'
import Cargando from './componentes/Cargando'
import PiePagina from './componentes/PiePagina'
import { Privacidad, Terminos } from './paginas/Legal'
import NoEncontrada from './paginas/NoEncontrada'
import Gracias from './paginas/Gracias'
import { CONTACTO } from './lib/sitio'
import { registrarVisita } from './lib/analiticas'

const NOMBRES_ROL = {
  jugador: 'Jugador',
  admin_sede: 'Administrador de sede',
  superadmin: 'Administrador general',
}

// '/Arma-Tu-Cancha/' en GitHub Pages, '/' en local.
const BASE = import.meta.env.BASE_URL
// Pantallas con dirección propia (están en sitemap.xml).
const CON_URL = ['privacidad', 'terminos']
// Pantallas que se ven igual con o sin sesión.
const SUELTAS = [...CON_URL, 'no-encontrada']
// Pantallas sin sesión que, con sesión, llevan a las sedes.
const SOLO_SIN_SESION = ['portada', 'login', 'recuperar', 'gracias']

// '/Arma-Tu-Cancha/privacidad' → 'privacidad'. Una dirección que no
// existe → 'no-encontrada'.
function vistaDesdeUrl() {
  const ruta = window.location.pathname
  if (ruta === BASE || ruta + '/' === BASE || ruta === BASE + 'index.html') return 'portada'
  const resto = ruta.startsWith(BASE) ? ruta.slice(BASE.length).replace(/\/$/, '') : ''
  return CON_URL.includes(resto) ? resto : 'no-encontrada'
}

// 'la-bombonera' → 'La Bombonera'
function nombreDeSlug(slug) {
  return slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

const TITULOS = {
  login: 'Iniciar sesión',
  recuperar: 'Recuperar contraseña',
  gracias: '¡Gracias por registrarte!',
  bienvenida: '¡Bienvenido!',
  marketplace: 'Elige tu sede',
  'mis-reservas': 'Mis reservas',
  admin: 'Panel de administración',
  privacidad: 'Política de Privacidad',
  terminos: 'Términos y condiciones',
  'no-encontrada': 'Página no encontrada',
}
const SECCIONES = { partidos: 'Partidos abiertos', torneos: 'Torneos', reservas: 'Mis reservas' }

function tituloDe(vista) {
  if (vista === 'portada') return 'Arma Tu Cancha — Reserva canchas de fútbol en Cali'
  const [, seccion, slug] = vista.match(/^(partidos|torneos|reservas)\/(.+)$/) ?? []
  const pagina = TITULOS[vista]
    ?? (seccion ? `${SECCIONES[seccion]} · ${nombreDeSlug(slug)}` : nombreDeSlug(vista))
  return `${pagina} | Arma Tu Cancha`
}

function Contenido() {
  const { perfil, cargando, autenticado, esAdmin, recuperando, terminarRecuperacion } = useSesion()
  const toast = useToast()

  // Sin sesion: 'portada', 'login' o 'recuperar' (olvidé mi contraseña).
  // Con sesion: 'marketplace', el slug de una sede, 'partidos/<slug>', 'torneos/<slug>',
  // 'reservas/<slug>', 'mis-reservas' (las de todas las sedes)
  // o 'admin' (superadmin, o admin de sede con solo las métricas de su sede).
  const [vista, setVista] = useState(vistaDesdeUrl)
  // Sede que el visitante toco antes de iniciar sesion.
  const [sedePendiente, setSedePendiente] = useState(null)
  // Correo y nombre con los que se registró, para la pantalla de "Gracias".
  const [correoRegistro, setCorreoRegistro] = useState('')
  const [nombreRegistro, setNombreRegistro] = useState('')

  // Botón "atrás" del navegador o del celular: vuelve a la pantalla
  // anterior de la app en vez de salir de la página.
  useEffect(() => {
    window.history.replaceState({ vista }, '', window.location.href)
    const alVolver = (e) => setVista(e.state?.vista ?? vistaDesdeUrl())
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
    // Solo al montar: el estado inicial del historial es la primera vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Título de la pestaña y visita para las analíticas.
  const vistaVisible = autenticado && SOLO_SIN_SESION.includes(vista) ? 'marketplace' : vista
  useEffect(() => {
    if (cargando) return
    const titulo = tituloDe(vistaVisible)
    document.title = titulo
    registrarVisita('/' + (vistaVisible === 'portada' ? '' : vistaVisible), titulo)
  }, [vistaVisible, cargando])

  if (cargando) {
    return <Cargando tamano="grande" texto="Calentando en la banca" />
  }

  function irA(destino) {
    setVista(destino)
    const url = BASE + (CON_URL.includes(destino) ? destino + '/' : '')
    if (destino !== vista) window.history.pushState({ vista: destino }, '', url)
    window.scrollTo({ top: 0 })
  }

  function registroPendiente(correo) {
    setCorreoRegistro(correo)
    irA('gracias')
  }

  // La cuenta quedó activa al instante (Supabase sin confirmar correo).
  function registrado(nombre) {
    setNombreRegistro(nombre)
    irA('bienvenida')
  }

  function verSedeSinSesion(slug) {
    setSedePendiente(slug)
    irA('login')
  }

  function alAutenticarse() {
    irA(sedePendiente ?? 'marketplace')
    setSedePendiente(null)
  }

  function claveCambiada() {
    terminarRecuperacion()
    irA('marketplace')
  }

  function pedirOtroEnlace() {
    terminarRecuperacion()
    irA('recuperar')
  }

  async function salir() {
    await cerrarSesion()
    terminarRecuperacion()
    irA('portada')
    toast('Sesión cerrada.')
  }

  // Si hay sesion pero la vista quedo en una pantalla publica, mostramos las sedes.
  const esSuperadmin = perfil?.rol === 'superadmin'
  const esAdminSede = perfil?.rol === 'admin_sede' && perfil?.sede_id != null
  const puedeVerPanel = esSuperadmin || esAdminSede
  let vistaPrivada = SOLO_SIN_SESION.includes(vista) ? 'marketplace' : vista
  if (vistaPrivada === 'admin' && !puedeVerPanel) vistaPrivada = 'marketplace'
  const esVistaFija = ['marketplace', 'admin', 'mis-reservas', 'bienvenida'].includes(vistaPrivada)
  // El admin de sede solo entra a la sede que administra.
  const slugPedido = vistaPrivada.replace(/^(partidos|torneos|reservas)\//, '')
  if (esAdminSede && !esVistaFija && slugPedido !== perfil.sedes?.slug) vistaPrivada = 'marketplace'
  // 'torneos/wembley' → ['torneos', 'wembley']
  const [, seccion, slugSeccion] = vistaPrivada.match(/^(partidos|torneos|reservas)\/(.+)$/) ?? []

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
            <p className="info-contacto">📞 {CONTACTO.telefono}</p>
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
                  {NOMBRES_ROL[perfil?.rol] ?? 'Jugador'}
                </span>
              </span>
              <button
                type="button"
                className={'btn-panel-admin' + (vista === 'mis-reservas' ? ' activo' : '')}
                onClick={() => irA('mis-reservas')}
              >
                📅 Mis reservas
              </button>
              {puedeVerPanel && (
                <button
                  type="button"
                  className={'btn-panel-admin' + (vista === 'admin' ? ' activo' : '')}
                  onClick={() => irA('admin')}
                >
                  📊 {esSuperadmin ? 'Panel de administración' : 'Métricas de mi sede'}
                </button>
              )}
              <button onClick={salir} className="btn-logout" style={{ marginLeft: 12 }}>
                Cerrar sesión
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

      {/* Llegó por el enlace de "olvidé mi contraseña": primero la clave nueva. */}
      {recuperando ? (
        <NuevaClave autenticado={autenticado} onListo={claveCambiada} onPedirOtro={pedirOtroEnlace} />
      ) : SUELTAS.includes(vista) ? (
        <>
          {vista === 'privacidad' && <Privacidad onVolver={() => irA(autenticado ? 'marketplace' : 'portada')} />}
          {vista === 'terminos' && <Terminos onVolver={() => irA(autenticado ? 'marketplace' : 'portada')} />}
          {vista === 'no-encontrada' && <NoEncontrada onInicio={() => irA(autenticado ? 'marketplace' : 'portada')} />}
        </>
      ) : (
        <>
          {!autenticado && vista === 'gracias' && (
            <Gracias correo={correoRegistro} onIrLogin={() => irA('login')} />
          )}

          {!autenticado && vista === 'portada' && (
            <Portada onIrLogin={() => irA('login')} onVerSede={verSedeSinSesion} />
          )}

          {/* Tras entrar, la vista cambia un instante antes de que llegue la sesion:
              seguimos mostrando el login hasta entonces. */}
          {!autenticado && vista !== 'portada' && vista !== 'gracias' && (
            <Login
              key={vista === 'recuperar' ? 'recuperar' : 'entrar'}
              modoInicial={vista === 'recuperar' ? 'recuperar' : 'entrar'}
              sedePendiente={sedePendiente}
              onAutenticado={alAutenticarse}
              onRegistrado={registrado}
              onRegistroPendiente={registroPendiente}
              onVolver={() => irA('portada')}
            />
          )}

          {autenticado && vistaPrivada === 'bienvenida' && (
            <Gracias
              lista
              nombre={nombreRegistro || perfil?.nombre}
              onContinuar={alAutenticarse}
            />
          )}

          {autenticado && vistaPrivada === 'admin' && (
            <PanelAdmin
              nombre={perfil?.nombre}
              sedeId={esSuperadmin ? null : perfil.sede_id}
              onVolver={() => irA('marketplace')}
            />
          )}

          {autenticado && vistaPrivada === 'marketplace' && (
            <Marketplace
              soloSedeId={esAdminSede ? perfil.sede_id : null}
              onElegirSede={(slug) => irA(slug)}
            />
          )}

          {autenticado && vistaPrivada === 'mis-reservas' && (
            <TodasMisReservas onVolver={() => irA('marketplace')} />
          )}

          {autenticado && seccion && (
            <PaginaPartidos
              key={vistaPrivada}
              slug={slugSeccion}
              tipo={seccion}
              onVolver={() => irA(slugSeccion)}
              onCambiar={seccion === 'reservas' ? undefined : () => irA((seccion === 'partidos' ? 'torneos/' : 'partidos/') + slugSeccion)}
            />
          )}

          {autenticado && !esVistaFija && !seccion && (
            <Sede
              slug={vistaPrivada}
              onVolver={() => irA('marketplace')}
              onVerPartidos={() => irA('partidos/' + vistaPrivada)}
              onVerTorneos={() => irA('torneos/' + vistaPrivada)}
              onVerReservas={() => irA('reservas/' + vistaPrivada)}
            />
          )}
        </>
      )}

      <PiePagina onIr={irA} />
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
