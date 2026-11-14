// ---------------------------------------------------------------------
// Toki, la mascota de Arma Tu Cancha: un balón con cinta de capitán.
// svgToki(estado) devuelve el dibujo como texto SVG. Todo es nuestro y
// fijo (no lleva datos del usuario), así que se puede insertar tal cual.
// Estados: saluda, senala, espera, celebra, piensa, triste, duerme.
// Las clases (toki-ojos, toki-mirada, toki-brazo-saludo, toki-zzz…) son
// las que anima estilos.css.
// ---------------------------------------------------------------------
const C = {
  linea: '#0D1B2A', blanco: '#FFFFFF', sombra: '#D9E1E6', parche: '#0D1B2A',
  verde: '#22C55E', verdeO: '#15803D', naranja: '#F97316', mejilla: '#F97316',
}
const CX = 120, CY = 132, R = 84
const L = `stroke="${C.linea}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`

// Brazo delgado con guante. puntos: hombro, codo, mano.
function brazo([sx, sy], [ex, ey], [hx, hy], { dedo = false, angulo = null, clase = '' } = {}) {
  let g = `<path d="M${sx} ${sy} Q${ex} ${ey} ${hx} ${hy}" fill="none" stroke="${C.linea}" stroke-width="9" stroke-linecap="round"/>`
  g += `<circle cx="${hx}" cy="${hy}" r="13" fill="${C.blanco}" ${L}/>`
  if (dedo) {
    const a = angulo ?? Math.atan2(hy - ey, hx - ex), fx = hx + Math.cos(a) * 17, fy = hy + Math.sin(a) * 17
    g += `<path d="M${hx} ${hy} L${fx} ${fy}" stroke="${C.linea}" stroke-width="12" stroke-linecap="round"/>
      <path d="M${hx} ${hy} L${fx} ${fy}" stroke="${C.blanco}" stroke-width="5" stroke-linecap="round"/>`
  }
  return `<g class="${clase}">${g}</g>`
}

function piernas(tipo = 'normal') {
  const izq = tipo === 'paso' ? [96, 206, 84, 248] : [100, 208, 94, 250]
  const der = tipo === 'paso' ? [142, 208, 156, 246] : [140, 208, 146, 250]
  const bota = (x, y, dir) => `<path d="M${x - 18 * (dir < 0 ? 1 : .2)} ${y + 14} Q${x - 18 * (dir < 0 ? 1 : .2)} ${y - 2} ${x} ${y - 2} Q${x + 18 * (dir > 0 ? 1 : .2)} ${y - 2} ${x + 18 * (dir > 0 ? 1 : .2)} ${y + 14}Z" fill="${C.verde}" ${L}/>
    <path d="M${x - 18 * (dir < 0 ? 1 : .2)} ${y + 14} H${x + 18 * (dir > 0 ? 1 : .2)}" stroke="${C.linea}" stroke-width="5"/>`
  return `<g class="toki-piernas">
    <path d="M${izq[0]} ${izq[1]} L${izq[2]} ${izq[3]}" stroke="${C.linea}" stroke-width="10" stroke-linecap="round"/>
    <path d="M${der[0]} ${der[1]} L${der[2]} ${der[3]}" stroke="${C.linea}" stroke-width="10" stroke-linecap="round"/>
    <path d="M${izq[2] - 3} ${izq[3] - 12} h10 M${der[2] - 5} ${der[3] - 12} h10" stroke="${C.blanco}" stroke-width="5" stroke-linecap="round"/>
    ${bota(izq[2], izq[3], -1)}${bota(der[2], der[3], 1)}
  </g>`
}

function ojosBase(tipo) {
  if (tipo === 'feliz') return `<path d="M88 136 q12-15 24 0 M128 136 q12-15 24 0" fill="none" stroke="${C.linea}" stroke-width="6" stroke-linecap="round"/>`
  if (tipo === 'cerrados') return `<path d="M88 134 q12 8 24 0 M128 134 q12 8 24 0" fill="none" stroke="${C.linea}" stroke-width="6" stroke-linecap="round"/>`
  if (tipo === 'guino') return `<path d="M88 136 q12-13 24 0" fill="none" stroke="${C.linea}" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="140" cy="132" rx="12" ry="15.5" fill="${C.linea}"/><circle cx="144" cy="125" r="4.8" fill="#fff"/><circle cx="136" cy="139" r="2" fill="#fff"/>`
  const dy = tipo === 'arriba' ? -6 : 0, dx = tipo === 'lado' ? 5 : 0
  return `<g class="toki-ojos">
    <ellipse cx="100" cy="132" rx="12" ry="15.5" fill="${C.linea}"/><ellipse cx="140" cy="132" rx="12" ry="15.5" fill="${C.linea}"/>
    <circle cx="${104 + dx}" cy="${125 + dy}" r="4.8" fill="#fff"/><circle cx="${144 + dx}" cy="${125 + dy}" r="4.8" fill="#fff"/>
    <circle cx="${96 + dx}" cy="${139 + dy}" r="2" fill="#fff"/><circle cx="${136 + dx}" cy="${139 + dy}" r="2" fill="#fff"/>
  </g>`
}

function ojos(tipo) {
  return `<g class="toki-mirada">${ojosBase(tipo)}</g>`
}

function cejas(tipo) {
  const c = `fill="none" stroke="${C.linea}" stroke-width="5" stroke-linecap="round"`
  if (tipo === 'tristes') return `<path d="M86 112 L110 106 M154 112 L130 106" ${c}/>`
  if (tipo === 'alzadas') return `<path d="M88 106 q12-7 24 0 M128 106 q12-7 24 0" ${c}/>`
  if (tipo === 'una') return `<path d="M88 110 q12-4 24 0 M128 104 q12-7 24 2" ${c}/>`
  return `<path d="M88 110 q12-6 24 0 M128 110 q12-6 24 0" ${c}/>`
}

function boca(tipo) {
  if (tipo === 'abierta') return `<path d="M104 156 Q120 186 136 156 Z" fill="${C.linea}"/><path d="M111 170 Q120 179 129 170 Q120 165 111 170Z" fill="${C.naranja}"/>`
  if (tipo === 'plana') return `<path d="M110 162 Q120 165 130 161" fill="none" stroke="${C.linea}" stroke-width="5" stroke-linecap="round"/>`
  if (tipo === 'o') return `<ellipse cx="122" cy="163" rx="6" ry="7.5" fill="${C.linea}"/>`
  if (tipo === 'triste') return `<path d="M108 168 Q120 156 132 168" fill="none" stroke="${C.linea}" stroke-width="5" stroke-linecap="round"/>`
  if (tipo === 'dormido') return `<ellipse cx="120" cy="163" rx="5" ry="4" fill="${C.linea}"/>`
  return `<path d="M104 156 Q120 176 136 156" fill="none" stroke="${C.linea}" stroke-width="5.5" stroke-linecap="round"/>`
}

// El balón: cuerpo, parches, cinta y cara.
function balon({ ojo = 'normal', ceja = 'normal', b = 'sonrisa', inclina = 0 }) {
  const p = (x, y, s, r = 0) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 -20 L19 -6 L12 16 L-12 16 L-19 -6Z" fill="${C.parche}"/>`
  return `<g class="toki-cuerpo" transform="rotate(${inclina} ${CX} ${CY + 60})">
    <defs>
      <radialGradient id="tokiBrillo" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F3F6F7"/><stop offset="1" stop-color="${C.sombra}"/></radialGradient>
      <clipPath id="tokiCorte"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
    </defs>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#tokiBrillo)"/>
    <g clip-path="url(#tokiCorte)" opacity=".92">
      ${p(120, 58, 1.05)}${p(52, 150, 1.0, 72)}${p(188, 150, 1.0, -72)}${p(80, 202, 0.95, 144)}${p(160, 202, 0.95, -144)}
      <path d="M120 64 L120 78 M50 124 L62 128 M190 124 L178 128 M74 190 L82 182 M166 190 L158 182" stroke="${C.parche}" stroke-width="3" opacity=".25"/>
    </g>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" ${L} stroke-width="6"/>
    <!-- cinta de capitán en la frente -->
    <path d="M40 98 Q120 58 200 98 L198 116 Q120 78 42 116Z" fill="${C.verde}" ${L}/>
    <path d="M198 100 l18 -8 l-6 16z M199 110 l16 6 l-14 6z" fill="${C.verde}" ${L}/>
    <path d="M76 88 Q120 70 164 88" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>
    ${cejas(ceja)}${ojos(ojo)}
    <ellipse cx="82" cy="156" rx="11" ry="6.5" fill="${C.mejilla}" opacity=".35"/>
    <ellipse cx="158" cy="156" rx="11" ry="6.5" fill="${C.mejilla}" opacity=".35"/>
    ${boca(b)}
    <path d="M62 92 Q72 70 96 60" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".7"/>
  </g>`
}

const ESTADOS = {
  saluda: () => ({
    atras: brazo([42, 150], [22, 168], [26, 196]),
    frente: brazo([198, 128], [226, 112], [222, 74], { clase: 'toki-brazo-saludo' }),
    cuerpo: { ojo: 'guino', b: 'sonrisa', inclina: -4 },
  }),
  senala: () => ({
    atras: brazo([42, 150], [22, 170], [30, 198]),
    frente: brazo([200, 140], [216, 128], [228, 122], { dedo: true, angulo: -0.35 }),
    cuerpo: { ojo: 'lado', b: 'sonrisa', ceja: 'una', inclina: 4 },
  }),
  espera: () => ({
    atras: brazo([42, 150], [24, 170], [30, 198]),
    frente: brazo([200, 148], [222, 180], [204, 200]),
    cuerpo: { ojo: 'lado', b: 'plana', ceja: 'alzadas' },
    extra: `<g class="toki-reloj"><circle cx="210" cy="206" r="24" fill="#fff" ${L}/><rect x="204" y="171" width="12" height="9" rx="2" fill="${C.naranja}" ${L} stroke-width="4"/>
      <path d="M210 186 A20 20 0 0 1 230 206 L210 206Z" fill="${C.verde}" opacity=".6"/>
      <path d="M210 206 V191 M210 206 L220 212" stroke="${C.linea}" stroke-width="4" stroke-linecap="round"/></g>`,
  }),
  celebra: () => ({
    atras: brazo([46, 104], [24, 78], [28, 40]),
    frente: brazo([194, 104], [216, 78], [212, 40]),
    cuerpo: { ojo: 'feliz', b: 'abierta' },
    piernas: 'paso',
    extra: `<g class="toki-confeti">
      <rect x="56" y="14" width="9" height="16" rx="2" fill="${C.naranja}" transform="rotate(-25 60 22)"/>
      <rect x="176" y="10" width="9" height="16" rx="2" fill="${C.verde}" transform="rotate(25 180 18)"/>
      <circle cx="96" cy="18" r="5" fill="#3B82F6"/><circle cx="150" cy="12" r="5" fill="${C.naranja}"/>
      <path d="M120 -6 l4 9 10 1 -7 7 2 10 -9-5 -9 5 2-10 -7-7 10-1z" fill="#FACC15" stroke="${C.linea}" stroke-width="2.5" stroke-linejoin="round"/></g>`,
  }),
  piensa: () => ({
    atras: brazo([42, 150], [24, 170], [30, 198]),
    frente: brazo([196, 170], [178, 196], [150, 186]),
    cuerpo: { ojo: 'arriba', b: 'o', ceja: 'una', inclina: 5 },
    extra: `<g class="toki-pregunta"><circle cx="214" cy="34" r="22" fill="#fff" ${L}/>
      <text x="214" y="45" text-anchor="middle" font-family="'Barlow Condensed', Arial, sans-serif" font-weight="700" font-size="30" fill="${C.verdeO}">?</text>
      <circle cx="194" cy="62" r="6" fill="#fff" ${L} stroke-width="3.5"/></g>`,
  }),
  triste: () => ({
    atras: brazo([42, 160], [36, 190], [50, 210]),
    frente: brazo([198, 160], [204, 190], [190, 210]),
    cuerpo: { ojo: 'normal', b: 'triste', ceja: 'tristes', inclina: 6 },
    extra: `<path d="M84 148 q-5 12 0 17 q5-5 0-17z" fill="#60A5FA"/>`,
  }),
  duerme: () => ({
    atras: brazo([44, 160], [40, 190], [54, 210]),
    frente: brazo([196, 160], [200, 190], [186, 210]),
    cuerpo: { ojo: 'cerrados', b: 'dormido', inclina: 12 },
    extra: `<g class="toki-zzz" font-family="'Barlow Condensed', Arial, sans-serif" font-weight="700" fill="${C.verdeO}">
      <text x="190" y="44" font-size="30">Z</text><text x="212" y="22" font-size="22">z</text><text x="226" y="6" font-size="16">z</text></g>`,
  }),
}

export function svgToki(estado = 'saluda', { ancho = 240 } = {}) {
  const e = (ESTADOS[estado] || ESTADOS.saluda)()
  return `<svg class="toki toki-${estado}" viewBox="-10 -14 260 290" width="${ancho}" height="${Math.round(ancho * 290 / 260)}" role="img" aria-label="Toki, la mascota de Arma Tu Cancha">
    <ellipse cx="120" cy="268" rx="70" ry="7" fill="${C.linea}" opacity=".14"/>
    <defs><filter id="tokiSticker" x="-10%" y="-10%" width="120%" height="120%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="3.5" result="borde"/>
      <feFlood flood-color="#FFFFFF"/><feComposite in2="borde" operator="in" result="blanco"/>
      <feMerge><feMergeNode in="blanco"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g class="toki-todo" filter="url(#tokiSticker)">${piernas(e.piernas)}${e.atras}${balon(e.cuerpo)}${e.frente}${e.extra || ''}</g>
  </svg>`
}

export const ESTADOS_TOKI = Object.keys(ESTADOS)
