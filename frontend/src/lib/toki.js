// Avisos para Toki desde cualquier parte de la app, sin pasar props:
//   avisarToki('celebra', '¡Cancha confirmada!')
// Toki (componentes/Toki.jsx) escucha el evento y cambia de gesto; si hay
// mensaje lo muestra en su globo unos segundos y luego vuelve a su gesto
// de la pantalla.
export function avisarToki(estado, mensaje = '', { duracion = 6000 } = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('toki', { detail: { estado, mensaje, duracion } }))
}
