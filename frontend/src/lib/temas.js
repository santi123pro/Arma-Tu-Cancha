import { claveSede } from './imagenes'

// Clase CSS con la paleta de cada sede (ver "Temas por sede" en estilos.css).
// Solo cambia colores: 'tema-sede tema-bombonera', etc. Si la sede no tiene
// tema, se queda con los colores generales de la página.
const TEMAS = ['bombonera', 'bernabeu', 'wembley']

export function temaSede(sede) {
  const clave = claveSede(sede)
  return TEMAS.includes(clave) ? `tema-sede tema-${clave}` : ''
}
