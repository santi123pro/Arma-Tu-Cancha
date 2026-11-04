import { lazy, Suspense, useState } from 'react'
import { fechaLocal } from '../lib/formato'
import { DIAS_ANTICIPACION, diaSiguiente, hoyTermino } from '../lib/sedes'
import { temaSede } from '../lib/temas'
import { useDetalleSede } from '../lib/useDetalleSede'
import { MINUTOS_PARA_PAGAR } from '../lib/qrGenerico'
import CanchaCard from '../componentes/CanchaCard'
import Cargando from '../componentes/Cargando'
import EncabezadoSede from '../componentes/EncabezadoSede'
import SelectorDia from '../componentes/SelectorDia'

// Leaflet y su CSS solo se descargan al abrir "Cómo llegar".
const MapaSede = lazy(() => import('../componentes/MapasSedes').then((m) => ({ default: m.MapaSede })))

export default function Sede({ slug, onVolver, onIrSeccion }) {
  // detalleSede trae la sede por su slug junto con sus canchas activas
  // (filtradas por sede_id en la relación), así nunca se mezclan sedes.
  const { sede, cargando, reintentar } = useDetalleSede(slug)
  // null: el jugador aún no ha elegido día (ver más abajo cuál se muestra).
  const [fechaElegida, setFechaElegida] = useState(null)
  // En el celular se ve una cancha a la vez: null es la primera, 'todas' las muestra.
  const [canchaElegida, setCanchaElegida] = useState(null)
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
  const canchaVisible = canchaElegida ?? canchas[0]?.id

  return (
    <main className={'pagina-sede ' + temaSede(sede)}>
      <EncabezadoSede sede={sede} seccion="reservar" onVolver={onVolver} onIrSeccion={onIrSeccion} completo />

      <div className="pagina-sede-cuerpo">
        <SelectorDia valor={fecha} onCambio={setFechaElegida} />

        {canchas.length === 0 ? (
          <p className="partidos-aviso">Esta sede todavía no tiene canchas publicadas.</p>
        ) : (
          <>
            {canchas.length > 1 && (
              <div className="filtro-canchas" role="group" aria-label="Elegir cancha">
                <button
                  type="button"
                  className="chip-filtro"
                  aria-pressed={canchaVisible === 'todas'}
                  onClick={() => setCanchaElegida('todas')}
                >
                  Todas
                </button>
                {canchas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="chip-filtro"
                    aria-pressed={canchaVisible === c.id}
                    onClick={() => setCanchaElegida(c.id)}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}

            <div className="lista-canchas">
              {/* Se ocultan con CSS y solo en el celular: en PC se ven todas, y
                  así ninguna pierde la hora elegida ni la reserva en curso. */}
              {canchas.map((c) => (
                <div
                  key={c.id}
                  className={canchaVisible === 'todas' || canchaVisible === c.id ? undefined : 'cancha-oculta-movil'}
                >
                  <CanchaCard
                    cancha={c}
                    sede={sede}
                    fecha={fecha}
                    onVerOtroDia={hayOtroDia ? () => setFechaElegida(diaSiguiente(fecha)) : undefined}
                  />
                </div>
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
          {verMapa && (
            <Suspense fallback={<Cargando tamano="chico" texto="Cargando mapa" />}>
              <MapaSede sede={sede} />
            </Suspense>
          )}
        </details>
      </div>
    </main>
  )
}
