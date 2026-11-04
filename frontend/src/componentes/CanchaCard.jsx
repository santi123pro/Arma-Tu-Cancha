import { useEffect, useState } from 'react'
import { fechaLocal, formatoPesos } from '../lib/formato'
import { disponibilidad, crearReserva } from '../lib/datos'
import { ERROR_FRANJA_OCUPADA } from '../lib/supabase'
import { useToast } from '../lib/useToast'
import ImagenSede from './ImagenSede'
import { fotoCancha } from '../lib/imagenes'
import { franjaYaPaso } from '../lib/sedes'
import Cargando from './Cargando'
import PasarelaPago from './PasarelaPago'
import { formatoRestante, useCuentaRegresiva } from '../lib/useCuentaRegresiva'
import { useSeguimientoReserva } from '../lib/useSeguimientoReserva'
import { MINUTOS_PARA_CONFIRMAR, MINUTOS_PARA_PAGAR } from '../lib/qrGenerico'


// Los horarios se agrupan por parte del día para encontrarlos más rápido.
const TRAMOS = [
  { nombre: 'Mañana', desde: 0, hasta: 12 },
  { nombre: 'Tarde', desde: 12, hasta: 18 },
  { nombre: 'Noche', desde: 18, hasta: 24 },
]

function enTramo(franja, tramo) {
  const hora = Number(franja.hora_inicio.slice(0, 2))
  return hora >= tramo.desde && hora < tramo.hasta
}

// '15:00:00' → '3:00 PM'
function hora12(hora) {
  const [h, m] = hora.split(':').map(Number)
  const sufijo = h < 12 ? 'AM' : 'PM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${sufijo}`
}

// '2026-10-05' → '05/10/2026'
function fechaCorta(iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// Día sin nada que reservar: explica por qué y lleva al siguiente.
function DiaSinHorarios({ texto, etiqueta, onVerOtroDia }) {
  return (
    <div className="cancha-card-vacio">
      <p className="cancha-card-estado">{texto}</p>
      {onVerOtroDia && (
        <button type="button" className="btn-elegir-dia" onClick={onVerOtroDia}>
          {etiqueta}
        </button>
      )}
    </div>
  )
}

// La tarjeta mientras el horario está apartado y la pasarela está cerrada.
function HorarioApartado({ reserva, onPagar, onOtra }) {
  const restante = useCuentaRegresiva(reserva.pago_vence_at)
  if (restante === 0) {
    return (
      <div className="cancha-card-comprobante pago-cancelado" role="status">
        <h4>⏰ Reserva cancelada</h4>
        <p>Pasaron los {MINUTOS_PARA_PAGAR} minutos sin recibir el comprobante y el horario se liberó.</p>
        <button type="button" className="btn-cta-primary" onClick={onOtra}>
          Elegir otro horario
        </button>
      </div>
    )
  }
  return (
    <div className="cancha-card-comprobante pago-apartado" role="status">
      <h4>⏳ Horario apartado</h4>
      <p>
        {fechaCorta(reserva.fecha)} · {hora12(reserva.hora_inicio)} – {hora12(reserva.hora_fin)}
        {restante ? <> · te quedan <strong>{formatoRestante(restante)}</strong> para pagar</> : null}
      </p>
      <button type="button" className="btn-cta-primary" onClick={onPagar}>
        Continuar con el pago
      </button>
    </div>
  )
}

// fecha: el día elegido en la página de la sede, común a todas sus canchas.
// onVerOtroDia: pasa al día siguiente cuando este no tiene nada que reservar.
export default function CanchaCard({ cancha, sede, fecha = fechaLocal(), onVerOtroDia }) {
  const toast = useToast()
  const esHoy = fecha === fechaLocal()
  const etiquetaOtroDia = esHoy ? 'Ver mañana' : 'Ver otro día'

  // Última consulta recibida. Está cargando mientras no sea la de esta clave.
  const [consulta, setConsulta] = useState({ clave: null, franjas: [], error: null })
  // La hora elegida y el error al reservar valen solo para su clave y su fecha:
  // al cambiar de día dejan de aplicar. El error sobrevive a la recarga tras
  // un choque, para que el jugador alcance a leer por qué falló.
  const [eleccion, setEleccion] = useState(null)
  const [errorReserva, setErrorReserva] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [comprobante, setComprobante] = useState(null)
  const [pasarela, setPasarela] = useState(false)
  // Subirlo fuerza a consultar otra vez la misma fecha (tras un choque).
  const [recarga, setRecarga] = useState(0)

  const clave = `${cancha.id}|${fecha}|${recarga}`
  const cargando = consulta.clave !== clave
  const franjas = cargando ? [] : consulta.franjas
  const franja = eleccion?.clave === clave ? eleccion.franja : null
  const error = (cargando ? null : consulta.error)
    ?? (errorReserva?.fecha === fecha ? errorReserva.mensaje : null)

  // Con el comprobante enviado, la tarjeta pasa sola a "confirmada" (o
  // "rechazada") cuando la sede revisa el pago.
  useSeguimientoReserva(comprobante, (datos) => {
    setComprobante((c) => ({ ...c, ...datos }))
    if (datos.pago_estado === 'aprobado') toast('¡Tu reserva quedó confirmada!')
    else if (datos.pago_estado === 'rechazado') toast('La sede no pudo verificar tu pago.', 'error')
  })

  useEffect(() => {
    let vigente = true

    disponibilidad(cancha.id, fecha).then(({ datos, error }) => {
      if (!vigente) return
      setConsulta({ clave, franjas: error ? [] : datos ?? [], error: error ?? null })
    })

    return () => { vigente = false }
  }, [cancha.id, fecha, clave])

  async function reservar() {
    if (!franja?.disponible || enviando) return
    setErrorReserva(null)
    setEnviando(true)

    // El usuario lo pone el backend con auth.uid(); aquí no se envía.
    const { datos, error } = await crearReserva({
      canchaId: cancha.id,
      fecha,
      hora: franja.hora_inicio,
      duracionHoras: 1,
    })
    setEnviando(false)

    if (error) {
      setErrorReserva({ fecha, mensaje: error })
      if (error === ERROR_FRANJA_OCUPADA) setRecarga((n) => n + 1)
      return
    }

    setComprobante(datos)
    // Quien administra la sede reserva sin pasar por el pago.
    if (datos.pago_estado === 'esperando_pago') setPasarela(true)
    else toast('¡Reserva confirmada!')
  }

  function otraReserva() {
    setPasarela(false)
    setComprobante(null)
    setRecarga((n) => n + 1)
  }

  return (
    <article className="cancha-card">
      <div className="cancha-card-cabeza">
        <ImagenSede
          className="cancha-card-imagen"
          url={fotoCancha(sede, cancha)}
          color={sede.color_hex}
          texto={cancha.nombre}
          alt={`${cancha.nombre} de ${sede.nombre}, ${cancha.tipo}`}
        />
        <div className="cancha-card-datos">
          <h3>{cancha.nombre}</h3>
          <p>{cancha.tipo}</p>
          <p className="cancha-card-precio">{formatoPesos(cancha.precio_hora)} <small>por hora</small></p>
        </div>
      </div>

      <div className="cancha-card-cuerpo">
        {pasarela && comprobante && (
          <PasarelaPago
            reserva={comprobante}
            cancha={cancha}
            sede={sede}
            onEnviado={(r) => { setComprobante(r); toast('Comprobante enviado. Tu reserva está pendiente por confirmar.') }}
            onCancelada={otraReserva}
            onCerrar={() => setPasarela(false)}
          />
        )}

        {comprobante?.pago_estado === 'esperando_pago' ? (
          <HorarioApartado reserva={comprobante} onPagar={() => setPasarela(true)} onOtra={otraReserva} />
        ) : comprobante?.pago_estado === 'rechazado' ? (
          <div className="cancha-card-comprobante pago-cancelado" role="status">
            <h4>✕ Pago no verificado</h4>
            <p>
              {comprobante.pago_motivo_rechazo ? <>Motivo: <strong>{comprobante.pago_motivo_rechazo}</strong>. </> : null}
              La reserva se canceló. Comunícate con la sede si crees que es un error.
            </p>
            <button type="button" className="btn-cta-primary" onClick={otraReserva}>
              Hacer otra reserva
            </button>
          </div>
        ) : comprobante?.pago_estado === 'por_verificar' ? (
          <div className="cancha-card-comprobante pago-en-revision" role="status">
            <h4>⏳ Pendiente por confirmar</h4>
            <p>
              Recibimos tu comprobante. La sede tiene hasta {MINUTOS_PARA_CONFIRMAR} minutos para verificar el pago;
              esta tarjeta se actualiza sola cuando la confirme.
            </p>
            <dl>
              <dt>Fecha</dt><dd>{fechaCorta(comprobante.fecha)}</dd>
              <dt>Horario</dt>
              <dd>{hora12(comprobante.hora_inicio)} – {hora12(comprobante.hora_fin)}</dd>
              <dt>Código de reserva</dt>
              <dd className="cancha-card-codigo">{comprobante.codigo}</dd>
            </dl>
            <button type="button" className="btn-cta-primary" onClick={otraReserva}>
              Hacer otra reserva
            </button>
          </div>
        ) : comprobante ? (
          <div className="cancha-card-comprobante" role="status">
            <h4>¡Reserva confirmada!</h4>
            <dl>
              <dt>Cancha</dt><dd>{cancha.nombre}</dd>
              <dt>Fecha</dt><dd>{fechaCorta(comprobante.fecha)}</dd>
              <dt>Horario</dt>
              <dd>{hora12(comprobante.hora_inicio)} – {hora12(comprobante.hora_fin)}</dd>
              <dt>Código de reserva</dt>
              <dd className="cancha-card-codigo">{comprobante.codigo}</dd>
            </dl>
            <button type="button" className="btn-cta-primary" onClick={otraReserva}>
              Hacer otra reserva
            </button>
          </div>
        ) : (
          <>
            {cargando ? (
              <Cargando tamano="chico" texto="Consultando disponibilidad" />
            ) : franjas.length === 0 ? (
              <DiaSinHorarios
                texto="Esta cancha no tiene horarios configurados para ese día."
                etiqueta={etiquetaOtroDia}
                onVerOtroDia={onVerOtroDia}
              />
            ) : franjas.every((f) => !f.disponible) ? (
              <DiaSinHorarios
                texto={esHoy && franjas.every((f) => franjaYaPaso(f.hora_inicio))
                  ? 'Ya no quedan horarios hoy.'
                  : 'Todos los horarios de este día están ocupados.'}
                etiqueta={etiquetaOtroDia}
                onVerOtroDia={onVerOtroDia}
              />
            ) : (
              <>
                {TRAMOS.map((tramo) => {
                  const delTramo = franjas.filter((f) => enTramo(f, tramo))
                  if (delTramo.length === 0) return null
                  return (
                    <div key={tramo.nombre} className="cancha-card-tramo" role="group" aria-label={tramo.nombre}>
                      <h4>{tramo.nombre}</h4>
                      <div className="cancha-card-franjas">
                        {delTramo.map((f) => (
                          <button
                            key={f.hora_inicio}
                            type="button"
                            disabled={!f.disponible}
                            title={f.disponible ? 'Disponible' : 'Ocupada'}
                            aria-label={`${hora12(f.hora_inicio)} — ${f.disponible ? 'disponible' : 'ocupada'}`}
                            aria-pressed={franja?.hora_inicio === f.hora_inicio}
                            className={
                              'franja' + (franja?.hora_inicio === f.hora_inicio ? ' franja-activa' : '')
                            }
                            onClick={() => f.disponible && setEleccion({ clave, franja: f })}
                          >
                            {hora12(f.hora_inicio)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}

                <div className={'cancha-card-acciones' + (franja ? ' cancha-card-acciones-lista' : '')}>
                  <button
                    type="button"
                    className="btn-cta-primary btn-reservar"
                    disabled={!franja || cargando || enviando}
                    onClick={reservar}
                  >
                    {enviando
                      ? 'Apartando horario…'
                      : franja
                        ? `Reservar ${hora12(franja.hora_inicio)}`
                        : 'Elige un horario'}
                  </button>
                </div>
              </>
            )}

            {error && <p className="cancha-card-error" role="alert">{error}</p>}
          </>
        )}
      </div>
    </article>
  )
}
