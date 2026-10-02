// Celebración al crear un partido o un torneo: un balón sale del fondo,
// golpea la pantalla (temblor + grieta) y cae. Devuelve una promesa que
// se resuelve cuando termina, para mostrar el mensaje de "listo" después.
//
// No usa React: se pinta directo en el body y se borra solo. Con
// "reducir movimiento" activado en el sistema, se salta la animación.

const DURACION_MS = 1300

const BALON = `
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="47" fill="#fff" stroke="#0f172a" stroke-width="3"/>
    <path d="M50 30 l15 11 -6 18 h-18 l-6 -18 z" fill="#0f172a"/>
    <path d="M50 30 v-24 M65 41 l21 -8 M59 59 l13 19 M41 59 l-13 19 M35 41 l-21 -8"
          stroke="#0f172a" stroke-width="3" fill="none"/>
    <path d="M50 6 l-9 6 M50 6 l9 6 M86 33 l-2 11 M86 33 l-9 -6 M72 78 l-11 2 M72 78 l3 -10
             M28 78 l11 2 M28 78 l-3 -10 M14 33 l2 11 M14 33 l9 -6"
          stroke="#0f172a" stroke-width="3" fill="none"/>
  </svg>`

// Grieta tipo vidrio que sale del punto del golpe.
const GRIETA = `
  <svg viewBox="-100 -100 200 200" aria-hidden="true">
    <g stroke="rgba(255,255,255,.95)" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M0 0 L22 -8 L48 -14 L80 -30 L98 -34"/>
      <path d="M0 0 L-18 -20 L-30 -46 L-52 -70 L-60 -96"/>
      <path d="M0 0 L-26 6 L-54 2 L-82 16 L-98 14"/>
      <path d="M0 0 L8 26 L4 52 L18 78 L16 98"/>
      <path d="M0 0 L20 18 L44 30 L60 58 L84 70"/>
      <path d="M0 0 L4 -24 L16 -50 L12 -80"/>
      <path d="M0 0 L-16 20 L-40 34 L-58 62"/>
      <path d="M22 -8 L30 10 M-30 -46 L-12 -52 M-54 2 L-48 -18 M4 52 L-14 60 M44 30 L52 12"/>
      <circle r="9" stroke-width="2"/>
      <circle r="18" stroke-width="1" stroke-dasharray="6 9"/>
    </g>
  </svg>`

export function balonazo() {
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reducido) return Promise.resolve()

  const capa = document.createElement('div')
  capa.className = 'balonazo'
  capa.setAttribute('aria-hidden', 'true')
  capa.innerHTML =
    '<div class="balonazo-destello"></div>' +
    '<div class="balonazo-grieta">' + GRIETA + '</div>' +
    '<div class="balonazo-balon">' + BALON + '</div>'
  document.body.appendChild(capa)
  document.body.classList.add('balonazo-temblor')

  return new Promise((resolver) => {
    setTimeout(() => {
      capa.remove()
      document.body.classList.remove('balonazo-temblor')
      resolver()
    }, DURACION_MS)
  })
}
