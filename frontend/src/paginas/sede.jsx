import { useState } from 'react'
import { fechaLocal } from '../lib/formato'
import { DIAS_ANTICIPACION, diaSiguiente, hoyTermino } from '../lib/sedes'
import { temaSede } from '../lib/temas'
import { useDetalleSede } from '../lib/useDetalleSede'
import { MINUTOS_PARA_PAGAR } from '../lib/qrGenerico'
import CanchaCard from '../componentes/CanchaCard'
import Cargando from '../componentes/Cargando'
import EncabezadoSede from '../componentes/EncabezadoSede'
import { MapaSede } from '../componentes/MapasSedes'
import SelectorDia from '../componentes/SelectorDia'

export default function Sede({ slug, onVolver, onIrSeccion }) {
  // detalleSede trae la sede por su slug junto con sus canchas activas
  // (filtradas por sede_id en la relación), así nunca se mezclan sedes.
  const { sede, cargando, reintentar } = useDetalleSede(slug)
  // null: el jugador aún no ha elegido día (ver más abajo cuál se muestra).
  const [fechaElegida, setFechaElegida] = useState(null)
  // El mapa se crea al abrir la sección: Leaflet no sabe medirse estando oculto.
  const [verMapa, setVerMapa] = useState(false)

  if (cargando) {
    return <Cargando tamano="grande" texto="Cargando canchas" />
  }

  // Si falla la actualización pero ya hay una copia de la sede, se sigue mostrando.
  if (!sede) {
    return (
      <div className="sede-error">
        <p>No fue posible cargar las canchas. Revisa tu conexión e intenta nuevamente.</p>
        <div>
          <button type="button" onClick={reintentar} className="btn-cta-primary">Reintentar</button>
          <button type="button" onClick={onVolver} className="btn-elegir-dia">Volver a las sedes</button>
        </div>
      </div>
    )
  }

  const canchas = [...(sede.canchas ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre))
  // De noche, si ya no quedan franjas hoy, la página abre directo en mañana.
  const fecha = fechaElegida ?? fechaLocal(hoyTermino(sede) ? 1 : 0)
  const hayOtroDia = fecha < fechaLocal(DIAS_ANTICIPACION)

  return (
    <main className={'pagina-sede ' + temaSede(sede)}>
      <EncabezadoSede sede={sede} seccion="reservar" onVolver={onVolver} onIrSeccion={onIrSeccion} completo />

      <div className="pagina-sede-cuerpo">
        <SelectorDia valor={fecha} onCambio={setFechaElegida} />

        {canchas.length === 0 ? (
          <p className="partidos-aviso">Esta sede todavía no tiene canchas publicadas.</p>
        ) : (
          <>
            <div className="lista-canchas">
              {canchas.map((c) => (
                <CanchaCard
                  key={c.id}
                  cancha={c}
                  sede={sede}
                  fecha={fecha}
                  onVerOtroDia={hayOtroDia ? () => setFechaElegida(diaSiguiente(fecha)) : undefined}
                />
              ))}
            </div>
            <p className="sede-nota-pago">
              Pagas con QR de Nequi o Bre-B en los siguientes {MINUTOS_PARA_PAGAR} minutos.
              La reserva queda confirmada cuando la sede verifica el pago.
            </p>
          </>
        )}

        <details className="sede-detalles" onToggle={(e) => setVerMapa(e.currentTarget.open)}>
          <summary>Sobre la sede y cómo llegar</summary>
          {sede.descripcion && <p>{sede.descripcion}</p>}
          {verMapa && <MapaSede sede={sede} />}
        </details>
      </div>
    </main>
  )
}
