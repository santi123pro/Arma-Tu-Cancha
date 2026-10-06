import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/estilos.css'
import { ToastProvider } from '../src/componentes/Toast'
import CanchaCard from '../src/componentes/CanchaCard'
import MisReservas from '../src/paginas/MisReservas'
import ConfirmarReservas from '../src/componentes/admin/ConfirmarReservas'
import { forzarVencimiento, reiniciar, suscribir } from './datosDemo'

const SEDE = { id: 1, nombre: 'Wembley Norte', slug: 'wembley', color_hex: '#f97316' }
const CANCHAS = [
  { id: 1, nombre: 'Cancha 1', tipo: 'Fútbol 6', precio_hora: 120000 },
  { id: 2, nombre: 'Cancha 2', tipo: 'Fútbol 8', precio_hora: 150000 },
]

function Demo() {
  // Cada cambio en los datos simulados refresca "Mis reservas" y el panel.
  const [version, setVersion] = useState(0)
  const [reinicios, setReinicios] = useState(0)
  useEffect(() => suscribir(() => setVersion((v) => v + 1)), [])

  return (
    <main className="demo-pagina">
      <header className="demo-cabecera">
        <div>
          <span className="hero-badge">Simulación · datos de ejemplo</span>
          <h1>Pago con QR y aprobación de la sede</h1>
          <p>
            Pantallas reales de la app con datos en memoria: nada de lo que hagas aquí toca Supabase.
            A la izquierda eres el jugador; a la derecha, el administrador de la sede.
          </p>
        </div>
        <div className="demo-botones">
          <button type="button" className="btn-torneo-cancelar" onClick={forzarVencimiento}>
            ⏰ Simular que vence el plazo
          </button>
          <button type="button" className="btn-torneo-cancelar" onClick={() => { reiniciar(); setReinicios((n) => n + 1) }}>
            ↺ Reiniciar simulación
          </button>
        </div>
      </header>

      <ol className="demo-pasos">
        <li><strong>Jugador:</strong> elige un horario y pulsa <em>Reservar</em>: se abre la pasarela.</li>
        <li>Elige Nequi o Bre-B, adjunta una imagen como comprobante y pulsa <em>Enviar comprobante</em>.</li>
        <li><strong>Sede:</strong> la reserva aparece en <em>Por verificar</em>. Apruébala o recházala con un motivo.</li>
        <li>Revisa cómo cambia el estado en <em>Mis reservas</em> del jugador.</li>
      </ol>

      <div className="demo-columnas" key={reinicios}>
        <section className="demo-columna">
          <h2 className="demo-titulo">👤 Vista del jugador</h2>
          <div className="canchas-grid demo-canchas">
            {CANCHAS.map((c) => <CanchaCard key={c.id} cancha={c} sede={SEDE} />)}
          </div>
          <div className="pagina-partidos demo-mis-reservas">
            <MisReservas key={version} sedeId={SEDE.id} sedeNombre={SEDE.nombre} />
          </div>
        </section>

        <section className="demo-columna demo-admin">
          <h2 className="demo-titulo">🏟️ Vista del administrador de la sede</h2>
          <ConfirmarReservas key={version} sedeId={SEDE.id} />
        </section>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Demo />
    </ToastProvider>
  </StrictMode>,
)
