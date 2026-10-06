import { useEffect, useState } from 'react'
import {
  configurarPagoSede, listarSedes, pagosSede, revisarPago, subirQrSede, urlComprobante,
} from '../../lib/datos'
import { formatoNumero, formatoPesos } from '../../lib/formato'
import { MEDIOS_PAGO, MINUTOS_PARA_CONFIRMAR, MINUTOS_PARA_PAGAR, qrGenerico } from '../../lib/qrGenerico'
import { formatoRestante, useCuentaRegresiva } from '../../lib/useCuentaRegresiva'
import { useToast } from '../Toast'
import { Persona } from '../ContactosPartido'
import Cargando from '../Cargando'
import { Cifra } from './Graficas'

// Con qué llegó el dinero, si la sede aprueba sin comprobante.
const METODOS = [
  { valor: 'nequi', texto: 'Nequi' },
  { valor: 'breb', texto: 'Bre-B' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'efectivo', texto: 'Efectivo' },
]
const NOMBRE_METODO = { ...Object.fromEntries(METODOS.map((m) => [m.valor, m.texto])), daviplata: 'Daviplata' }
const MAX_QR = 2 * 1024 * 1024

// '2026-10-03' → 'Sábado 3 de octubre'
function fechaLarga(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  const texto = new Date(a, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function hora12(hora) {
  const [h, m] = hora.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function momento(valor) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function MedioChip({ medio }) {
  if (!medio) return null
  return <span className={`medio-chip medio-${medio}`}>{NOMBRE_METODO[medio] ?? medio}</span>
}

// Miniatura del comprobante (bucket privado: enlace firmado). Un PDF se
// abre en otra pestaña.
function Comprobante({ ruta }) {
  const toast = useToast()
  const esPdf = /\.pdf$/i.test(ruta)
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (esPdf) return
    let vigente = true
    urlComprobante(ruta).then(({ datos }) => { if (vigente) setUrl(datos) })
    return () => { vigente = false }
  }, [ruta, esPdf])

  async function abrir() {
    // La ventana se abre antes de pedir el enlace: si se abre después de
    // un await, el navegador la bloquea como ventana emergente.
    const ventana = window.open('', '_blank')
    const { datos, error } = await urlComprobante(ruta)
    if (error) {
      ventana?.close()
      toast(error, 'error')
      return
    }
    if (ventana) ventana.location.href = datos
    else window.location.href = datos
  }

  return (
    <button type="button" className="confirmar-comprobante" onClick={abrir} title="Abrir el comprobante completo">
      {esPdf ? (
        <span className="confirmar-comprobante-pdf">📄 PDF</span>
      ) : url ? (
        <img src={url} alt="Comprobante de pago" />
      ) : (
        <span className="confirmar-comprobante-pdf">Cargando…</span>
      )}
      <small>🔍 Ver comprobante</small>
    </button>
  )
}

function Plazo({ vence }) {
  const restante = useCuentaRegresiva(vence)
  if (restante == null) return null
  return restante === 0
    ? <span className="pago-plazo vencido">Plazo vencido</span>
    : <span className={'pago-plazo' + (restante < 180 ? ' urgente' : '')}>El jugador tiene {formatoRestante(restante)}</span>
}

// Momento límite para que la sede confirme un comprobante.
const limiteConfirmar = (r) =>
  new Date(new Date(r.pago_reportado_at).getTime() + MINUTOS_PARA_CONFIRMAR * 60000)

// Cuánto le queda a la sede para confirmar. Pasado el plazo la reserva
// no se cancela (el jugador ya pagó): se marca como atrasada.
function PlazoConfirmar({ r }) {
  const limite = limiteConfirmar(r)
  const restante = useCuentaRegresiva(limite)
  if (restante == null) return null
  if (restante === 0) {
    return <span className="pago-plazo vencido">⚠️ Atrasada desde {momento(limite)}</span>
  }
  return (
    <span className={'pago-plazo reportado' + (restante < 600 ? ' urgente' : '')}>
      Confirma en {formatoRestante(restante)}
    </span>
  )
}

// Una reserva con su pago. Las de 'por_verificar' y 'esperando_pago' traen
// las acciones de aprobar y rechazar; las revisadas solo se muestran.
function SolicitudPago({ r, sedeNombre, onCambio }) {
  const toast = useToast()
  const [metodo, setMetodo] = useState(r.pago_medio ?? 'nequi')
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const reportado = r.pago_estado === 'por_verificar'
  const pendiente = reportado || r.pago_estado === 'esperando_pago'
  const atrasada = useCuentaRegresiva(reportado ? limiteConfirmar(r) : null) === 0

  async function decidir(aprobar) {
    if (enviando) return
    if (!aprobar && !motivo.trim()) {
      toast('Escribe el motivo del rechazo para que el jugador sepa qué pasó.', 'error')
      return
    }
    setEnviando(true)
    const { error } = await revisarPago(r.id, aprobar, {
      metodo: reportado ? null : metodo,
      motivo: motivo.trim() || null,
    })
    setEnviando(false)
    if (error) {
      toast(error, 'error')
      return
    }
    toast(aprobar ? `Pago aprobado. La reserva ${r.codigo} quedó confirmada.` : `Pago rechazado. El horario de ${r.codigo} quedó libre.`)
    onCambio()
  }

  return (
    <article className={`confirmar-tarjeta pago-${r.pago_estado}` + (atrasada ? ' atrasada' : '')}>
      <header className="confirmar-tarjeta-cabeza">
        <div>
          <span className="confirmar-codigo">{r.codigo}</span>
          <strong className="confirmar-monto">{formatoPesos(r.precio_total)}</strong>
        </div>
        {reportado ? (
          <PlazoConfirmar r={r} />
        ) : r.pago_estado === 'esperando_pago' ? (
          <Plazo vence={r.pago_vence_at} />
        ) : r.pago_estado === 'aprobado' ? (
          <span className="admin-estado estado-abierto">Aprobada {momento(r.pago_revisado_at)}</span>
        ) : (
          <span className="admin-estado estado-cancelado">Rechazada {momento(r.pago_revisado_at)}</span>
        )}
      </header>

      <div className="confirmar-tarjeta-cuerpo">
        <div className="confirmar-bloque confirmar-jugador">
          <span className="confirmar-etiqueta">Jugador</span>
          <ul className="contactos-lista">
            <Persona
              contacto={{ nombre: r.cliente, telefono: r.telefono, correo: r.correo }}
              mensaje={`Hola, ${r.cliente}. Te escribimos de ${sedeNombre} por tu reserva ${r.codigo} del ${fechaLarga(r.fecha).toLowerCase()} a las ${hora12(r.hora_inicio)}.`}
            />
          </ul>
        </div>

        <div className="confirmar-bloque">
          <span className="confirmar-etiqueta">Reserva</span>
          <dl className="confirmar-datos">
            <dt>Cancha</dt><dd>{r.cancha}{r.cancha_tipo && ` · ${r.cancha_tipo}`}</dd>
            <dt>Fecha</dt><dd>{fechaLarga(r.fecha)}</dd>
            <dt>Horario</dt><dd>{hora12(r.hora_inicio)} – {hora12(r.hora_fin)}</dd>
            <dt>Pagó con</dt>
            <dd>
              {r.pago_medio || r.metodo_pago
                ? <MedioChip medio={r.pago_medio ?? r.metodo_pago} />
                : <span className="confirmar-tenue">Aún no paga</span>}
            </dd>
            {r.pago_referencia && (<><dt>Referencia</dt><dd>{r.pago_referencia}</dd></>)}
            {r.pago_reportado_at && (<><dt>Enviado</dt><dd>{momento(r.pago_reportado_at)}</dd></>)}
          </dl>
        </div>

        {r.comprobante_path ? (
          <Comprobante ruta={r.comprobante_path} />
        ) : pendiente ? (
          <p className="confirmar-sin-comprobante">
            El jugador todavía no envía el comprobante. Si el dinero ya llegó a tu cuenta, puedes aprobarlo igual.
          </p>
        ) : null}
      </div>

      {r.pago_estado === 'rechazado' && r.pago_motivo_rechazo && (
        <p className="confirmar-motivo">Motivo: {r.pago_motivo_rechazo}</p>
      )}

      {pendiente && (rechazando ? (
        <div className="pago-rechazo">
          <label>
            Motivo del rechazo (lo verá el jugador)
            <textarea
              className="input-moderno"
              rows={2}
              maxLength={300}
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: No recibimos el pago por ese valor."
            />
          </label>
          <div className="pago-acciones">
            <button type="button" className="btn-torneo-cancelar" onClick={() => setRechazando(false)} disabled={enviando}>
              Volver
            </button>
            <button type="button" className="btn-peligro" onClick={() => decidir(false)} disabled={enviando}>
              {enviando ? 'Rechazando…' : 'Rechazar y liberar el horario'}
            </button>
          </div>
        </div>
      ) : (
        <div className="pago-acciones">
          {!reportado && (
            <select
              className="input-moderno pago-metodo"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              aria-label="Medio por el que llegó el pago"
            >
              {METODOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
            </select>
          )}
          <button type="button" className="btn-torneo-cancelar" onClick={() => setRechazando(true)} disabled={enviando}>
            ✕ Rechazar
          </button>
          <button type="button" className="btn-cta-primary" onClick={() => decidir(true)} disabled={enviando}>
            {enviando ? 'Aprobando…' : '✓ Aprobar pago'}
          </button>
        </div>
      ))}
    </article>
  )
}

function MedioConfig({ sedeId, medio, valor, onCambio }) {
  const toast = useToast()
  const info = MEDIOS_PAGO[medio]
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const cambiar = (campo) => (e) =>
    onCambio({ ...valor, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function elegirQr(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setError(null)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      setError('El QR debe ser una imagen PNG, JPG o WEBP.')
      return
    }
    if (archivo.size > MAX_QR) {
      setError('La imagen del QR pesa más de 2 MB.')
      return
    }
    setSubiendo(true)
    const { datos, error } = await subirQrSede(sedeId, archivo)
    setSubiendo(false)
    if (error) {
      setError(error)
      return
    }
    onCambio({ ...valor, qr_url: datos })
    toast(`QR de ${info.nombre} cargado. Guarda los cambios para publicarlo.`)
  }

  return (
    <fieldset className={`medio-config medio-${medio}` + (valor.activo ? '' : ' inactivo')}>
      <legend>
        <span className="pasarela-medio-logo" aria-hidden="true">{medio === 'nequi' ? 'N' : 'B'}</span>
        {info.nombre}
        <label className="interruptor">
          <input type="checkbox" checked={valor.activo} onChange={cambiar('activo')} />
          <span aria-hidden="true" />
          {valor.activo ? 'Activo' : 'Inactivo'}
        </label>
      </legend>

      <div className="medio-config-qr">
        <span className="medio-config-qr-imagen">
          <img src={valor.qr_url || qrGenerico(info.semilla)} alt={`QR de ${info.nombre}`} />
          {!valor.qr_url && <span className="pasarela-qr-ejemplo">QR de ejemplo</span>}
        </span>
        <div className="medio-config-qr-botones">
          <label className="pago-archivo">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={elegirQr} disabled={subiendo} />
            <span className="pago-archivo-boton">{subiendo ? 'Subiendo…' : valor.qr_url ? 'Cambiar QR' : 'Subir QR'}</span>
          </label>
          {valor.qr_url && (
            <button type="button" className="pago-quitar-qr" onClick={() => onCambio({ ...valor, qr_url: '' })}>
              Quitar QR
            </button>
          )}
        </div>
      </div>

      <label>
        {info.cuenta}
        <input className="input-moderno" maxLength={80} value={valor.cuenta} onChange={cambiar('cuenta')} placeholder={info.placeholder} />
        <small>{info.ayudaCuenta}</small>
      </label>
      <label>
        Titular
        <input className="input-moderno" maxLength={120} value={valor.titular} onChange={cambiar('titular')} placeholder="Nombre o razón social" />
      </label>
      {error && <p className="partidos-error" role="alert">{error}</p>}
    </fieldset>
  )
}

function ConfiguracionPago({ sede, metodos, onGuardado }) {
  const toast = useToast()
  const inicial = (tipo) => {
    const m = metodos.find((x) => x.tipo === tipo)
    return { tipo, activo: m?.activo ?? false, qr_url: m?.qr_url ?? '', titular: m?.titular ?? '', cuenta: m?.cuenta ?? '' }
  }
  const [medios, setMedios] = useState(() => ({ nequi: inicial('nequi'), breb: inicial('breb') }))
  const [instrucciones, setInstrucciones] = useState(sede.pago_instrucciones ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function guardar(e) {
    e.preventDefault()
    if (guardando) return
    setError(null)
    const lista = Object.values(medios)
    if (!lista.some((m) => m.activo)) {
      setError('Deja activo al menos un medio de pago: sin él los jugadores no pueden reservar.')
      return
    }
    const sinCuenta = lista.find((m) => m.activo && !m.cuenta.trim())
    if (sinCuenta) {
      setError(`Escribe el ${MEDIOS_PAGO[sinCuenta.tipo].cuenta.toLowerCase()} para activar ${MEDIOS_PAGO[sinCuenta.tipo].nombre}.`)
      return
    }
    setGuardando(true)
    const { error } = await configurarPagoSede(sede.id, { metodos: lista, instrucciones, minutos: MINUTOS_PARA_PAGAR })
    setGuardando(false)
    if (error) {
      setError(error)
      return
    }
    toast('Medios de pago guardados. Los jugadores ya los ven al reservar.')
    onGuardado()
  }

  return (
    <form className="pago-config-medios" onSubmit={guardar} noValidate>
      <div className="medios-config-rejilla">
        {['nequi', 'breb'].map((tipo) => (
          <MedioConfig
            key={tipo}
            sedeId={sede.id}
            medio={tipo}
            valor={medios[tipo]}
            onCambio={(v) => setMedios((ms) => ({ ...ms, [tipo]: v }))}
          />
        ))}
      </div>

      <div className="form-partido pago-config-campos">
        <p className="form-partido-completo pago-tiempos">
          ⏱ El jugador tiene <strong>{MINUTOS_PARA_PAGAR} minutos</strong> para pagar y enviar el comprobante; si no lo
          hace, la reserva se cancela sola. Tú tienes <strong>{MINUTOS_PARA_CONFIRMAR} minutos</strong> para confirmar
          cada comprobante.
        </p>
        <label className="form-partido-completo">
          Instrucciones para el jugador (opcional)
          <textarea
            className="input-moderno"
            rows={2}
            maxLength={400}
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            placeholder="Ej.: Escribe el código de la reserva en la descripción del pago."
          />
        </label>
        {error && <p className="form-partido-completo partidos-error" role="alert">{error}</p>}
        <button type="submit" className="btn-cta-primary form-partido-completo" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar medios de pago'}
        </button>
      </div>
    </form>
  )
}

// Pestaña "Confirmar reservas". Con sedeId (admin de sede) muestra la
// suya; sin sedeId (superadmin) deja elegir la sede.
export default function ConfirmarReservas({ sedeId = null }) {
  const [sedes, setSedes] = useState([])
  const [elegida, setElegida] = useState(null)
  const [estado, setEstado] = useState({ clave: null, datos: null, error: null })
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (sedeId) return
    let vigente = true
    listarSedes().then(({ datos }) => {
      if (!vigente) return
      setSedes(datos ?? [])
      setElegida((e) => e ?? datos?.[0]?.id ?? null)
    })
    return () => { vigente = false }
  }, [sedeId])

  const sedeActiva = sedeId ?? elegida
  const clave = sedeActiva ? `${sedeActiva}|${recarga}` : null

  useEffect(() => {
    if (!clave) return
    let vigente = true
    pagosSede(sedeId ? null : sedeActiva).then(({ datos, error }) => {
      if (vigente) setEstado({ clave, datos, error })
    })
    return () => { vigente = false }
  }, [clave, sedeId, sedeActiva])

  // Los comprobantes llegan mientras el panel está abierto: se revisa cada 30 segundos.
  useEffect(() => {
    const reloj = setInterval(() => setRecarga((n) => n + 1), 30000)
    return () => clearInterval(reloj)
  }, [])

  const recargar = () => setRecarga((n) => n + 1)
  const { datos, error } = estado

  return (
    <>
      <div className="admin-filtros-barra">
        {!sedeId && sedes.length > 0 && (
          <div className="admin-filtros">
            <span>Sede</span>
            <div className="admin-segmentos">
              {sedes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={elegida === s.id ? 'activo' : ''}
                  onClick={() => { setElegida(s.id); setEstado({ clave: null, datos: null, error: null }) }}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="button" className="btn-torneo-cancelar pago-actualizar" onClick={recargar}>
          ↻ Actualizar
        </button>
      </div>

      {error ? (
        <p className="partidos-aviso partidos-error">{error}</p>
      ) : !datos ? (
        <Cargando texto="Cargando reservas por confirmar" />
      ) : (
        <Contenido datos={datos} onCambio={recargar} />
      )}
    </>
  )
}

const SECCIONES = [
  { id: 'por_verificar', icono: '🧾', texto: 'Por verificar' },
  { id: 'esperando_pago', icono: '⏳', texto: 'Esperando pago' },
  { id: 'aprobadas', icono: '✅', texto: 'Aprobadas' },
]

const VACIO = {
  por_verificar: 'No hay comprobantes pendientes de revisión. 🎉',
  esperando_pago: 'No hay horarios apartados esperando pago.',
  aprobadas: 'Todavía no has aprobado pagos en los últimos 30 días.',
}

const AYUDA = {
  por_verificar: `El jugador ya pagó y cargó el comprobante. Revisa en tu cuenta que el dinero llegó y aprueba: tienes ${MINUTOS_PARA_CONFIRMAR} minutos por reserva. Al aprobar, al jugador le sale "Reserva confirmada".`,
  esperando_pago: `Reservas recién hechas, aún sin comprobante. El jugador tiene ${MINUTOS_PARA_PAGAR} minutos para pagar; si no, se cancelan solas y el horario se libera.`,
  aprobadas: 'Pagos aprobados y rechazados de los últimos 30 días.',
}

function Contenido({ datos, onCambio }) {
  const { sede, metodos, por_verificar: porVerificar, esperando_pago: esperando, revisados } = datos
  const [seccion, setSeccion] = useState(porVerificar.length || !esperando.length ? 'por_verificar' : 'esperando_pago')
  const aprobadas = revisados.filter((r) => r.pago_estado === 'aprobado')
  const rechazadas = revisados.filter((r) => r.pago_estado === 'rechazado')
  const listas = { por_verificar: porVerificar, esperando_pago: esperando, aprobadas }
  const lista = listas[seccion] ?? []
  const activos = metodos.filter((m) => m.activo)
  const incompletos = activos.filter((m) => !m.qr_url || !m.cuenta)

  return (
    <>
      {activos.length === 0 ? (
        <div className="pago-alerta" role="alert">
          <strong>⚠️ Configura tus medios de pago</strong>
          Mientras no actives Nequi o Bre-B, los jugadores no pueden reservar en {sede.nombre}.
        </div>
      ) : incompletos.length > 0 && (
        <div className="pago-alerta" role="status">
          <strong>⚠️ Completa tus datos de pago</strong>
          <span>
            {incompletos.map((m) => MEDIOS_PAGO[m.tipo]?.nombre).join(' y ')}{' '}
            {incompletos.length > 1 ? 'muestran' : 'muestra'} un QR de ejemplo o no tiene{incompletos.length > 1 ? 'n' : ''} número.
            Sube tu QR real en <em>Medios de pago</em>.
          </span>
        </div>
      )}

      <div className="admin-cifras">
        <Cifra icono="🧾" etiqueta="Por verificar" valor={formatoNumero(porVerificar.length)}
          detalle={porVerificar.length ? formatoPesos(porVerificar.reduce((n, r) => n + r.precio_total, 0)) + ' por confirmar' : 'Nada pendiente'} />
        <Cifra icono="⏳" etiqueta="Esperando pago" valor={formatoNumero(esperando.length)}
          detalle="Horarios apartados sin comprobante" />
        <Cifra icono="✅" etiqueta="Aprobadas (30 días)" valor={formatoNumero(aprobadas.length)}
          detalle={formatoPesos(aprobadas.reduce((n, r) => n + r.precio_total, 0))} />
      </div>

      <nav className="confirmar-pestanas" role="tablist" aria-label="Estado del pago">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={seccion === s.id}
            className={seccion === s.id ? 'activo' : ''}
            onClick={() => setSeccion(s.id)}
          >
            {s.icono} {s.texto}
            <span className="admin-contador">{listas[s.id].length}</span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={seccion === 'medios'}
          className={'confirmar-pestana-config' + (seccion === 'medios' ? ' activo' : '')}
          onClick={() => setSeccion('medios')}
        >
          ⚙️ Medios de pago
        </button>
      </nav>

      {seccion === 'medios' ? (
        <section className="admin-tarjeta admin-tarjeta-ancha">
          <header>
            <h3>⚙️ Medios de pago de {sede.nombre}</h3>
            <p>Esto es lo que ve el jugador en la pasarela al reservar.</p>
          </header>
          <ConfiguracionPago key={sede.id} sede={sede} metodos={metodos} onGuardado={onCambio} />
        </section>
      ) : (
        <section className="confirmar-seccion" role="tabpanel">
          <p className="confirmar-ayuda">{AYUDA[seccion]}</p>
          {lista.length === 0 ? (
            <p className="viz-vacio">{VACIO[seccion]}</p>
          ) : (
            <div className="confirmar-lista">
              {lista.map((r) => <SolicitudPago key={r.id} r={r} sedeNombre={sede.nombre} onCambio={onCambio} />)}
            </div>
          )}
          {seccion === 'aprobadas' && rechazadas.length > 0 && (
            <details className="confirmar-rechazadas">
              <summary>Rechazadas en los últimos 30 días ({rechazadas.length})</summary>
              <div className="confirmar-lista">
                {rechazadas.map((r) => <SolicitudPago key={r.id} r={r} sedeNombre={sede.nombre} onCambio={onCambio} />)}
              </div>
            </details>
          )}
        </section>
      )}
    </>
  )
}
