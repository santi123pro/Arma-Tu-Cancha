import { useState } from 'react'
import { SERIES, compacto, formatoNumero } from '../../lib/formato'

// Máximo "redondo" para el eje: 1, 2 o 5 × 10^n.
function maximoLimpio(max) {
  if (max <= 0) return 4
  const paso = max / 4
  const base = 10 ** Math.floor(Math.log10(paso))
  const f = paso / base
  const limpio = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return limpio * base * 4
}

// ── Tooltip compartido ─────────────────────────────────────────────
function useTooltip() {
  const [tip, setTip] = useState(null)

  function mostrar(e, contenido) {
    setTip({ x: e.clientX, y: e.clientY, contenido })
  }

  function ocultar() {
    setTip(null)
  }

  const nodo = tip && (
    <div className="viz-tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.contenido}
    </div>
  )

  return { mostrar, ocultar, nodo }
}

function ContenidoTip({ titulo, filas }) {
  return (
    <>
      <strong>{titulo}</strong>
      {filas.map(([color, nombre, valor]) => (
        <span key={nombre} className="viz-tooltip-fila">
          {color && <i style={{ background: color }} />}
          {nombre}
          <b>{valor}</b>
        </span>
      ))}
    </>
  )
}

// ── Columnas en el tiempo (una serie) ──────────────────────────────
// datos: [{ etiqueta, valor, detalle }]
export function Columnas({ datos, nombre, formato = formatoNumero, alto = 220 }) {
  const { mostrar, ocultar, nodo } = useTooltip()
  const [activa, setActiva] = useState(null)

  const ancho = 640
  const margen = { arriba: 12, derecha: 8, abajo: 26, izquierda: 44 }
  const areaAncho = ancho - margen.izquierda - margen.derecha
  const areaAlto = alto - margen.arriba - margen.abajo
  const max = maximoLimpio(Math.max(0, ...datos.map((d) => d.valor)))
  const ranura = areaAncho / Math.max(datos.length, 1)
  const barra = Math.min(24, ranura * 0.62)
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const cadaCuanto = Math.ceil(datos.length / 8)

  return (
    <div className="viz-scroll">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="viz-svg" role="img" aria-label={nombre}>
        {marcas.map((m) => {
          const y = margen.arriba + areaAlto - (m / max) * areaAlto
          return (
            <g key={m}>
              <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={y} y2={y} className="viz-grid" />
              <text x={margen.izquierda - 8} y={y + 4} className="viz-eje" textAnchor="end">
                {compacto.format(m)}
              </text>
            </g>
          )
        })}

        {datos.map((d, i) => {
          const h = (d.valor / max) * areaAlto
          const x = margen.izquierda + i * ranura + (ranura - barra) / 2
          const y = margen.arriba + areaAlto - h
          const r = Math.min(4, h)
          const camino = h > 0
            ? `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barra - r},${y} Q${x + barra},${y} ${x + barra},${y + r} L${x + barra},${y + h} Z`
            : null

          return (
            <g key={d.etiqueta}>
              {camino && <path d={camino} fill={SERIES[0]} opacity={activa === null || activa === i ? 1 : 0.45} />}
              {i % cadaCuanto === 0 && (
                <text x={x + barra / 2} y={alto - 8} className="viz-eje" textAnchor="middle">
                  {d.etiqueta}
                </text>
              )}
              {/* zona de hover más grande que la barra */}
              <rect
                x={margen.izquierda + i * ranura} y={margen.arriba} width={ranura} height={areaAlto}
                fill="transparent"
                onMouseMove={(e) => {
                  setActiva(i)
                  mostrar(e, <ContenidoTip titulo={d.detalle ?? d.etiqueta} filas={[[SERIES[0], nombre, formato(d.valor)]]} />)
                }}
                onMouseLeave={() => { setActiva(null); ocultar() }}
              />
            </g>
          )
        })}
        <line
          x1={margen.izquierda} x2={ancho - margen.derecha}
          y1={margen.arriba + areaAlto} y2={margen.arriba + areaAlto}
          className="viz-base"
        />
      </svg>
      {nodo}
    </div>
  )
}

// ── Barras horizontales (una serie) ────────────────────────────────
// datos: [{ etiqueta, valor }]
export function BarrasH({ datos, nombre, formato = formatoNumero, color = SERIES[0] }) {
  const { mostrar, ocultar, nodo } = useTooltip()
  const max = Math.max(1, ...datos.map((d) => d.valor))

  if (!datos.length) return <p className="viz-vacio">Sin datos todavía.</p>

  return (
    <div className="viz-barras" role="list" aria-label={nombre}>
      {datos.map((d) => (
        <div
          key={d.etiqueta}
          className="viz-barra-fila"
          role="listitem"
          onMouseMove={(e) => mostrar(e, <ContenidoTip titulo={d.etiqueta} filas={[[color, nombre, formato(d.valor)]]} />)}
          onMouseLeave={ocultar}
        >
          <span className="viz-barra-etiqueta">{d.etiqueta}</span>
          <span className="viz-barra-pista">
            <span className="viz-barra" style={{ width: `${(d.valor / max) * 100}%`, background: color }} />
            <span className="viz-barra-valor">{formato(d.valor)}</span>
          </span>
        </div>
      ))}
      {nodo}
    </div>
  )
}

// ── Barras agrupadas (hasta 3 series) ──────────────────────────────
// grupos: [{ etiqueta, valores: [n, n, n] }]   series: ['Canchas', ...]
export function BarrasAgrupadas({ grupos, series }) {
  const { mostrar, ocultar, nodo } = useTooltip()
  const max = Math.max(1, ...grupos.flatMap((g) => g.valores))

  if (!grupos.length) return <p className="viz-vacio">Sin datos todavía.</p>

  return (
    <div>
      <Leyenda elementos={series.map((s, i) => ({ nombre: s, color: SERIES[i] }))} />
      <div className="viz-grupos">
        {grupos.map((g) => (
          <div
            key={g.etiqueta}
            className="viz-grupo"
            onMouseMove={(e) =>
              mostrar(e, <ContenidoTip titulo={g.etiqueta} filas={series.map((s, i) => [SERIES[i], s, formatoNumero(g.valores[i])])} />)
            }
            onMouseLeave={ocultar}
          >
            <span className="viz-grupo-titulo">{g.etiqueta}</span>
            {g.valores.map((v, i) => (
              <span className="viz-barra-pista" key={series[i]}>
                <span className="viz-barra" style={{ width: `${(v / max) * 100}%`, background: SERIES[i] }} />
                <span className="viz-barra-valor">{formatoNumero(v)}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      {nodo}
    </div>
  )
}

// ── Dona (hasta 3 categorías) ──────────────────────────────────────
// datos: [{ etiqueta, valor }]
export function Dona({ datos, nombre, centro }) {
  const { mostrar, ocultar, nodo } = useTooltip()
  const total = datos.reduce((n, d) => n + d.valor, 0)
  const radio = 70
  const grosor = 22
  const circ = 2 * Math.PI * radio
  const hueco = total > 0 && datos.filter((d) => d.valor > 0).length > 1 ? 3 : 0

  const largos = datos.map((d) => (total ? (d.valor / total) * circ : 0))
  const arcos = datos.map((d, i) => ({
    ...d,
    color: SERIES[i],
    largo: Math.max(largos[i] - hueco, 0),
    inicio: largos.slice(0, i).reduce((a, b) => a + b, 0),
  }))

  return (
    <div className="viz-dona">
      <svg viewBox="0 0 200 200" className="viz-dona-svg" role="img" aria-label={nombre}>
        <circle cx="100" cy="100" r={radio} fill="none" className="viz-dona-pista" strokeWidth={grosor} />
        {arcos.map((a) => a.largo > 0 && (
          <circle
            key={a.etiqueta}
            cx="100" cy="100" r={radio} fill="none"
            stroke={a.color} strokeWidth={grosor}
            strokeDasharray={`${a.largo} ${circ - a.largo}`}
            strokeDashoffset={-a.inicio}
            transform="rotate(-90 100 100)"
            className="viz-dona-arco"
            onMouseMove={(e) => mostrar(e, (
              <ContenidoTip
                titulo={a.etiqueta}
                filas={[[a.color, nombre, `${formatoNumero(a.valor)} (${Math.round((a.valor / total) * 100)}%)`]]}
              />
            ))}
            onMouseLeave={ocultar}
          />
        ))}
        <text x="100" y="98" textAnchor="middle" className="viz-dona-total">{formatoNumero(total)}</text>
        <text x="100" y="118" textAnchor="middle" className="viz-dona-sub">{centro}</text>
      </svg>
      <Leyenda
        vertical
        elementos={arcos.map((a) => ({ nombre: a.etiqueta, color: a.color, valor: formatoNumero(a.valor) }))}
      />
      {nodo}
    </div>
  )
}

export function Leyenda({ elementos, vertical = false }) {
  return (
    <ul className={'viz-leyenda' + (vertical ? ' viz-leyenda-vertical' : '')}>
      {elementos.map((e) => (
        <li key={e.nombre}>
          <i style={{ background: e.color }} />
          {e.nombre}
          {e.valor != null && <b>{e.valor}</b>}
        </li>
      ))}
    </ul>
  )
}

// Tarjeta de cifra: etiqueta, valor y una línea de contexto.
export function Cifra({ etiqueta, valor, detalle, icono }) {
  return (
    <div className="viz-cifra">
      <span className="viz-cifra-etiqueta">{icono} {etiqueta}</span>
      <strong className="viz-cifra-valor">{valor}</strong>
      {detalle && <span className="viz-cifra-detalle">{detalle}</span>}
    </div>
  )
}
