import MisReservas from './MisReservas'

// Las reservas del jugador en todas las sedes, sin tener que entrar a cada una.
export default function TodasMisReservas({ onVolver }) {
  return (
    <main className="pagina-partidos pagina-reservas">
      <section className="partidos-hero" style={{ '--sede-color': '#22c55e' }}>
        <div className="partidos-hero-contenido">
          <div className="partidos-hero-nav">
            <button type="button" className="partidos-hero-volver" onClick={onVolver}>
              ← Volver a las sedes
            </button>
          </div>
          <span className="hero-badge">Mis reservas · Todas las sedes</span>
          <h1 className="partidos-hero-titulo">
            Tus canchas, <span>tus horarios.</span>
          </h1>
          <p className="partidos-hero-desc">
            Todas tus reservas en un solo lugar: las próximas, las que ya jugaste y las canceladas.
          </p>
        </div>
      </section>

      <div className="partidos-contenedor">
        <MisReservas />
      </div>
    </main>
  )
}
