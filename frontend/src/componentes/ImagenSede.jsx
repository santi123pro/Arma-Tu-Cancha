// Imagen de cabecera de una tarjeta. Si no hay URL, se usa el respaldo
// visual de la sede: su color de fondo con su nombre encima.
export default function ImagenSede({ url, color, texto, className = '' }) {
  return (
    <div className={`imagen-sede ${className}`} style={{ background: color ?? '#2563eb' }}>
      {url ? <img src={url} alt={texto} /> : <span>{texto}</span>}
    </div>
  )
}
