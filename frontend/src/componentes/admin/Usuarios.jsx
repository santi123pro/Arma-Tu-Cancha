import { useEffect, useState } from 'react'
import {
  adminCambiarRol, adminCrearUsuario, adminEliminarUsuario, adminListarUsuarios, listarSedes,
} from '../../lib/datos'
import { useSesion } from '../../lib/useSesion'
import { useToast } from '../Toast'
import Cargando from '../Cargando'

const ROLES = [
  { valor: 'jugador', texto: 'Jugador' },
  { valor: 'admin_sede', texto: 'Admin de sede' },
  { valor: 'superadmin', texto: 'Superadmin' },
]

const FORM_VACIO = { nombre: '', correo: '', telefono: '', clave: '', rol: 'jugador', sedeId: '' }

function iniciales(nombre) {
  return (nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function fecha(valor) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function FormNuevo({ sedes, onCreado, onCancelar }) {
  const toast = useToast()
  const [form, setForm] = useState(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function cambiar(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function crear(e) {
    e.preventDefault()
    if (enviando) return
    setError(null)
    if (form.rol === 'admin_sede' && !form.sedeId) return setError('Elige la sede que va a administrar.')

    setEnviando(true)
    const { error } = await adminCrearUsuario({
      correo: form.correo,
      clave: form.clave,
      nombre: form.nombre,
      telefono: form.telefono.trim() || null,
      rol: form.rol,
      sedeId: form.rol === 'admin_sede' ? Number(form.sedeId) : null,
    })
    setEnviando(false)

    if (error) {
      setError(error)
      return
    }
    toast(`Usuario ${form.correo} creado`)
    onCreado()
  }

  return (
    <form className="admin-nuevo form-partido" onSubmit={crear} noValidate>
      <label>
        Nombre completo
        <input className="input-moderno" required value={form.nombre} onChange={cambiar('nombre')} placeholder="Juan Pérez" />
      </label>
      <label>
        Correo
        <input className="input-moderno" type="email" required value={form.correo} onChange={cambiar('correo')} placeholder="correo@ejemplo.com" />
      </label>
      <label>
        Teléfono
        <input className="input-moderno" type="tel" value={form.telefono} onChange={cambiar('telefono')} placeholder="Opcional" />
      </label>
      <label>
        Contraseña
        <input className="input-moderno" type="text" required minLength={8} value={form.clave} onChange={cambiar('clave')} placeholder="Mínimo 8 caracteres" />
      </label>
      <label>
        Rol
        <select className="input-moderno" value={form.rol} onChange={cambiar('rol')}>
          {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
        </select>
      </label>
      <label>
        Sede que administra
        <select
          className="input-moderno" value={form.sedeId} onChange={cambiar('sedeId')}
          disabled={form.rol !== 'admin_sede'}
        >
          <option value="">{form.rol === 'admin_sede' ? 'Elige una sede' : 'No aplica'}</option>
          {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </label>

      {error && <p className="form-partido-completo partidos-error" role="alert">{error}</p>}

      <div className="form-partido-completo admin-nuevo-botones">
        <button type="button" className="btn-torneo-cancelar" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn-cta-primary" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </form>
  )
}

function FilaUsuario({ u, sedes, esYo, onCambio }) {
  const toast = useToast()
  const [rol, setRol] = useState(u.rol)
  const [sedeId, setSedeId] = useState(u.sede_id ?? '')
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const cambiado = rol !== u.rol || (rol === 'admin_sede' && String(sedeId) !== String(u.sede_id ?? ''))

  async function guardar() {
    if (rol === 'admin_sede' && !sedeId) {
      toast('Elige la sede que va a administrar', 'error')
      return
    }
    setGuardando(true)
    const { error } = await adminCambiarRol(u.id, rol, rol === 'admin_sede' ? Number(sedeId) : null)
    setGuardando(false)
    if (error) {
      toast(error, 'error')
      return
    }
    toast(`Rol de ${u.nombre} actualizado`)
    onCambio()
  }

  async function eliminar() {
    setGuardando(true)
    const { error } = await adminEliminarUsuario(u.id)
    setGuardando(false)
    if (error) {
      toast(error, 'error')
      setConfirmar(false)
      return
    }
    toast(`${u.nombre} fue eliminado`)
    onCambio()
  }

  return (
    <tr className={confirmar ? 'admin-fila-peligro' : ''}>
      <td>
        <div className="admin-usuario">
          <span className={'admin-avatar rol-' + u.rol}>{iniciales(u.nombre)}</span>
          <span>
            <strong>{u.nombre}{esYo && <em className="admin-yo">Tú</em>}</strong>
            <small>{u.correo}</small>
          </span>
        </div>
      </td>
      <td>
        <select className="input-moderno admin-select" value={rol} disabled={esYo} onChange={(e) => setRol(e.target.value)}>
          {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
        </select>
        {rol === 'admin_sede' && (
          <select className="input-moderno admin-select" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Elige sede</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
      </td>
      <td className="admin-oculto-movil">{u.telefono ?? '—'}</td>
      <td className="admin-oculto-movil">{fecha(u.creado_at)}</td>
      <td className="admin-oculto-movil">{fecha(u.ultimo_ingreso)}</td>
      <td className="admin-acciones">
        {confirmar ? (
          <>
            <span className="admin-pregunta">¿Eliminar?</span>
            <button type="button" className="btn-peligro" disabled={guardando} onClick={eliminar}>Sí</button>
            <button type="button" className="btn-torneo-cancelar" onClick={() => setConfirmar(false)}>No</button>
          </>
        ) : (
          <>
            {cambiado && (
              <button type="button" className="btn-cta-primary btn-chico" disabled={guardando} onClick={guardar}>
                Guardar
              </button>
            )}
            {!esYo && (
              <button type="button" className="btn-icono-peligro" title="Eliminar usuario" onClick={() => setConfirmar(true)}>
                🗑
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  )
}

export default function Usuarios() {
  const { usuario } = useSesion()
  const [usuarios, setUsuarios] = useState([])
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    let vigente = true
    Promise.all([adminListarUsuarios(), listarSedes()]).then(([u, s]) => {
      if (!vigente) return
      setError(u.error ?? null)
      setUsuarios(u.datos ?? [])
      setSedes(s.datos ?? [])
      setCargando(false)
    })
    return () => { vigente = false }
  }, [recarga])

  function recargar() {
    setRecarga((n) => n + 1)
  }

  const texto = busqueda.trim().toLowerCase()
  const visibles = usuarios.filter((u) =>
    (filtroRol === 'todos' || u.rol === filtroRol) &&
    (!texto || u.nombre?.toLowerCase().includes(texto) || u.correo?.toLowerCase().includes(texto))
  )

  return (
    <div className="admin-tarjeta admin-tarjeta-ancha">
      <div className="admin-usuarios-barra">
        <input
          className="input-moderno admin-buscar"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar por nombre o correo"
        />
        <div className="admin-segmentos">
          {[{ valor: 'todos', texto: 'Todos' }, ...ROLES].map((r) => (
            <button
              key={r.valor} type="button"
              className={filtroRol === r.valor ? 'activo' : ''}
              onClick={() => setFiltroRol(r.valor)}
            >
              {r.texto}
            </button>
          ))}
        </div>
        {!creando && (
          <button type="button" className="btn-cta-primary" onClick={() => setCreando(true)}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {creando && (
        <FormNuevo
          sedes={sedes}
          onCancelar={() => setCreando(false)}
          onCreado={() => { setCreando(false); recargar() }}
        />
      )}

      {cargando ? (
        <Cargando texto="Cargando usuarios" />
      ) : error ? (
        <p className="partidos-aviso partidos-error">{error}</p>
      ) : (
        <div className="admin-tabla-scroll">
          <table className="admin-tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th className="admin-oculto-movil">Teléfono</th>
                <th className="admin-oculto-movil">Registro</th>
                <th className="admin-oculto-movil">Último ingreso</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((u) => (
                <FilaUsuario
                  key={u.id + u.rol + (u.sede_id ?? '')}
                  u={u}
                  sedes={sedes}
                  esYo={u.id === usuario?.id}
                  onCambio={recargar}
                />
              ))}
            </tbody>
          </table>
          {!visibles.length && <p className="viz-vacio">Ningún usuario coincide con la búsqueda.</p>}
          <p className="admin-pie-tabla">{visibles.length} de {usuarios.length} usuarios</p>
        </div>
      )}
    </div>
  )
}
