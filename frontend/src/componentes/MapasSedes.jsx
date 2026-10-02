import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fotoSede } from '../lib/imagenes'
import ImagenSede from './ImagenSede'

// Coordenadas aproximadas de las tres sedes en Cali.
// Verificalas en Google Maps: clic derecho sobre el punto exacto -> copia lat,lng
const UBICACIONES = {
  'wembley': {
    lat: 3.47905,
    lng: -76.52410,
    nombre: 'Wembley Norte',
    direccion: 'Cl. 58 Nte. #58A-48, Urb. La Flora',
    color: '#f97316',
  },
  'bernabeu': {
    lat: 3.47358,
    lng: -76.51945,
    nombre: 'Bernabeu',
    direccion: 'Cra. 5 Nte. #52-26',
    color: '#c9a227',
  },
  'la-bombonera': {
    lat: 3.47372,
    lng: -76.51968,
    nombre: 'La Bombonera',
    direccion: 'Cra. 5 Nte. #52N-25, Comuna 4',
    color: '#facc15',
  },
}

const CENTRO = [3.4759, -76.5211]
const ZOOM_INICIAL = 16

function icono(color, letra, activo) {
  return L.divIcon({
    className: 'marcador-sede' + (activo ? ' marcador-activo' : ''),
    html:
      '<span class="marcador-pulso" style="background:' + color + '"></span>' +
      '<span class="marcador-pin" style="background:' + color + '">' +
      '<span class="marcador-letra">' + letra + '</span></span>',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34],
  })
}

function comoLlegar(p) {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng
}

// Mueve la camara cuando cambia la sede activa y abre su popup.
function Camara({ slug, lat, lng, marcadores }) {
  const map = useMap()

  useEffect(
    function () {
      if (!slug) return
      map.flyTo([lat, lng], 17, { duration: 0.8 })
      map.once('moveend', function () {
        marcadores.current[slug]?.openPopup()
      })
    },
    [slug, lat, lng, map, marcadores]
  )

  return null
}

function BotonCentrar({ puntos }) {
  const map = useMap()
  const boton = useRef(null)

  // Sin esto, el clic o el arrastre sobre el boton tambien mueven el mapa.
  useEffect(function () {
    if (boton.current) L.DomEvent.disableClickPropagation(boton.current)
  }, [])

  function centrar() {
    map.closePopup()
    if (puntos.length) {
      map.flyToBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])), {
        padding: [60, 60],
        maxZoom: ZOOM_INICIAL,
        duration: 0.8,
      })
    } else {
      map.flyTo(CENTRO, ZOOM_INICIAL)
    }
  }

  return (
    <button ref={boton} type="button" className="mapa-centrar" onClick={centrar} title="Ver todas las sedes">
      ⤢
    </button>
  )
}

export default function MapaSedes({ sedes = [], onVerSede }) {
  const [activa, setActiva] = useState(null)
  const marcadores = useRef({})

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
        sede: sede,
        slug: sede.slug,
        nombre: sede.nombre || u.nombre,
        direccion: sede.direccion || u.direccion,
        color: u.color,
        foto: fotoSede(sede) ?? sede.logo_url,
        apertura: sede.hora_apertura?.slice(0, 5),
        cierre: sede.hora_cierre?.slice(0, 5),
        canchas: sede.canchas?.length,
        lat: u.lat,
        lng: u.lng,
      }
    })
    .filter(Boolean)

  const puntoActivo = puntos.find((p) => p.slug === activa) ?? null

  return (
    <div className="mapa-marco">
      <aside className="mapa-lista">
        <p className="mapa-lista-titulo">{puntos.length} {puntos.length === 1 ? 'sede' : 'sedes'} en el norte de Cali</p>

        {puntos.map(function (p) {
          return (
            <button
              type="button"
              key={p.slug}
              className={'mapa-item' + (p.slug === activa ? ' mapa-item-activo' : '')}
              style={{ '--color-sede': p.color }}
              onClick={function () {
                if (p.slug === activa) marcadores.current[p.slug]?.openPopup()
                else setActiva(p.slug)
              }}
            >
              <ImagenSede className="mapa-item-foto" url={p.foto} color={p.color} texto={p.nombre[0]} />
              <span className="mapa-item-texto">
                <strong>{p.nombre}</strong>
                <small>{p.direccion}</small>
              </span>
              <span className="mapa-item-punto" />
            </button>
          )
        })}
      </aside>

      <div className="mapa-lienzo">
        <div className="mapa-barra">
          <span className="mapa-barra-puntos" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="mapa-barra-texto">
            📍 {puntoActivo ? puntoActivo.nombre : 'Cali, Valle del Cauca'}
          </span>
          <span className="badge-activo">
            <span className="punto-vivo" /> EN VIVO
          </span>
        </div>

        <MapContainer
          center={CENTRO}
          zoom={ZOOM_INICIAL}
          scrollWheelZoom={false}
          zoomControl={false}
          className="mapa-leaflet"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
          <ZoomControl position="bottomright" />
          <Camara
            slug={puntoActivo?.slug}
            lat={puntoActivo?.lat}
            lng={puntoActivo?.lng}
            marcadores={marcadores}
          />
          <BotonCentrar puntos={puntos} />

          {puntos.map(function (p) {
            return (
              <Marker
                key={p.slug}
                position={[p.lat, p.lng]}
                icon={icono(p.color, p.nombre[0], p.slug === activa)}
                zIndexOffset={p.slug === activa ? 1000 : 0}
                ref={(m) => { marcadores.current[p.slug] = m }}
                eventHandlers={{ click: () => setActiva(p.slug) }}
              >
                <Popup className="popup-sede" closeButton={false} minWidth={240} maxWidth={260}>
                  <ImagenSede className="popup-foto" url={p.foto} color={p.color} texto={p.nombre} />
                  <div className="popup-cuerpo">
                    <strong>{p.nombre}</strong>
                    <span>📍 {p.direccion}</span>
                    {(p.apertura || p.canchas != null) && (
                      <span className="popup-chips">
                        {p.apertura && p.cierre && <em>🕒 {p.apertura} – {p.cierre}</em>}
                        {p.canchas != null && <em>{p.canchas} canchas</em>}
                      </span>
                    )}
                    <div className="popup-botones">
                      <button
                        type="button"
                        className="btn-cta-primary"
                        onClick={function () {
                          if (onVerSede) onVerSede(p.slug)
                        }}
                      >
                        Ver canchas
                      </button>
                      <a href={comoLlegar(p)} target="_blank" rel="noreferrer" className="popup-llegar">
                        Cómo llegar
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}

// Mapa pequeño con solo una sede, para su propia página.
export function MapaSede({ sede }) {
  const u = UBICACIONES[sede.slug]
  if (!u) return null

  const punto = { lat: u.lat, lng: u.lng }
  const nombre = sede.nombre || u.nombre
  const color = u.color

  return (
    <section className="mapa-sede">
      <div className="mapa-sede-info">
        <h3>📍 ¿Cómo llegar?</h3>
        <p>{sede.direccion || u.direccion}</p>
        <a href={comoLlegar(punto)} target="_blank" rel="noreferrer" className="btn-cta-primary">
          Abrir en Google Maps
        </a>
      </div>
      <MapContainer
        center={[u.lat, u.lng]}
        zoom={17}
        scrollWheelZoom={false}
        className="mapa-leaflet mapa-sede-lienzo"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <Marker position={[u.lat, u.lng]} icon={icono(color, nombre[0], true)} />
      </MapContainer>
    </section>
  )
}
