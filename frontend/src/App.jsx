import { lazy, Suspense, useEffect, useState } from 'react'
import { useSesion } from './lib/useSesion'
import { cerrarSesion } from './lib/datos'
import { ToastProvider } from './componentes/Toast'
import { useToast } from './lib/useToast'
import { logo } from './lib/imagenes'
import Marketplace from './paginas/Marketplace'
import Sede from './paginas/sede'
import Portada from './paginas/Portada'
import Login from './paginas/Login'
import PaginaPartidos from './paginas/PaginaPartidos'
import TodasMisReservas from './paginas/TodasMisReservas'
import NuevaClave from './paginas/NuevaClave'
import VerificarCodigo from './paginas/VerificarCodigo'
import ActivarVerificacion from './paginas/ActivarVerificacion'
import Seguridad from './componentes/admin/Seguridad'
import Cargando from './componentes/Cargando'
import PiePagina from './componentes/PiePagina'
import { Privacidad, Terminos } from './paginas/Legal'
import NoEncontrada from './paginas/NoEncontrada'
import Gracias from './paginas/Gracias'
import Aliados from './paginas/Aliados'
import Icono from './componentes/Icono'
import { registrarVisita } from './lib/analiticas'
import { useEnLinea } from './lib/pwa'
import { useTema } from './lib/tema'

// El panel y sus gráficas solo los descarga quien los abre.
const PanelAdmin = lazy(() => import('./paginas/PanelAdmin'))

// '/Arma-Tu-Cancha/' en GitHub Pages, '/' en local.
const BASE = import.meta.env.BASE_URL
// Pantallas con dirección propia (están en sitemap.xml).
const CON_URL = ['privacidad', 'terminos', 'aliados']
// Pantallas que se ven igual con o sin sesión.
const SUELTAS = [...CON_URL, 'no-encontrada']
// Pantallas sin sesión que, con sesión, llevan a las sedes.
const SOLO_SIN_SESION = ['portada', 'login', 'recuperar', 'gracias']

// Cada pantalla tiene su URL, así se puede recargar o compartir el enlace.
// GitHub Pages las abre todas gracias a 404.html (copia de index.html).
//   portada       → /                  marketplace      → /sedes
//   login         → /entrar            'wembley'        → /sede/wembley
//   recuperar     → /recuperar-clave   'partidos/wembley' → /sede/wembley/partidos
//   privacidad    → /privacidad/       (igual: mis-reservas, admin, gracias, bienvenida)
const RUTA_FIJA = { portada: '', login: 'entrar', recuperar: 'recuperar-clave', marketplace: 'sedes' }
const VISTAS_CON_NOMBRE = ['mis-reservas', 'mi-cuenta', 'admin', 'gracias', 'bienvenida', 'no-encontrada']

function rutaDe(vista) {
  if (vista in RUTA_FIJA) return BASE + RUTA_FIJA[vista]
  if (CON_URL.includes(vista)) return BASE + vista + '/'
  if (VISTAS_CON_NOMBRE.includes(vista)) return BASE + vista
  const [, seccion, slug] = vista.match(/^(partidos|torneos|reservas)\/(.+)$/) ?? []
  return BASE + (seccion ? `sede/${slug}/${seccion}` : `sede/${vista}`)
}

// Lo contrario: '/Arma-Tu-Cancha/sede/wembley/partidos' → 'partidos/wembley'.
// Una dirección que no existe → 'no-encontrada'.
function vistaDesdeUrl() {
  const ruta = window.location.pathname
  if (ruta + '/' === BASE) return 'portada'
  if (!ruta.startsWith(BASE)) return 'no-encontrada'
  const resto = ruta.slice(BASE.length).replace(/\/$/, '').replace(/^index\.html$/, '')

  const fija = Object.keys(RUTA_FIJA).find((v) => RUTA_FIJA[v] === resto)
  if (fija) return fija
  if (CON_URL.includes(resto) || VISTAS_CON_NOMBRE.includes(resto)) return resto
  const [, slug, seccion] = resto.match(/^sede\/([a-z0-9-]+)(?:\/(partidos|torneos|reservas))?$/) ?? []
  if (slug) return seccion ? `${seccion}/${slug}` : slug
  return 'no-encontrada'
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
  'mi-cuenta': 'Mi cuenta',
  admin: 'Panel de administración',
  privacidad: 'Política de Privacidad',
  terminos: 'Términos y condiciones',
  aliados: 'Trabaja con nosotros',
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
  const { perfil, cargando, autenticado, recuperando, terminarRecuperacion, necesitaCodigo, debeActivarMfa } = useSesion()
  const toast = useToast()
  const enLinea = useEnLinea()
  const { tema, alternar: alternarTema } = useTema()

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
    const alVolver = () => setVista(vistaDesdeUrl())
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
    registrarVisita(rutaDe(vistaVisible).slice(BASE.length - 1), titulo)
  }, [vistaVisible, cargando])

  // Con sesión, las pantallas de inicio y login muestran las sedes: la URL
  // también debe decir /sedes. (Sin tocar el enlace de recuperar clave.)
  useEffect(() => {
    if (!cargando && autenticado && !recuperando && SOLO_SIN_SESION.includes(vista)) {
      window.history.replaceState({ vista: 'marketplace' }, '', rutaDe('marketplace'))
    }
  }, [cargando, autenticado, recuperando, vista])

  if (cargando) {
    return <Cargando tamano="grande" texto="Calentando en la banca" />
  }

  function irA(destino) {
    setVista(destino)
    const url = rutaDe(destino)
    // Si la URL ya es esa (por ejemplo, tras iniciar sesión), no se repite
    // en el historial: así "atrás" no se queda en la misma pantalla.
    if (window.location.pathname === url) window.history.replaceState({ vista: destino }, '', url)
    else window.history.pushState({ vista: destino }, '', url)
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

  // Si abrió el enlace de una pantalla privada sin sesión (por ejemplo
  // /sede/wembley), al entrar se queda en esa pantalla.
  function alAutenticarse() {
    irA(sedePendiente ?? (SOLO_SIN_SESION.includes(vista) ? 'marketplace' : vista))
    setSedePendiente(null)
  }

  // Desde la bienvenida: a la sede que había tocado antes de registrarse,
  // o a la lista de sedes.
  function continuarTrasRegistro() {
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
  const esVistaFija = ['marketplace', 'admin', 'mis-reservas', 'mi-cuenta', 'bienvenida'].includes(vistaPrivada)
  // El admin de sede solo entra a la sede que administra.
  const slugPedido = vistaPrivada.replace(/^(partidos|torneos|reservas)\//, '')
  if (esAdminSede && !esVistaFija && slugPedido !== perfil.sedes?.slug) vistaPrivada = 'marketplace'
  // 'torneos/wembley' → ['torneos', 'wembley']
  const [, seccion, slugSeccion] = vistaPrivada.match(/^(partidos|torneos|reservas)\/(.+)$/) ?? []

  // La misma navegación va arriba en PC y como barra inferior en el celular.
  const bloqueado = necesitaCodigo || debeActivarMfa
  const destinos = autenticado && !bloqueado ? [
    { id: 'marketplace', texto: 'Sedes', icono: 'sedes', activo: !['mis-reservas', 'mi-cuenta', 'admin'].includes(vistaPrivada) && !SUELTAS.includes(vista) },
    { id: 'mis-reservas', texto: 'Mis reservas', icono: 'reservas', activo: vistaPrivada === 'mis-reservas' },
    ...(puedeVerPanel ? [{ id: 'admin', texto: esSuperadmin ? 'Panel' : 'Mi sede', icono: 'panel', activo: vistaPrivada === 'admin' }] : []),
    { id: 'mi-cuenta', texto: 'Mi cuenta', icono: 'cuenta', activo: vistaPrivada === 'mi-cuenta' },
  ] : []
  const enlaces = destinos.map((d) => (
    <button
      key={d.id}
      type="button"
      aria-current={d.activo ? 'page' : undefined}
      onClick={() => irA(d.id)}
    >
      <Icono nombre={d.icono} />
      <span>{d.texto}</span>
    </button>
  ))

  return (
    <div className={autenticado ? 'app-con-barra' : undefined}>
      <header className="app-header">
        <button
          type="button"
          className="app-marca"
          aria-label="Arma Tu Cancha, ir al inicio"
          onClick={function () {
            irA(autenticado ? 'marketplace' : 'portada')
          }}
        >
          <img src={logo} alt="" />
          <span>Arma Tu Cancha</span>
        </button>

        {autenticado && <nav className="app-nav" aria-label="Principal">{enlaces}</nav>}

        <div className="app-cuenta">
          <button
            type="button"
            className="app-tema"
            aria-label={tema === 'oscuro' ? 'Cambiar a modo día' : 'Cambiar a modo oscuro'}
            title={tema === 'oscuro' ? 'Modo día' : 'Modo oscuro'}
            onClick={alternarTema}
          >
            <Icono nombre={tema === 'oscuro' ? 'sol' : 'luna'} />
          </button>
          {autenticado ? (
            <>
              <button
                type="button"
                className="app-usuario"
                title="Mi cuenta"
                disabled={bloqueado}
                onClick={() => irA('mi-cuenta')}
              >
                {perfil?.nombre ?? 'Jugador'}
              </button>
              <button type="button" className="app-salir" onClick={salir}>
                <Icono nombre="salir" />
                <span>Salir</span>
              </button>
            </>
          ) : vista !== 'portada' ? (
            <button type="button" className="app-salir" onClick={() => irA('portada')}>
              <Icono nombre="volver" />
              <span>Inicio</span>
            </button>
          ) : (
            <button type="button" className="btn-cta-primary app-entrar" onClick={() => irA('login')}>
              Iniciar sesión
            </button>
          )}
        </div>
      </header>

      {!enLinea && (
        <p className="app-sin-conexion" role="status">
          Sin conexión. Necesitas internet para ver horarios y reservar.
        </p>
      )}

      {/* Verificación en dos pasos: hasta escribir el código no se ve nada más.
          Va antes de recuperar la clave porque Supabase no deja cambiarla sin él. */}
      {necesitaCodigo ? (
        <VerificarCodigo onSalir={salir} />
      ) : debeActivarMfa ? (
        /* El superadmin se la exige: sin activarla no sigue. */
        <ActivarVerificacion onSalir={salir} />
      ) : /* Llegó por el enlace de "olvidé mi contraseña": primero la clave nueva. */ recuperando ? (
        <NuevaClave autenticado={autenticado} onListo={claveCambiada} onPedirOtro={pedirOtroEnlace} />
      ) : SUELTAS.includes(vista) ? (
        <>
          {vista === 'privacidad' && <Privacidad onVolver={() => irA(autenticado ? 'marketplace' : 'portada')} />}
          {vista === 'terminos' && <Terminos onVolver={() => irA(autenticado ? 'marketplace' : 'portada')} />}
          {vista === 'aliados' && <Aliados onIr={(v) => irA(v === 'portada' && autenticado ? 'marketplace' : v)} />}
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
            />
          )}

          {autenticado && vistaPrivada === 'bienvenida' && (
            <Gracias
              lista
              nombre={nombreRegistro || perfil?.nombre}
              onContinuar={continuarTrasRegistro}
            />
          )}

          {autenticado && vistaPrivada === 'admin' && (
            <Suspense fallback={<Cargando tamano="grande" texto="Cargando el panel" />}>
              <PanelAdmin
                nombre={perfil?.nombre}
                sedeId={esSuperadmin ? null : perfil.sede_id}
              />
            </Suspense>
          )}

          {autenticado && vistaPrivada === 'marketplace' && (
            <Marketplace
              soloSedeId={esAdminSede ? perfil.sede_id : null}
              onElegirSede={(slug) => irA(slug)}
            />
          )}

          {autenticado && vistaPrivada === 'mis-reservas' && (
            <TodasMisReservas />
          )}

          {autenticado && vistaPrivada === 'mi-cuenta' && (
            <main className="admin-contenido">
              <Seguridad obligatoria={perfil?.mfa_obligatorio} />
            </main>
          )}

          {autenticado && seccion && (
            <PaginaPartidos
              key={vistaPrivada}
              slug={slugSeccion}
              tipo={seccion}
              onVolver={() => irA('marketplace')}
              onIrSeccion={(s) => irA(s === 'reservar' ? slugSeccion : `${s}/${slugSeccion}`)}
            />
          )}

          {autenticado && !esVistaFija && !seccion && (
            <Sede
              key={vistaPrivada}
              slug={vistaPrivada}
              onVolver={() => irA('marketplace')}
              onIrSeccion={(s) => irA(`${s}/${vistaPrivada}`)}
            />
          )}
        </>
      )}

      <PiePagina onIr={irA} conAliados={!autenticado} />

      {autenticado && !bloqueado && <nav className="app-barra" aria-label="Principal">{enlaces}</nav>}
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Contenido />
    </ToastProvider>
  )
}
