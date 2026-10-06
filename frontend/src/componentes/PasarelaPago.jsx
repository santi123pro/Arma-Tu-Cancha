import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cancelarReserva, datosPagoSede, reportarPago, subirComprobante } from '../lib/datos'
import { MEDIOS_PAGO, qrGenerico } from '../lib/qrGenerico'
import { formatoRestante, useCuentaRegresiva } from '../lib/useCuentaRegresiva'
import { useToast } from './Toast'

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const MAX_COMPROBANTE = 5 * 1024 * 1024
const TIPOS_COMPROBANTE = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

// '19:00:00' → '7:00 p. m.'
function horaLarga(hora) {
  const [h, m] = hora.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

// '2026-10-06' → 'Martes 6 de octubre'
function fechaLarga(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  const texto = new Date(a, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function Copiar({ texto, etiqueta }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch {
      // Sin permiso para el portapapeles: el dato sigue visible para copiarlo a mano.
    }
  }

  return (
    <button type="button" className="pago-copiar" onClick={copiar} aria-label={`Copiar ${etiqueta}`}>
      {copiado ? '✓ Copiado' : 'Copiar'}
    </button>
  )
}

const PASOS = ['Cancha', 'Horario', 'Pago']

function Pasos({ actual }) {
  return (
    <ol className="pasarela-pasos" aria-label="Pasos de la reserva">
      {PASOS.map((p, i) => (
        <li
          key={p}
          className={i < actual ? 'hecho' : i === actual ? 'actual' : ''}
          aria-current={i === actual ? 'step' : undefined}
        >
          <span className="pasarela-paso-num">{i < actual ? '✓' : i + 1}</span>
          {p}
        </li>
      ))}
    </ol>
  )
}

function Resumen({ reserva, cancha, sede, medio }) {
  return (
    <dl className="pasarela-resumen-datos">
      <dt>Cancha</dt><dd>{cancha.nombre}{cancha.tipo && <small> · {cancha.tipo}</small>}</dd>
      <dt>Sede</dt><dd>{sede.nombre}</dd>
      <dt>Fecha</dt><dd>{fechaLarga(reserva.fecha)}</dd>
      <dt>Horario</dt><dd>{horaLarga(reserva.hora_inicio)} – {horaLarga(reserva.hora_fin)}</dd>
      {medio && (<><dt>Pagas con</dt><dd>{MEDIOS_PAGO[medio]?.nombre ?? medio}</dd></>)}
    </dl>
  )
}

// Pasarela de pago de una reserva pendiente. Se abre encima de la página.
//   reserva  { id, codigo, fecha, hora_inicio, hora_fin, precio_total, pago_estado, pago_vence_at }
//   cancha   { nombre, tipo }      sede { id, nombre }
//   onEnviado(reserva)  el comprobante quedó enviado (la pasarela muestra "¡Reserva realizada!")
//   onCancelada()       el jugador soltó el horario
//   onCerrar()          cerrar la pasarela (la reserva sigue apartada)
export default function PasarelaPago({ reserva, cancha, sede, onEnviado, onCancelada, onCerrar }) {
  const toast = useToast()
  const caja = useRef(null)
  const [pago, setPago] = useState(null)
  const [errorPago, setErrorPago] = useState(null)
  const [medio, setMedio] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [vista, setVista] = useState(null)
  const [referencia, setReferencia] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState(null)

  const restante = useCuentaRegresiva(reserva.pago_vence_at)
  const enviado = reserva.pago_estado === 'por_verificar'
  const vencida = !enviado && restante === 0

  useEffect(() => {
    let vigente = true
    datosPagoSede(sede.id).then(({ datos, error }) => {
      if (!vigente) return
      setPago(datos)
      setErrorPago(error)
      setMedio((m) => m ?? datos?.metodos[0]?.tipo ?? null)
    })
    return () => { vigente = false }
  }, [sede.id])

  // Mientras está abierta: sin scroll detrás, foco adentro y Escape cierra.
  // onCerrar va por ref: suele llegar como función nueva en cada render.
  const cerrar = useRef(onCerrar)
  useEffect(() => { cerrar.current = onCerrar })
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    caja.current?.focus()
    const alTeclear = (e) => { if (e.key === 'Escape') cerrar.current() }
    window.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', alTeclear)
    }
  }, [])

  // La miniatura del comprobante se libera al cambiarla o al cerrar.
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista) }, [vista])

  function elegirArchivo(e) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!f) return
    setError(null)
    if (!TIPOS_COMPROBANTE.includes(f.type)) {
      setError('El comprobante debe ser una imagen (PNG, JPG o WEBP) o un PDF.')
      return
    }
    if (f.size > MAX_COMPROBANTE) {
      setError('El comprobante pesa más de 5 MB. Envía una captura de pantalla.')
      return
    }
    setArchivo(f)
    setVista(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  async function enviar() {
    if (enviando || vencida) return
    setError(null)
    if (!medio) {
      setError('Elige con qué pagaste: Nequi o Bre-B.')
      return
    }
    if (!archivo) {
      setError('Adjunta el comprobante del pago para que la sede lo verifique.')
      return
    }

    setEnviando(true)
    const subida = await subirComprobante(reserva.id, archivo)
    if (subida.error) {
      setEnviando(false)
      setError(subida.error)
      return
    }
    const { datos, error } = await reportarPago(reserva.id, {
      medio,
      comprobante: subida.datos,
      referencia: referencia.trim(),
    })
    setEnviando(false)
    if (error) {
      setError(error)
      return
    }
    onEnviado?.({ ...reserva, ...datos })
  }

  async function cancelar() {
    if (cancelando) return
    setCancelando(true)
    const { error } = await cancelarReserva(reserva.id)
    setCancelando(false)
    if (error) {
      toast(error, 'error')
      return
    }
    toast('Solicitud cancelada. El horario quedó libre.')
    onCancelada?.()
  }

  const metodo = pago?.metodos.find((m) => m.tipo === medio)
  const info = MEDIOS_PAGO[medio]
  const total = pesos.format(reserva.precio_total)

  let contenido
  if (enviado) {
    contenido = (
      <div className="pasarela-final">
        <span className="pasarela-final-icono" aria-hidden="true">✓</span>
        <h2 id="pasarela-titulo">¡Reserva realizada!</h2>
        <p>
          Recibimos tu comprobante. {sede.nombre} verificará el pago y tu reserva quedará
          <strong> confirmada</strong>. Puedes seguir el estado en <strong>Mis reservas</strong>.
        </p>
        <div className="pasarela-final-codigo">
          <small>Código de reserva</small>
          <strong>{reserva.codigo}</strong>
          <Copiar texto={reserva.codigo} etiqueta="el código de la reserva" />
        </div>
        <div className="pasarela-final-resumen">
          <Resumen reserva={reserva} cancha={cancha} sede={sede} medio={reserva.pago_medio} />
          <div className="pasarela-total"><span>Total</span><strong>{total}</strong></div>
        </div>
        <span className="pasarela-estado">⏳ Pago en verificación</span>
        <button type="button" className="btn-cta-primary pasarela-listo" onClick={onCerrar}>
          Listo
        </button>
      </div>
    )
  } else if (vencida) {
    contenido = (
      <div className="pasarela-final pasarela-final-vencida">
        <span className="pasarela-final-icono" aria-hidden="true">⏰</span>
        <h2 id="pasarela-titulo">El tiempo para pagar terminó</h2>
        <p>No recibimos el comprobante a tiempo y el horario se liberó. Puedes solicitarlo de nuevo si sigue disponible.</p>
        <button type="button" className="btn-cta-primary pasarela-listo" onClick={onCancelada ?? onCerrar}>
          Elegir otro horario
        </button>
      </div>
    )
  } else {
    contenido = (
      <div className="pasarela-cuerpo">
        <section className="pasarela-qr" aria-labelledby="pasarela-titulo">
          <h2 id="pasarela-titulo">Paga con QR</h2>

          {errorPago ? (
            <p className="pago-error" role="alert">No se pudieron cargar los medios de pago de la sede. Recarga la página.</p>
          ) : !pago ? (
            <p className="pago-cargando">Cargando medios de pago…</p>
          ) : pago.metodos.length === 0 ? (
            <p className="pago-error" role="alert">{sede.nombre} no tiene medios de pago activos. Comunícate con la sede.</p>
          ) : (
            <>
              <div className="pasarela-medios" role="radiogroup" aria-label="Medio de pago">
                {pago.metodos.map((m) => (
                  <button
                    key={m.tipo}
                    type="button"
                    role="radio"
                    aria-checked={medio === m.tipo}
                    className={`pasarela-medio medio-${m.tipo}` + (medio === m.tipo ? ' activo' : '')}
                    onClick={() => setMedio(m.tipo)}
                  >
                    <span className="pasarela-medio-logo" aria-hidden="true">{m.tipo === 'nequi' ? 'N' : 'B'}</span>
                    {MEDIOS_PAGO[m.tipo]?.nombre ?? m.tipo}
                  </button>
                ))}
              </div>

              {metodo && (
                <>
                  <figure className={`pasarela-qr-imagen medio-${metodo.tipo}`}>
                    <img
                      src={metodo.qr_url || qrGenerico(info?.semilla)}
                      alt={`Código QR de ${info?.nombre} para pagar a ${sede.nombre}`}
                    />
                    {!metodo.qr_url && <span className="pasarela-qr-ejemplo">QR de ejemplo</span>}
                    <figcaption>{info?.app}</figcaption>
                  </figure>

                  <dl className="pago-cuenta pasarela-cuenta">
                    {metodo.titular && (<><dt>Titular</dt><dd>{metodo.titular}</dd></>)}
                    {metodo.cuenta && (
                      <>
                        <dt>{info?.cuenta}</dt>
                        <dd className="pago-dato-copiable">
                          <span>{metodo.cuenta}</span>
                          <Copiar texto={metodo.cuenta} etiqueta={info?.cuenta} />
                        </dd>
                      </>
                    )}
                    <dt>Valor exacto</dt>
                    <dd className="pago-dato-copiable">
                      <span>{total}</span>
                      <Copiar texto={String(reserva.precio_total)} etiqueta="el valor" />
                    </dd>
                    <dt>Descripción</dt>
                    <dd className="pago-dato-copiable">
                      <span className="pago-codigo">{reserva.codigo}</span>
                      <Copiar texto={reserva.codigo} etiqueta="el código de la reserva" />
                    </dd>
                  </dl>
                </>
              )}
              {pago.instrucciones && <p className="pago-instrucciones">ℹ️ {pago.instrucciones}</p>}
            </>
          )}
        </section>

        <section className="pasarela-resumen" aria-label="Resumen de tu reserva">
          <div className="pasarela-resumen-cabeza">
            <h3>Resumen de tu reserva</h3>
            {restante != null && (
              <span className={'pasarela-reloj' + (restante < 300 ? ' urgente' : '')} title="Tiempo para enviar el comprobante">
                ⏱ {formatoRestante(restante)}
              </span>
            )}
          </div>
          <Resumen reserva={reserva} cancha={cancha} sede={sede} />
          <div className="pasarela-total"><span>Total</span><strong>{total}</strong></div>
          <p className="pasarela-apartado">
            Tu horario está apartado. Se libera si no envías el comprobante antes de que termine el tiempo.
          </p>
        </section>

        <section className="pasarela-comprobante" aria-label="Comprobante de pago">
          <label className={'pasarela-adjuntar' + (archivo ? ' con-archivo' : '')}>
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={elegirArchivo} />
            {vista ? (
              <img src={vista} alt="Vista previa del comprobante" />
            ) : (
              <span className="pasarela-adjuntar-icono" aria-hidden="true">{archivo ? '📄' : '📎'}</span>
            )}
            <span className="pasarela-adjuntar-texto">
              <strong>{archivo ? archivo.name : 'Adjuntar comprobante'}</strong>
              <small>{archivo ? 'Toca para cambiarlo' : 'Captura de pantalla o PDF · máx. 5 MB'}</small>
            </span>
          </label>

          <label className="pasarela-referencia">
            Referencia de la transacción <small>(opcional)</small>
            <input
              className="input-moderno"
              maxLength={120}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej.: M1234567"
            />
          </label>

          {error && <p className="pago-error" role="alert">{error}</p>}

          <div className="pasarela-accion">
            <button
              type="button"
              className="btn-cta-primary"
              onClick={enviar}
              disabled={enviando || !pago || pago.metodos.length === 0}
            >
              {enviando ? 'Enviando comprobante…' : `Enviar comprobante · ${total}`}
            </button>
          </div>

          {confirmarCancelar ? (
            <div className="pasarela-cancelar-confirmar">
              <span>¿Cancelar la solicitud? El horario quedará libre para otros.</span>
              <button type="button" className="btn-peligro" onClick={cancelar} disabled={cancelando}>
                {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
              <button type="button" className="pago-cancelar" onClick={() => setConfirmarCancelar(false)}>
                No
              </button>
            </div>
          ) : (
            <button type="button" className="pago-cancelar" onClick={() => setConfirmarCancelar(true)}>
              Cancelar solicitud y liberar el horario
            </button>
          )}
        </section>
      </div>
    )
  }

  return createPortal(
    <div className="pasarela-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        ref={caja}
        className="pasarela"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pasarela-titulo"
        tabIndex={-1}
      >
        <header className="pasarela-cabeza">
          <Pasos actual={enviado ? 3 : 2} />
          <button type="button" className="pasarela-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>
        {contenido}
      </div>
    </div>,
    document.body,
  )
}
