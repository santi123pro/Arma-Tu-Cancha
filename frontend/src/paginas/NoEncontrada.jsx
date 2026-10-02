// Página 404: la dirección no existe dentro de la app.
export default function NoEncontrada({ onInicio }) {
  return (
    <main className="pagina-estado">
      <div className="estado-tarjeta">
        <p className="estado-numero" aria-hidden="true">4<span>⚽</span>4</p>
        <h1>Esta jugada se fue por la línea de fondo</h1>
        <p>La página que buscas no existe o cambió de lugar.</p>
        <button type="button" className="btn-cta-primary" onClick={onInicio}>
          Volver al inicio
        </button>
      </div>
    </main>
  )
}
