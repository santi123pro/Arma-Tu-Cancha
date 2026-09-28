import ImagenSede from './ImagenSede'

// Tarjeta horizontal grande de una sede:
// imagen arriba y, debajo, tres zonas (nombre + descripcion | Entrar | ubicacion).
export default function TarjetaSede({ sede, onEntrar }) {
  const totalCanchas = sede.canchas?.length ?? 0
  const apertura = sede.hora_apertura?.slice(0, 5)
  const cierre = sede.hora_cierre?.slice(0, 5)

  return (
    <article className="tarjeta-sede">
      <ImagenSede
        className="tarjeta-sede-imagen"
        url={sede.logo_url}
        color={sede.color_hex}
        texto={sede.nombre}
      />

      <div className="tarjeta-sede-info">
        <div className="tarjeta-sede-zona">
          <h3>{sede.nombre}</h3>
          <p>{sede.descripcion ?? 'Canchas sintéticas disponibles.'}</p>
        </div>

        <div className="tarjeta-sede-zona tarjeta-sede-centro">
          <button type="button" className="btn-cta-primary" onClick={onEntrar}>
            Entrar
          </button>
        </div>

        <div className="tarjeta-sede-zona">
          <h4>Ubicación</h4>
          {sede.direccion && <p>📍 {sede.direccion}</p>}
          {apertura && cierre && <p>🕒 {apertura} – {cierre}</p>}
          <p>{totalCanchas} {totalCanchas === 1 ? 'cancha' : 'canchas'}</p>
        </div>
      </div>
    </article>
  )
}
