import { fotoSede } from '../lib/imagenes'
import { formatoPesos } from '../lib/formato'
import Icono from './Icono'

const SECCIONES = [
  { id: 'reservar', texto: 'Reservar' },
  { id: 'partidos', texto: 'Partidos' },
  { id: 'torneos', texto: 'Torneos' },
  { id: 'reservas', texto: 'Mis reservas' },
]

// Cabecera común de una sede con sus pestañas. Completa en "Reservar" y
// reducida en las demás secciones, para que el contenido quede a la vista.
export default function EncabezadoSede({ sede, seccion, onVolver, onIrSeccion, completo = false }) {
  const canchas = sede.canchas ?? []
  const foto = fotoSede(sede)
  const apertura = sede.hora_apertura?.slice(0, 5)
  const cierre = sede.hora_cierre?.slice(0, 5)

  return (
    <>
      <header
        className={'encabezado-sede' + (completo ? ' encabezado-sede-completo' : '')}
        style={{ '--sede-color': sede.color_hex ?? '#22c55e' }}
      >
        <div className="encabezado-sede-interior">
          {completo && foto && (
            <img className="encabezado-sede-foto" src={foto} alt={`Portada de la sede ${sede.nombre}`} />
          )}

          <div className="encabezado-sede-texto">
            <button type="button" className="encabezado-sede-volver" onClick={onVolver}>
              <Icono nombre="volver" /> Sedes
            </button>
            <h1>{sede.nombre}</h1>

            {completo && (
              <>
                <p className="encabezado-sede-direccion">{sede.direccion}</p>
                {sede.telefono && (
                  <a className="encabezado-sede-telefono" href={`tel:${sede.telefono.replace(/[^\d+]/g, '')}`}>
                    <Icono nombre="telefono" /> {sede.telefono}
                  </a>
                )}
                <dl className="marcador-sede">
                  <div>
                    <dt>Canchas</dt>
                    <dd>{canchas.length}</dd>
                  </div>
                  {canchas.length > 0 && (
                    <div>
                      <dt>Desde, por hora</dt>
                      <dd>{formatoPesos(Math.min(...canchas.map((c) => c.precio_hora)))}</dd>
                    </div>
                  )}
                  {apertura && cierre && (
                    <div>
                      <dt>Horario</dt>
                      <dd>{apertura}–{cierre}</dd>
                    </div>
                  )}
                </dl>
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="nav-sede" aria-label={`Secciones de ${sede.nombre}`} style={{ '--sede-color': sede.color_hex ?? '#22c55e' }}>
        <div className="nav-sede-interior">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={s.id === seccion ? 'page' : undefined}
              onClick={() => s.id !== seccion && onIrSeccion(s.id)}
            >
              {s.texto}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
