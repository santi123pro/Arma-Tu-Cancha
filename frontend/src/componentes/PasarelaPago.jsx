import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cancelarReserva, datosPagoSede, reportarPago, subirComprobante } from '../lib/datos'
import { MEDIOS_PAGO, MINUTOS_PARA_CONFIRMAR, MINUTOS_PARA_PAGAR, qrPorDefecto } from '../lib/qrGenerico'
import { PAGOS_POR_DEFECTO } from '../lib/sitio'
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

// '3162528100' → '316 252 8100'. Otros formatos (llaves Bre-B) quedan igual.
function celular(cuenta) {
  const digitos = cuenta.replace(/\D/g, '')
  return /^3\d{9}$/.test(digitos) ? digitos.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : cuenta
}

async function alPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Sin permiso o sin HTTPS (algunos celulares): con un campo temporal.
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.setAttribute('readonly', '')
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    const ok = document.execCommand('copy')
    campo.remove()
    return ok
  }
}

function Copiar({ texto, etiqueta }) {
  const toast = useToast()
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (await alPortapapeles(texto)) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } else {
      toast('No se pudo copiar. Mantén presionado el dato para copiarlo.', 'warn')
    }
  }

  return (
    <button type="button" className="pago-copiar" onClick={copiar} aria-label={`Copiar ${etiqueta}`}>
      {copiado ? '✓ Copiado' : 'Copiar'}
    </button>
  )
}

const PASOS = ['Cancha', 'Horario', 'Pago', 'Comprobante', 'Confirmación']

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
          <span className="pasarela-paso-texto">{p}</span>
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

// Cuenta regresiva de los 10 minutos para pagar, con barra de progreso.
function Contador({ restante, total }) {
  if (restante == null) return null
  const urgente = restante < 120
  const parte = Math.max(0, Math.min(1, restante / total))
  return (
    <div className={'pasarela-contador' + (urgente ? ' urgente' : '')} role="timer" aria-live="off">
      <span className="pasarela-contador-reloj">⏱ {formatoRestante(restante)}</span>
      <span className="pasarela-contador-texto">
        {urgente
          ? 'Apúrate: si no envías el comprobante a tiempo, la reserva se cancela.'
          : `Tienes ${MINUTOS_PARA_PAGAR} minutos para pagar y enviar el comprobante. Si no, la reserva se cancela.`}
      </span>
      <span className="pasarela-contador-barra" aria-hidden="true">
        <span style={{ transform: `scaleX(${parte})` }} />
      </span>
    </div>
  )
}

// Pasarela de pago de una reserva pendiente. Se abre encima de la página.
//   1. Pago         QR de Nequi o Bre-B y datos de la cuenta.
//   2. Comprobante  el jugador carga la captura del pago.
//   3. Confirmación "Pendiente por confirmar" hasta que la sede aprueba;
//                   el padre actualiza `reserva` (useSeguimientoReserva) y
//                   aquí aparece "¡Reserva confirmada!" o el rechazo.
//
//   reserva  { id, codigo, fecha, hora_inicio, hora_fin, precio_total, estado, pago_estado, pago_vence_at }
//   cancha   { nombre, tipo }      sede { id, nombre }
//   onEnviado(reserva)  el comprobante quedó enviado
//   onCancelada()       el jugador soltó el horario (o se le venció)
//   onCerrar()          cerrar la pasarela (la reserva sigue apartada)
export default function PasarelaPago({ reserva, cancha, sede, onEnviado, onCancelada, onCerrar }) {
  const toast = useToast()
  const caja = useRef(null)
  const [paso, setPaso] = useState('qr')
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
  // Medios cuyo QR no cargó (la sede no lo subió y no está el general).
  const [sinQr, setSinQr] = useState([])

  const restante = useCuentaRegresiva(reserva.pago_vence_at)
  const confirmada = reserva.pago_estado === 'aprobado'
  const rechazada = reserva.pago_estado === 'rechazado'
  const enviado = reserva.pago_estado === 'por_verificar'
  const vencida = reserva.pago_estado === 'vencido' ||
    (reserva.pago_estado === 'esperando_pago' && restante === 0)

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

  function irAComprobante() {
    setError(null)
    setPaso('comprobante')
    caja.current?.closest('.pasarela-fondo')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
      setError('Carga el comprobante del pago para que la sede lo verifique.')
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
    toast('Reserva cancelada. El horario quedó libre.')
    onCancelada?.()
  }

  const encontrado = pago?.metodos.find((m) => m.tipo === medio)
  // Lo que la sede no llenó sale de los datos generales (lib/sitio.js).
  const metodo = encontrado && {
    ...encontrado,
    cuenta: encontrado.cuenta || PAGOS_POR_DEFECTO[medio]?.cuenta,
    titular: encontrado.titular || PAGOS_POR_DEFECTO[medio]?.titular,
    qr: encontrado.qr_url || qrPorDefecto(medio),
  }
  const info = MEDIOS_PAGO[medio]
  const total = pesos.format(reserva.precio_total)
  const sinMedios = !pago || pago.metodos.length === 0

  const selectorMedio = pago && pago.metodos.length > 0 && (
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
  )

  let pasoActual = paso === 'qr' ? 2 : 3
  let contenido

  if (confirmada || rechazada || enviado) {
    pasoActual = confirmada ? 5 : 4
    contenido = (
      <div className={'pasarela-final' + (confirmada ? ' confirmada' : rechazada ? ' rechazada' : ' pendiente')}>
        <span className="pasarela-final-icono" aria-hidden="true">{confirmada ? '✓' : rechazada ? '✕' : '⏳'}</span>
        <h2 id="pasarela-titulo">
          {confirmada ? '¡Reserva confirmada!' : rechazada ? 'La sede no pudo verificar tu pago' : '¡Comprobante enviado!'}
        </h2>
        <span className="pasarela-estado">
          {confirmada ? '✅ Reserva confirmada' : rechazada ? 'Reserva cancelada' : '⏳ Pendiente por confirmar'}
        </span>
        {confirmada ? (
          <p>{sede.nombre} verificó tu pago. ¡Nos vemos en la cancha! Presenta este código al llegar.</p>
        ) : rechazada ? (
          <p>
            {reserva.pago_motivo_rechazo ? <>Motivo: <strong>{reserva.pago_motivo_rechazo}</strong>. </> : null}
            Comunícate con {sede.nombre} si crees que es un error.
          </p>
        ) : (
          <p>
            {sede.nombre} está verificando que el pago llegó. Tiene hasta <strong>{MINUTOS_PARA_CONFIRMAR} minutos</strong> para
            confirmar tu reserva. Esta pantalla se actualiza sola, y también puedes seguir el estado en <strong>Mis reservas</strong>.
          </p>
        )}
        <div className="pasarela-final-codigo">
          <small>Código de reserva</small>
          <strong>{reserva.codigo}</strong>
          <Copiar texto={reserva.codigo} etiqueta="el código de la reserva" />
        </div>
        <div className="pasarela-final-resumen">
          <Resumen reserva={reserva} cancha={cancha} sede={sede} medio={reserva.pago_medio} />
          <div className="pasarela-total"><span>Total</span><strong>{total}</strong></div>
        </div>
        {enviado && <span className="pasarela-esperando"><span className="pasarela-punto" aria-hidden="true" /> Esperando la confirmación de la sede…</span>}
        <button type="button" className="btn-cta-primary pasarela-listo" onClick={onCerrar}>
          {enviado ? 'Entendido' : 'Listo'}
        </button>
      </div>
    )
  } else if (vencida) {
    contenido = (
      <div className="pasarela-final rechazada">
        <span className="pasarela-final-icono" aria-hidden="true">⏰</span>
        <h2 id="pasarela-titulo">Se acabaron los {MINUTOS_PARA_PAGAR} minutos</h2>
        <p>No recibimos el comprobante a tiempo, así que la reserva se canceló y el horario quedó libre. Puedes reservarlo de nuevo si sigue disponible.</p>
        <button type="button" className="btn-cta-primary pasarela-listo" onClick={onCancelada ?? onCerrar}>
          Elegir otro horario
        </button>
      </div>
    )
  } else {
    contenido = (
      <>
        <Contador restante={restante} total={MINUTOS_PARA_PAGAR * 60} />
        <div className="pasarela-cuerpo">
          {paso === 'qr' ? (
            <section className="pasarela-principal" aria-labelledby="pasarela-titulo">
              <div>
                <span className="pasarela-paso-etiqueta">Paso 1 de 2</span>
                <h2 id="pasarela-titulo">Escanea el QR y paga</h2>
              </div>

              {errorPago ? (
                <p className="pago-error" role="alert">No se pudieron cargar los medios de pago de la sede. Recarga la página.</p>
              ) : !pago ? (
                <p className="pago-cargando">Cargando medios de pago…</p>
              ) : pago.metodos.length === 0 ? (
                <p className="pago-error" role="alert">{sede.nombre} no tiene medios de pago activos. Comunícate con la sede.</p>
              ) : (
                <>
                  {selectorMedio}
                  {metodo && (
                    <>
                      {!sinQr.includes(metodo.tipo) && (
                        <figure className={`pasarela-qr-imagen medio-${metodo.tipo}`}>
                          <img
                            src={metodo.qr}
                            alt={`Código QR de ${info?.nombre} para pagar a ${sede.nombre}`}
                            onError={() => setSinQr((l) => [...l, metodo.tipo])}
                          />
                          <figcaption>{info?.app}</figcaption>
                        </figure>
                      )}

                      <dl className="pago-cuenta pasarela-cuenta">
                        {metodo.titular && (<><dt>Titular</dt><dd>{metodo.titular}</dd></>)}
                        {metodo.cuenta && (
                          <>
                            <dt>{info?.cuenta}</dt>
                            <dd className="pago-dato-copiable">
                              <span className="pago-cuenta-numero">
                                {metodo.tipo === 'nequi' ? celular(metodo.cuenta) : metodo.cuenta}
                              </span>
                              <Copiar
                                texto={metodo.tipo === 'nequi' ? metodo.cuenta.replace(/\s/g, '') : metodo.cuenta}
                                etiqueta={info?.cuenta}
                              />
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
          ) : (
            <section className="pasarela-principal" aria-labelledby="pasarela-titulo">
              <div>
                <span className="pasarela-paso-etiqueta">Paso 2 de 2</span>
                <h2 id="pasarela-titulo">Carga tu comprobante de pago</h2>
                <p className="pasarela-subtitulo">
                  Con el comprobante, {sede.nombre} verifica que el pago llegó y confirma tu reserva.
                </p>
              </div>

              <div className="pasarela-campo">
                <span className="pasarela-campo-titulo">¿Con qué pagaste?</span>
                {selectorMedio}
              </div>

              <label className={'pasarela-adjuntar' + (archivo ? ' con-archivo' : '')}>
                <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={elegirArchivo} />
                {vista ? (
                  <img src={vista} alt="Vista previa del comprobante" />
                ) : (
                  <span className="pasarela-adjuntar-icono" aria-hidden="true">{archivo ? '📄' : '📤'}</span>
                )}
                <span className="pasarela-adjuntar-texto">
                  <strong>{archivo ? archivo.name : 'Toca para cargar el comprobante'}</strong>
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
            </section>
          )}

          <section className="pasarela-resumen" aria-label="Resumen de tu reserva">
            <h3>Resumen de tu reserva</h3>
            <Resumen reserva={reserva} cancha={cancha} sede={sede} medio={paso === 'comprobante' ? medio : null} />
            <div className="pasarela-total"><span>Total a pagar</span><strong>{total}</strong></div>
          </section>

          <section className="pasarela-acciones" aria-label="Acciones">
            {error && <p className="pago-error" role="alert">{error}</p>}
            <div className="pasarela-accion">
              {paso === 'qr' ? (
                <button type="button" className="btn-cta-primary" onClick={irAComprobante} disabled={sinMedios}>
                  Ya pagué, cargar comprobante →
                </button>
              ) : (
                <button type="button" className="btn-cta-primary" onClick={enviar} disabled={enviando || sinMedios}>
                  {enviando ? 'Enviando comprobante…' : 'Enviar comprobante'}
                </button>
              )}
            </div>

            {paso === 'comprobante' && (
              <button type="button" className="pasarela-volver" onClick={() => { setError(null); setPaso('qr') }}>
                ← Volver al QR
              </button>
            )}

            {confirmarCancelar ? (
              <div className="pasarela-cancelar-confirmar">
                <span>¿Cancelar la reserva? El horario quedará libre para otros.</span>
                <button type="button" className="btn-peligro" onClick={cancelar} disabled={cancelando}>
                  {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
                <button type="button" className="pago-cancelar" onClick={() => setConfirmarCancelar(false)}>
                  No
                </button>
              </div>
            ) : (
              <button type="button" className="pago-cancelar" onClick={() => setConfirmarCancelar(true)}>
                Cancelar reserva
              </button>
            )}
          </section>
        </div>
      </>
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
          <Pasos actual={pasoActual} />
          <button type="button" className="pasarela-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>
        {contenido}
      </div>
    </div>,
    document.body,
  )
}
