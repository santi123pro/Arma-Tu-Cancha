// Imagen de cabecera de una tarjeta. Si no hay URL, se usa el respaldo
// visual de la sede: su color de fondo con su nombre encima.
// alt: descripción de la foto para lectores de pantalla (por defecto, texto).
export default function ImagenSede({ url, color, texto, alt, className = '' }) {
  return (
    <div className={`imagen-sede ${className}`} style={{ background: color ?? '#2563eb' }}>
      {url ? <img src={url} alt={alt ?? texto} /> : <span>{texto}</span>}
    </div>
  )
}
