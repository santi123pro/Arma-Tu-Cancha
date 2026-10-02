import { useEffect, useState } from 'react'
import { actualizarSolicitudSede, listarSolicitudesSede } from '../../lib/datos'
import { useToast } from '../Toast'
import Cargando from '../Cargando'

// Solicitudes de "Trabaja con nosotros" (migración 0012). Solo el
// superadmin las ve: RLS no le devuelve nada a nadie más.

const ESTADOS = {
  nueva: { texto: 'Nueva', clase: 'estado-abierto' },
  contactada: { texto: 'Contactada', clase: 'estado-cerrado' },
  aprobada: { texto: 'Aprobada', clase: 'estado-curso' },
  descartada: { texto: 'Descartada', clase: 'estado-fin' },
}

function fecha(valor) {
  return new Date(valor).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function Solicitud({ s, onCambio }) {
  const toast = useToast()
  const [estado, setEstado] = useState(s.estado)
  const [notas, setNotas] = useState(s.notas_admin ?? '')
  const [guardando, setGuardando] = useState(false)
  const cambiado = estado !== s.estado || notas !== (s.notas_admin ?? '')
  const whatsapp = s.telefono.replace(/\D/g, '')

  async function guardar() {
    setGuardando(true)
    const { error } = await actualizarSolicitudSede(s.id, { estado, notas_admin: notas.trim() || null })
    setGuardando(false)
    if (error) return toast(error, 'error')
    toast('Solicitud actualizada.')
    onCambio()
  }

  return (
    <article className="admin-tarjeta solicitud">
      <header className="solicitud-cabeza">
        <div>
          <h3>{s.establecimiento}</h3>
          <p>{s.ciudad} · {fecha(s.creado_at)}</p>
        </div>
        <span className={'torneo-estado ' + ESTADOS[s.estado].clase}>{ESTADOS[s.estado].texto}</span>
      </header>

      <dl className="solicitud-datos">
        <dt>Contacto</dt><dd>{s.contacto_nombre}{s.contacto_cargo && ` · ${s.contacto_cargo}`}</dd>
        <dt>Correo</dt><dd><a href={`mailto:${s.correo}`}>{s.correo}</a></dd>
        <dt>Celular</dt>
        <dd><a href={`https://wa.me/${whatsapp.length === 10 ? '57' + whatsapp : whatsapp}`} target="_blank" rel="noreferrer">{s.telefono}</a></dd>
        <dt>Dirección</dt><dd>{s.direccion}</dd>
        <dt>Canchas</dt><dd>{s.num_canchas}{s.tipos_cancha && ` · ${s.tipos_cancha}`}</dd>
        {s.hora_apertura && <><dt>Horario</dt><dd>{s.hora_apertura.slice(0, 5)} – {s.hora_cierre?.slice(0, 5)}</dd></>}
        {s.razon_social && <><dt>Razón social</dt><dd>{s.razon_social}</dd></>}
        {s.nit && <><dt>NIT</dt><dd>{s.nit}</dd></>}
        {s.mensaje && <><dt>Mensaje</dt><dd className="solicitud-mensaje">{s.mensaje}</dd></>}
      </dl>

      <div className="solicitud-seguimiento">
        <select className="input-moderno admin-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
          {Object.entries(ESTADOS).map(([v, e]) => <option key={v} value={v}>{e.texto}</option>)}
        </select>
        <input
          className="input-moderno" value={notas} onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas internas (solo las ve el administrador)"
        />
        <button type="button" className="btn-cta-primary btn-chico" onClick={guardar} disabled={!cambiado || guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </article>
  )
}

export default function Solicitudes() {
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('pendientes')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    listarSolicitudesSede().then(({ datos, error }) => {
      if (!vigente) return
      setError(error ?? null)
      setLista(datos ?? [])
      setCargando(false)
    })
    return () => { vigente = false }
  }, [recarga])

  if (cargando) return <Cargando texto="Cargando solicitudes" />
  if (error) return <p className="partidos-aviso partidos-error">{error}</p>

  const pendientes = lista.filter((s) => s.estado === 'nueva' || s.estado === 'contactada')
  const visibles = filtro === 'pendientes' ? pendientes : lista

  return (
    <>
      <div className="admin-filtros">
        <span>Mostrar</span>
        <div className="admin-segmentos">
          <button type="button" className={filtro === 'pendientes' ? 'activo' : ''} onClick={() => setFiltro('pendientes')}>
            Pendientes ({pendientes.length})
          </button>
          <button type="button" className={filtro === 'todas' ? 'activo' : ''} onClick={() => setFiltro('todas')}>
            Todas ({lista.length})
          </button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="viz-vacio">
          {lista.length === 0
            ? 'Todavía no han llegado solicitudes. Llegan desde el formulario "Trabaja con nosotros".'
            : 'No hay solicitudes pendientes.'}
        </p>
      ) : (
        <div className="solicitudes-lista">
          {visibles.map((s) => <Solicitud key={s.id} s={s} onCambio={() => setRecarga((n) => n + 1)} />)}
        </div>
      )}
    </>
  )
}
