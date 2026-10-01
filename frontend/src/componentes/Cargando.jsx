// Indicador de carga: un jugador que patea el balón una y otra vez.
//
// tamano: 'grande' para pantallas completas, 'mediano' para listas y
// 'chico' dentro de tarjetas (por ejemplo, los horarios de una cancha).
export default function Cargando({ texto = 'Cargando…', tamano = 'mediano' }) {
  return (
    <div className={'cargando cargando-' + tamano} role="status" aria-live="polite">
      <svg className="cargando-escena" viewBox="0 0 200 120" aria-hidden="true">
        {/* Cancha */}
        <line className="cargando-piso" x1="10" y1="106" x2="190" y2="106" />
        <ellipse className="cargando-sombra-balon" cx="72" cy="107" rx="7" ry="2" />

        {/* Jugador */}
        <g className="cargando-jugador">
          <g className="cargando-brazo-atras">
            <line x1="50" y1="48" x2="38" y2="64" />
          </g>
          <line className="cargando-pierna" x1="47" y1="72" x2="42" y2="103" />
          <path className="cargando-zapato" d="M37 103 h9 v3 h-9 z" />
          <g className="cargando-pierna-patea">
            <line className="cargando-pierna" x1="53" y1="72" x2="56" y2="102" />
            <path className="cargando-zapato" d="M53 102 h10 v4 h-10 z" />
          </g>
          <rect className="cargando-short" x="43" y="66" width="14" height="10" rx="3" />
          <rect className="cargando-camiseta" x="42" y="44" width="16" height="25" rx="5" />
          <text className="cargando-numero" x="50" y="61">10</text>
          <g className="cargando-brazo-adelante">
            <line x1="52" y1="48" x2="64" y2="62" />
          </g>
          <circle className="cargando-cabeza" cx="50" cy="35" r="8" />
          <path className="cargando-pelo" d="M42 34 a8 8 0 0 1 16 0 q-8 -4 -16 0 z" />
        </g>

        {/* Balón */}
        <g className="cargando-vuelo">
          <g className="cargando-balon">
            <circle cx="72" cy="99" r="7" className="cargando-balon-fondo" />
            <path d="M72 95.5 l3.3 2.4 -1.3 3.9 h-4 l-1.3 -3.9 z" className="cargando-balon-parche" />
          </g>
        </g>
      </svg>
      {texto && <p className="cargando-texto">{texto}</p>}
    </div>
  )
}
