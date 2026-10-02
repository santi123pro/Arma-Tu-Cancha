import { useEffect, useState } from 'react'
import { fechaLocal } from '../lib/formato'
import { disponibilidad, crearReserva } from '../lib/datos'
import { ERROR_FRANJA_OCUPADA } from '../lib/supabase'
import { useToast } from './Toast'
import ImagenSede from './ImagenSede'
import { fotoCancha } from '../lib/imagenes'
import Cargando from './Cargando'

// crear_reserva acepta fechas entre hoy y hoy + 15 días. El selector
// usa el mismo rango para no ofrecer días que el backend va a rechazar.
const DIAS_ANTICIPACION = 15


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

const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

export default function CanchaCard({ cancha, sede }) {
  const toast = useToast()
  const hoy = fechaLocal()
  const limite = fechaLocal(DIAS_ANTICIPACION)

  const [fecha, setFecha] = useState(hoy)
  const [verFecha, setVerFecha] = useState(false)
  const [franjas, setFranjas] = useState([])
  const [franja, setFranja] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [comprobante, setComprobante] = useState(null)
  // Subirlo fuerza a consultar otra vez la misma fecha (tras un choque).
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setFranja(null)

    disponibilidad(cancha.id, fecha).then(({ datos, error }) => {
      if (!vigente) return
      if (error) {
        setError(error)
        setFranjas([])
      } else {
        setFranjas(datos ?? [])
      }
      setCargando(false)
    })

    return () => { vigente = false }
  }, [cancha.id, fecha, recarga])

  function cambiarFecha(valor) {
    if (!valor || valor < hoy || valor > limite) return
    setError(null)
    setFecha(valor)
  }

  async function reservar() {
    if (!franja?.disponible || enviando) return
    setError(null)
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
      setError(error)
      if (error === ERROR_FRANJA_OCUPADA) setRecarga((n) => n + 1)
      return
    }

    setComprobante(datos)
    toast('¡Reserva realizada!')
  }

  function otraReserva() {
    setComprobante(null)
    setRecarga((n) => n + 1)
  }

  return (
    <article className="cancha-card">
      <ImagenSede
        className="cancha-card-imagen"
        url={fotoCancha(sede, cancha)}
        color={sede.color_hex}
        texto={sede.nombre}
      />

      <div className="cancha-card-cuerpo">
        <h3>{cancha.nombre}</h3>
        <p><strong>Tipo:</strong> {cancha.tipo}</p>
        <p><strong>Tarifa:</strong> {pesos.format(cancha.precio_hora)} / hora</p>

        {comprobante ? (
          <div className="cancha-card-comprobante" role="status">
            <h4>¡Reserva realizada!</h4>
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
            <p className="cancha-card-fecha">
              {fecha === hoy ? 'Horarios de hoy' : `Horarios del ${fechaCorta(fecha)}`}
            </p>

            {cargando ? (
              <Cargando tamano="chico" texto="Consultando disponibilidad" />
            ) : franjas.length === 0 ? (
              <p className="cancha-card-estado">
                Esta cancha no tiene horarios configurados para ese día.
              </p>
            ) : franjas.every((f) => !f.disponible) ? (
              <p className="cancha-card-estado">
                Todos los horarios de este día están ocupados. Prueba con otra fecha.
              </p>
            ) : (
              <div className="cancha-card-franjas">
                {franjas.map((f) => (
                  <button
                    key={f.hora_inicio}
                    type="button"
                    disabled={!f.disponible}
                    title={f.disponible ? 'Disponible' : 'Ocupada'}
                    aria-label={`${hora12(f.hora_inicio)} — ${f.disponible ? 'disponible' : 'ocupada'}`}
                    className={
                      'franja' + (franja?.hora_inicio === f.hora_inicio ? ' franja-activa' : '')
                    }
                    onClick={() => f.disponible && setFranja(f)}
                  >
                    {hora12(f.hora_inicio)}
                  </button>
                ))}
              </div>
            )}

            <div className="cancha-card-acciones">
              <button
                type="button"
                className="btn-elegir-dia"
                onClick={() => setVerFecha((v) => !v)}
              >
                📅 Elegir otra fecha
              </button>

              {verFecha && (
                <input
                  type="date"
                  className="input-moderno"
                  aria-label="Fecha de la reserva"
                  value={fecha}
                  min={hoy}
                  max={limite}
                  onChange={(e) => cambiarFecha(e.target.value)}
                />
              )}

              {error && <p className="cancha-card-error" role="alert">{error}</p>}

              <button
                type="button"
                className="btn-cta-primary btn-reservar"
                disabled={!franja || cargando || enviando}
                onClick={reservar}
              >
                {enviando
                  ? 'Reservando…'
                  : franja
                    ? `Reservar ${hora12(franja.hora_inicio)}`
                    : 'Reservar'}
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  )
}
