import { temaSede } from '../lib/temas'
import { useDetalleSede } from '../lib/useDetalleSede'
import Partidos from './Partidos'
import Torneos from './Torneos'
import MisReservas from './MisReservas'
import Cargando from '../componentes/Cargando'
import EncabezadoSede from '../componentes/EncabezadoSede'

const TIPOS = {
  partidos: { Contenido: Partidos },
  torneos: { Contenido: Torneos },
  reservas: { Contenido: MisReservas },
}

// Pagina propia para partidos, torneos o las reservas del jugador en una sede.
export default function PaginaPartidos({ slug, tipo = 'partidos', onVolver, onIrSeccion }) {
  const { sede, cargando } = useDetalleSede(slug)

  if (cargando) {
    return <Cargando tamano="grande" />
  }

  if (!sede) {
    return (
      <div className="sede-error">
        <p>No fue posible cargar la sede. Revisa tu conexión e intenta nuevamente.</p>
        <div>
          <button type="button" onClick={onVolver} className="btn-cta-primary">Volver a las sedes</button>
        </div>
      </div>
    )
  }

  const t = TIPOS[tipo] ?? TIPOS.partidos

  return (
    <main className={'pagina-partidos pagina-sede pagina-' + tipo + ' ' + temaSede(sede)}>
      <EncabezadoSede sede={sede} seccion={tipo} onVolver={onVolver} onIrSeccion={onIrSeccion} />

      <div className="partidos-contenedor">
        <t.Contenido sedeId={sede.id} sedeNombre={sede.nombre} />
      </div>
    </main>
  )
}
