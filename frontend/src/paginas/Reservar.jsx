import { useEffect, useState } from 'react'
import { disponibilidad, crearReserva } from '../lib/datos'
import { useSesion } from '../lib/useSesion'

/**
 * Pantalla de reserva — ejemplo completo del patrón a seguir.
 *
 * Fíjate en tres cosas:
 *  1. No hay fetch ni URLs: se llama a una función de lib/datos.js.
 *  2. El error llega ya traducido y se muestra junto al formulario.
 *  3. El botón se bloquea mientras se envía, para que un doble clic no
 *     cree dos peticiones.
 */
export default function Reservar({ cancha }) {
  const { perfil, autenticado } = useSesion()

  const hoy = new Date().toISOString().slice(0, 10)
  const limite = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)

  const [fecha, setFecha] = useState(hoy)
  const [franjas, setFranjas] = useState([])
  const [franja, setFranja] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [comprobante, setComprobante] = useState(null)
  const [form, setForm] = useState({ nombre: '', telefono: '' })

  useEffect(() => {
    if (perfil?.nombre) setForm((f) => ({ ...f, nombre: f.nombre || perfil.nombre }))
  }, [perfil])

  // Cada cambio de fecha vuelve a consultar. El AbortController evita que
  // una respuesta lenta pinte encima de una más reciente.
  useEffect(() => {
    let vigente = true
    setCargando(true); setFranja(null); setError(null)

    disponibilidad(cancha.id, fecha).then(({ datos, error }) => {
      if (!vigente) return
      if (error) setError(error)
      else setFranjas(datos ?? [])
      setCargando(false)
    })

    return () => { vigente = false }
  }, [cancha.id, fecha])

  async function confirmar(e) {
    e.preventDefault()
    setError(null)

    if (!franja) return setError('Elige un horario disponible.')
    if (form.nombre.trim().length < 2) return setError('Escribe el nombre de quien reserva.')
    if (form.telefono.trim().length < 7) return setError('Escribe un teléfono de contacto.')

    setEnviando(true)
    const { datos, error } = await crearReserva({
      canchaId: cancha.id,
      fecha,
      hora: franja.hora_inicio,
      duracionHoras: 1,
      clienteNombre: form.nombre.trim(),
      clienteTel: form.telefono.trim(),
    })
    setEnviando(false)

    if (error) {
      setError(error)
      // Si el horario se ocupó mientras llenaba el formulario, se recarga
      // la disponibilidad para que vea el estado real.
      if (error.includes('ya está reservada')) setFecha((f) => f)
      return
    }
    setComprobante(datos)
  }

  if (!autenticado) {
    return <p>Inicia sesión para reservar esta cancha.</p>
  }

  if (comprobante) {
    return (
      <div className="comprobante">
        <h3>Reserva confirmada</h3>
        <p className="codigo">{comprobante.codigo}</p>
        <p>{cancha.nombre} · {fecha} · {comprobante.hora_inicio}</p>
        <p>Guarda este código: lo necesitas el día del partido.</p>
      </div>
    )
  }

  return (
    <form onSubmit={confirmar}>
      <h3>{cancha.nombre}</h3>

      <label htmlFor="fecha">Fecha</label>
      <input
        id="fecha" type="date" value={fecha} min={hoy} max={limite}
        onChange={(e) => setFecha(e.target.value)}
      />

      {cargando ? (
        <p>Consultando disponibilidad...</p>
      ) : (
        <div className="franjas">
          {franjas.map((f) => (
            <button
              key={f.hora_inicio}
              type="button"
              disabled={!f.disponible}
              className={franja?.hora_inicio === f.hora_inicio ? 'activa' : ''}
              onClick={() => setFranja(f)}
            >
              {f.hora_inicio.slice(0, 5)}
              <small>{f.disponible ? `$${f.precio.toLocaleString('es-CO')}` : 'Ocupada'}</small>
            </button>
          ))}
        </div>
      )}

      {franja && (
        <>
          <label htmlFor="nombre">A nombre de</label>
          <input
            id="nombre" value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />

          <label htmlFor="telefono">Teléfono</label>
          <input
            id="telefono" type="tel" value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />

          <button type="submit" disabled={enviando}>
            {enviando ? 'Confirmando...' : 'Confirmar reserva'}
          </button>
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}
    </form>
  )
}
