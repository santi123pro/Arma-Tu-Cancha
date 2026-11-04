import { useEffect, useState } from 'react'
import { listarSedes } from '../lib/datos'
import { tiposDe } from '../lib/sedes'
import TarjetaSede from '../componentes/TarjetaSede'
import Cargando from '../componentes/Cargando'

// soloSedeId: el admin de sede solo ve la sede que administra.
export default function Marketplace({ soloSedeId = null, onElegirSede }) {
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tipoElegido, setTipoElegido] = useState(null)

  useEffect(() => {
    listarSedes().then(({ datos, error }) => {
      if (error) setError(error)
      else setSedes((datos ?? []).filter((s) => !soloSedeId || s.id === soloSedeId))
      setCargando(false)
    })
  }, [soloSedeId])

  if (cargando) {
    return <Cargando tamano="grande" texto="Cargando sedes" />
  }

  if (error) {
    return <p className="sedes-mensaje sedes-mensaje-error">{error}</p>
  }

  if (!sedes.length) {
    return (
      <p className="sedes-mensaje">
        Todavía no hay sedes publicadas.
        <br />
        <small>Vuelve pronto o escríbenos si administras una sede.</small>
      </p>
    )
  }

  const tipos = [...new Set(sedes.flatMap(tiposDe))]
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const sedesVisibles = tipoElegido
    ? sedes.filter((s) => tiposDe(s).includes(tipoElegido))
    : sedes

  return (
    <section className="pagina-sedes">
      <h2>Elige dónde jugar</h2>
      <p className="pagina-sedes-subtitulo">
        Toca una sede para ver sus canchas y horarios disponibles.
      </p>

      {tipos.length > 1 && (
        <div className="filtro-sedes" role="group" aria-label="Filtrar por tipo de cancha">
          <ChipFiltro activo={!tipoElegido} onClick={() => setTipoElegido(null)}>Todas</ChipFiltro>
          {tipos.map((tipo) => (
            <ChipFiltro key={tipo} activo={tipoElegido === tipo} onClick={() => setTipoElegido(tipo)}>
              {tipo}
            </ChipFiltro>
          ))}
        </div>
      )}

      <div className="lista-sedes">
        {sedesVisibles.map((s) => (
          <TarjetaSede key={s.id} sede={s} onEntrar={() => onElegirSede(s.slug)} />
        ))}
      </div>
    </section>
  )
}

function ChipFiltro({ activo, onClick, children }) {
  return (
    <button type="button" className="chip-filtro" aria-pressed={activo} onClick={onClick}>
      {children}
    </button>
  )
}
