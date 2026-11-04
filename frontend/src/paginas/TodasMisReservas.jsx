import MisReservas from './MisReservas'

// Las reservas del jugador en todas las sedes, sin tener que entrar a cada una.
export default function TodasMisReservas() {
  return (
    <main className="pagina-partidos pagina-reservas">
      <header className="encabezado-pagina">
        <h1>Mis reservas</h1>
        <p>Las próximas, las que ya jugaste y las canceladas, de todas las sedes.</p>
      </header>

      <div className="partidos-contenedor">
        <MisReservas />
      </div>
    </main>
  )
}
