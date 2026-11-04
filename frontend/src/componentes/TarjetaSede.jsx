import ImagenSede from './ImagenSede'
import { formatoPesos } from '../lib/formato'
import { fotoSede } from '../lib/imagenes'
import { tiposDe } from '../lib/sedes'
import { temaSede } from '../lib/temas'

// Tarjeta compacta de una sede: toda la tarjeta es el botón para entrar.
export default function TarjetaSede({ sede, onEntrar }) {
  const canchas = sede.canchas ?? []
  const precios = canchas.map((c) => c.precio_hora).filter((p) => p != null)
  const apertura = sede.hora_apertura?.slice(0, 5)
  const cierre = sede.hora_cierre?.slice(0, 5)

  return (
    <button type="button" className={'tarjeta-sede ' + temaSede(sede)} onClick={onEntrar}>
      <ImagenSede
        className="tarjeta-sede-imagen"
        url={fotoSede(sede) ?? sede.logo_url}
        color={sede.color_hex}
        texto={sede.nombre}
        alt={`Cancha de fútbol de la sede ${sede.nombre}`}
      />

      <span className="tarjeta-sede-info">
        <span className="tarjeta-sede-encabezado">
          <span className="tarjeta-sede-nombre">{sede.nombre}</span>
          {precios.length > 0 && (
            <span className="tarjeta-sede-precio">desde {formatoPesos(Math.min(...precios))}/h</span>
          )}
        </span>

        {sede.direccion && <span className="tarjeta-sede-direccion">{sede.direccion}</span>}

        <span className="tarjeta-sede-chips">
          {tiposDe(sede).map((tipo) => <span key={tipo}>{tipo}</span>)}
          <span>{canchas.length} {canchas.length === 1 ? 'cancha' : 'canchas'}</span>
          {apertura && cierre && <span>{apertura}–{cierre}</span>}
        </span>

        <span className="tarjeta-sede-accion">
          Ver horarios <span className="tarjeta-sede-flecha" aria-hidden="true">→</span>
        </span>
      </span>
    </button>
  )
}
