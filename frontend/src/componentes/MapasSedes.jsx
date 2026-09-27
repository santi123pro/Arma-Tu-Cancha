import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Coordenadas aproximadas de las tres sedes en Cali.
// Verificalas en Google Maps: clic derecho sobre el punto exacto -> copia lat,lng
const UBICACIONES = {
  'wembley': {
    lat: 3.47905,
    lng: -76.52410,
    nombre: 'Wembley Norte',
    direccion: 'Cl. 58 Nte. #58A-48, Urb. La Flora',
    color: '#2563eb',
  },
  'bernabeu': {
    lat: 3.47358,
    lng: -76.51945,
    nombre: 'Bernabeu',
    direccion: 'Cra. 5 Nte. #52-26',
    color: '#64748b',
  },
  'la-bombonera': {
    lat: 3.47372,
    lng: -76.51968,
    nombre: 'La Bombonera',
    direccion: 'Cra. 5 Nte. #52N-25, Comuna 4',
    color: '#eab308',
  },
}

const CENTRO = [3.4759, -76.5211]

function icono(color) {
  return L.divIcon({
    className: 'marcador-sede',
    html:
      '<div style="background:' + color + ';width:30px;height:30px;' +
      'border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
      'border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  })
}

export default function MapaSedes({ sedes = [], onVerSede }) {
  // Si no llegan sedes de Supabase, mostramos las tres conocidas
  const lista = sedes.length
    ? sedes
    : Object.keys(UBICACIONES).map(function (slug) {
        return { slug: slug, nombre: UBICACIONES[slug].nombre }
      })

  const puntos = lista
    .map(function (sede) {
      const u = UBICACIONES[sede.slug]
      if (!u) return null
      return {
        slug: sede.slug,
        nombre: sede.nombre || u.nombre,
        direccion: u.direccion,
        color: u.color,
        lat: u.lat,
        lng: u.lng,
      }
    })
    .filter(Boolean)

  return (
    <div style={{ width: '100%' }}>
      <MapContainer
        center={CENTRO}
        zoom={16}
        scrollWheelZoom={false}
        style={{ height: 420, width: '100%', zIndex: 1 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {puntos.map(function (p) {
          return (
            <Marker key={p.slug} position={[p.lat, p.lng]} icon={icono(p.color)}>
              <Popup>
                <strong style={{ fontSize: 15 }}>{p.nombre}</strong>
                <br />
                <span style={{ color: '#64748b', fontSize: 13 }}>{p.direccion}</span>
                <br />
                <button
                  type="button"
                  onClick={function () {
                    if (onVerSede) onVerSede(p.slug)
                  }}
                  style={{
                    marginTop: 8,
                    background: '#22c55e',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 7,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Ver canchas
                </button>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
