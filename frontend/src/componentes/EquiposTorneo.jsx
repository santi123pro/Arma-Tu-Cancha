import { useEffect, useState } from 'react'
import { equiposTorneo } from '../lib/datos'
import { Persona } from './ContactosPartido'

function fechaInscripcion(valor) {
  return new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

// Equipos inscritos en un torneo con el contacto de su capitán. Solo lo
// ve el administrador de la sede; la función equipos_torneo (0013)
// vuelve a revisar el permiso en el servidor.
//
// Se carga al abrirlo, y otra vez cuando cambia el número de inscritos.
export default function EquiposTorneo({ torneo }) {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState({ clave: null, equipos: [], error: null })
  const clave = abierto ? `${torneo.id}|${torneo.cupos_inscritos}` : null

  useEffect(() => {
    if (!clave) return
    let vigente = true
    equiposTorneo(torneo.id).then(({ datos, error }) => {
      if (vigente) setEstado({ clave, equipos: datos ?? [], error })
    })
    return () => { vigente = false }
  }, [clave, torneo.id])

  const cargando = abierto && estado.clave !== clave
  const { equipos, error } = estado

  return (
    <div className="contactos-panel equipos-panel">
      <button
        type="button"
        className="equipos-alternar"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <span>
          👥 Equipos inscritos <em>{torneo.cupos_inscritos}</em>
        </span>
        <span className="equipos-flecha" aria-hidden="true">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        cargando ? (
          <p className="contactos-vacio">Cargando equipos…</p>
        ) : error ? (
          <p className="contactos-vacio">{error}</p>
        ) : equipos.length === 0 ? (
          <p className="contactos-vacio">
            Aún no se ha inscrito ningún equipo. Aquí verás cada equipo con el nombre, el celular y el correo de su capitán.
          </p>
        ) : (
          <ul className="contactos-lista">
            {equipos.map((e) => (
              <Persona
                key={e.inscripcion_id}
                titulo={e.nombre_equipo}
                subtitulo={`Capitán: ${e.capitan_nombre ?? 'Sin nombre'} · inscrito el ${fechaInscripcion(e.inscrito_at)}`}
                contacto={{ nombre: e.capitan_nombre ?? e.nombre_equipo, telefono: e.telefono, correo: e.correo }}
                mensaje={`Hola, ${e.capitan_nombre ?? ''}. Te escribo de ${torneo.sedes?.nombre ?? 'la sede'} por la inscripción de ${e.nombre_equipo} en el torneo ${torneo.nombre}.`}
              />
            ))}
          </ul>
        )
      )}
    </div>
  )
}
