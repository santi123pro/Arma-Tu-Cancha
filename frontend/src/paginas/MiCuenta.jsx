import { useRef, useState } from 'react'
import { actualizarMiPerfil, subirFotoPerfil } from '../lib/datos'
import { useToast } from '../lib/useToast'
import Seguridad from '../componentes/admin/Seguridad'

// "Mi cuenta": el perfil del jugador (foto, estado, tipo de jugador,
// ubicación y privacidad) y la verificación en dos pasos.

const POSICIONES = [
  { valor: 'portero', texto: '🧤 Portero' },
  { valor: 'defensa', texto: '🛡️ Defensa' },
  { valor: 'medio', texto: '🎯 Medio' },
  { valor: 'delantero', texto: '⚽ Delantero' },
]
const NIVELES = [
  { valor: 'recreativo', texto: 'Recreativo' },
  { valor: 'intermedio', texto: 'Intermedio' },
  { valor: 'competitivo', texto: 'Competitivo' },
]
const PIES = [
  { valor: 'derecho', texto: 'Derecho' },
  { valor: 'izquierdo', texto: 'Izquierdo' },
  { valor: 'ambos', texto: 'Ambos' },
]
const ESTADOS = [
  { valor: 'disponible', texto: '🟢 Disponible para jugar' },
  { valor: 'ocupado', texto: '🔴 Ocupado' },
]

function iniciales(nombre) {
  return (nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

// Botones de opción única. Tocar la opción activa la quita (si se puede).
function Opciones({ opciones, valor, onCambio, obligatoria = false }) {
  return (
    <div className="admin-segmentos perfil-opciones">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={valor === o.valor ? 'activo' : ''}
          aria-pressed={valor === o.valor}
          onClick={() => onCambio(valor === o.valor && !obligatoria ? null : o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

function Interruptor({ marcado, onCambio, titulo, detalle }) {
  return (
    <label className="perfil-interruptor">
      <span>
        <strong>{titulo}</strong>
        <small>{detalle}</small>
      </span>
      <input type="checkbox" role="switch" checked={marcado} onChange={(e) => onCambio(e.target.checked)} />
    </label>
  )
}

function datosIniciales(perfil) {
  return {
    nombre: perfil?.nombre ?? '',
    telefono: perfil?.telefono ?? '',
    foto_url: perfil?.foto_url ?? null,
    estado: perfil?.estado ?? 'disponible',
    estado_texto: perfil?.estado_texto ?? '',
    posicion: perfil?.posicion ?? null,
    nivel: perfil?.nivel ?? null,
    pie: perfil?.pie ?? null,
    ubicacion: perfil?.ubicacion ?? '',
    mostrar_telefono: perfil?.mostrar_telefono ?? true,
    mostrar_foto: perfil?.mostrar_foto ?? true,
    mostrar_ubicacion: perfil?.mostrar_ubicacion ?? false,
  }
}

export default function MiCuenta({ perfil }) {
  const toast = useToast()
  const [datos, setDatos] = useState(() => datosIniciales(perfil))
  const [guardado, setGuardado] = useState(() => datosIniciales(perfil))
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const selector = useRef(null)

  const cambiado = JSON.stringify(datos) !== JSON.stringify(guardado)
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }))

  async function elegirFoto(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setSubiendo(true)
    const { datos: url, error } = await subirFotoPerfil(archivo)
    if (error) {
      setSubiendo(false)
      return toast(error, 'error')
    }
    // La foto se guarda de una: ya está subida y la vieja se borró.
    const { error: errorGuardar } = await actualizarMiPerfil({ foto_url: url })
    setSubiendo(false)
    if (errorGuardar) return toast(errorGuardar, 'error')
    setDatos((d) => ({ ...d, foto_url: url }))
    setGuardado((g) => ({ ...g, foto_url: url }))
    toast('Foto actualizada. 📸')
  }

  async function quitarFoto() {
    setSubiendo(true)
    const { error } = await actualizarMiPerfil({ foto_url: null })
    setSubiendo(false)
    if (error) return toast(error, 'error')
    setDatos((d) => ({ ...d, foto_url: null }))
    setGuardado((g) => ({ ...g, foto_url: null }))
  }

  async function guardar(e) {
    e.preventDefault()
    if (guardando) return
    if (!datos.nombre.trim()) return toast('Escribe tu nombre.', 'error')

    setGuardando(true)
    const { datos: nuevo, error } = await actualizarMiPerfil({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      estado: datos.estado,
      estado_texto: datos.estado_texto.trim() || null,
      posicion: datos.posicion,
      nivel: datos.nivel,
      pie: datos.pie,
      ubicacion: datos.ubicacion.trim() || null,
      mostrar_telefono: datos.mostrar_telefono,
      mostrar_foto: datos.mostrar_foto,
      mostrar_ubicacion: datos.mostrar_ubicacion,
    })
    setGuardando(false)
    if (error) return toast(error, 'error')
    const limpio = datosIniciales(nuevo)
    setDatos(limpio)
    setGuardado(limpio)
    toast('Perfil guardado.')
  }

  return (
    <main className="admin-contenido mi-cuenta">
      <form onSubmit={guardar} className="mi-cuenta-form">
        <section className="admin-tarjeta perfil-cabeza">
          <button
            type="button"
            className="perfil-foto"
            onClick={() => selector.current?.click()}
            disabled={subiendo}
            aria-label="Cambiar foto de perfil"
          >
            {datos.foto_url ? <img src={datos.foto_url} alt="" referrerPolicy="no-referrer" /> : <span>{iniciales(datos.nombre)}</span>}
            <small>{subiendo ? 'Subiendo…' : '📷 Cambiar'}</small>
          </button>
          <input ref={selector} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={elegirFoto} />

          <div className="perfil-cabeza-datos">
            <label className="login-campo">
              <span>Nombre</span>
              <input
                className="input-moderno"
                required
                maxLength={80}
                autoComplete="name"
                value={datos.nombre}
                onChange={(e) => cambiar('nombre')(e.target.value)}
              />
            </label>
            <label className="login-campo">
              <span>Celular</span>
              <input
                className="input-moderno"
                type="tel"
                autoComplete="tel"
                value={datos.telefono}
                onChange={(e) => cambiar('telefono')(e.target.value)}
                placeholder="300 000 0000"
              />
            </label>
            {datos.foto_url && (
              <button type="button" className="login-link" onClick={quitarFoto} disabled={subiendo}>
                Quitar foto
              </button>
            )}
          </div>
        </section>

        <section className="admin-tarjeta">
          <header>
            <h3>💬 Estado</h3>
            <p>Lo ven los jugadores de tus partidos.</p>
          </header>
          <Opciones opciones={ESTADOS} valor={datos.estado} onCambio={cambiar('estado')} obligatoria />
          <label className="login-campo">
            <span>Mensaje (opcional)</span>
            <input
              className="input-moderno"
              maxLength={80}
              value={datos.estado_texto}
              onChange={(e) => cambiar('estado_texto')(e.target.value)}
              placeholder={datos.estado === 'ocupado' ? 'Ej.: En el trabajo hasta las 6' : 'Ej.: Libre los fines de semana'}
            />
          </label>
        </section>

        <section className="admin-tarjeta">
          <header>
            <h3>⚽ Tipo de jugador</h3>
            <p>Ayuda a quien arma el partido a cuadrar los equipos.</p>
          </header>
          <p className="perfil-etiqueta">Posición</p>
          <Opciones opciones={POSICIONES} valor={datos.posicion} onCambio={cambiar('posicion')} />
          <p className="perfil-etiqueta">Nivel</p>
          <Opciones opciones={NIVELES} valor={datos.nivel} onCambio={cambiar('nivel')} />
          <p className="perfil-etiqueta">Pie hábil</p>
          <Opciones opciones={PIES} valor={datos.pie} onCambio={cambiar('pie')} />
        </section>

        <section className="admin-tarjeta">
          <header>
            <h3>📍 Ubicación</h3>
            <p>Tu barrio o tu dirección, como prefieras.</p>
          </header>
          <label className="login-campo">
            <span>Barrio o dirección</span>
            <input
              className="input-moderno"
              maxLength={150}
              autoComplete="street-address"
              value={datos.ubicacion}
              onChange={(e) => cambiar('ubicacion')(e.target.value)}
              placeholder="Ej.: San Fernando o Calle 5 # 38-20"
            />
          </label>
        </section>

        <section className="admin-tarjeta">
          <header>
            <h3>🔒 Privacidad</h3>
            <p>Qué ven de ti los jugadores y organizadores de tus partidos.</p>
          </header>
          <Interruptor
            titulo="Mi celular"
            detalle="Para que te escriban por WhatsApp o te llamen."
            marcado={datos.mostrar_telefono}
            onCambio={cambiar('mostrar_telefono')}
          />
          <Interruptor
            titulo="Mi foto"
            detalle="Si la ocultas, verán tus iniciales."
            marcado={datos.mostrar_foto}
            onCambio={cambiar('mostrar_foto')}
          />
          <Interruptor
            titulo="Mi ubicación"
            detalle="Tu barrio o dirección."
            marcado={datos.mostrar_ubicacion}
            onCambio={cambiar('mostrar_ubicacion')}
          />
        </section>

        <div className="mi-cuenta-guardar">
          <button type="submit" className="btn-cta-primary" disabled={!cambiado || guardando}>
            {guardando ? 'Guardando…' : cambiado ? 'Guardar cambios' : 'Todo guardado'}
          </button>
        </div>
      </form>

      <Seguridad obligatoria={perfil?.mfa_obligatorio} />
    </main>
  )
}
