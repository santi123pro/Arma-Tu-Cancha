// ---------------------------------------------------------------------
// Fotos locales de sedes y canchas (carpeta frontend/imagenes).
//
// Las tablas no tienen columna de imagen: la foto se elige por el nombre
// del archivo. Para agregar una, basta con guardarla con este formato:
//   cancha_<número>_<sede>.webp   →  cancha_2_bombonera.webp
//   logo_sede_<sede>.webp         →  logo_sede_wembley.webp
// (También sirven .jpeg, .jpg o .png, pero WebP pesa mucho menos.)
// <sede> debe aparecer dentro del slug de la sede en Supabase.
// ---------------------------------------------------------------------

import logo from '../../imagenes/logo.webp'

export { logo }

const archivos = import.meta.glob('../../imagenes/*.{jpeg,jpg,png,webp}', {
  eager: true,
  import: 'default',
})

// 'cancha_2_bombonera' → url
const porNombre = Object.fromEntries(
  Object.entries(archivos).map(([ruta, url]) => [
    ruta.split('/').pop().replace(/\.\w+$/, '').toLowerCase(),
    url,
  ])
)

const clavesSede = [
  ...new Set(
    Object.keys(porNombre)
      .map((n) => n.match(/^(?:cancha_\d+|logo_sede)_(.+)$/)?.[1])
      .filter(Boolean)
  ),
]

export function claveSede(sede) {
  const slug = sede?.slug?.toLowerCase() ?? ''
  return clavesSede.find((k) => slug.includes(k))
}

export function fotoSede(sede) {
  const clave = claveSede(sede)
  return clave ? porNombre[`logo_sede_${clave}`] : undefined
}

// Usa el número del nombre de la cancha: 'Cancha 2' → cancha_2_<sede>.
export function fotoCancha(sede, cancha) {
  const clave = claveSede(sede)
  const numero = cancha?.nombre?.match(/\d+/)?.[0]
  return clave && numero ? porNombre[`cancha_${numero}_${clave}`] : undefined
}
