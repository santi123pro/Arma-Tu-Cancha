import { useEffect, useState } from 'react'
import { detalleSede } from '../lib/datos'
import CanchaCard from '../componentes/CanchaCard'
import { fotoSede } from '../lib/imagenes'
import Cargando from '../componentes/Cargando'
import { MapaSede } from '../componentes/MapasSedes'
import { temaSede } from '../lib/temas'

export default function Sede({ slug, onVolver, onVerPartidos, onVerTorneos, onVerReservas }) {
  const [sede, setSede] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  // detalleSede trae la sede por su slug junto con sus canchas activas
  // (filtradas por sede_id en la relación), así nunca se mezclan sedes.
  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    detalleSede(slug).then(({ datos, error }) => {
      if (!vigente) return
      if (error) setError(error)
      else setSede(datos)
      setCargando(false)
    })
    return () => { vigente = false }
  }, [slug, intento])

  if (cargando) {
    return <Cargando tamano="grande" texto="Cargando canchas" />
  }

  if (error || !sede) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: '#dc2626' }}>
          No fue posible cargar las canchas.
          <br />
          Intenta nuevamente.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
          <button onClick={() => setIntento((n) => n + 1)} className="btn-cta-primary">
            Reintentar
          </button>
          <button onClick={onVolver} className="btn-elegir-dia">
            Volver
          </button>
        </div>
      </div>
    )
  }

  const canchas = [...(sede.canchas ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre))
  const portada = fotoSede(sede)

  return (
    <div className={temaSede(sede)} style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px' }}>
      <div className="sede-barra">
        <button type="button" className="sede-volver" onClick={onVolver}>
          ← Volver a las sedes
        </button>
        <div className="sede-acciones">
          <button type="button" className="btn-cta-primary btn-ir-partidos btn-ir-reservas" onClick={onVerReservas}>
            📅 Mis reservas →
          </button>
          <button type="button" className="btn-cta-primary btn-ir-partidos" onClick={onVerPartidos}>
            ⚽ Partidos abiertos →
          </button>
          <button type="button" className="btn-cta-primary btn-ir-partidos btn-ir-torneos" onClick={onVerTorneos}>
            🏆 Torneos →
          </button>
        </div>
      </div>

      <div style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,.07)',
      }}>
        <div
          className={'sede-hero' + (portada ? ' sede-hero-con-foto' : '')}
          style={{ '--sede-color': sede.color_hex ?? '#2563eb' }}
        >
          {portada && <img className="sede-hero-foto" src={portada} alt="" />}
          <div className="sede-hero-texto">
            <p className="sede-hero-etiqueta">Reservar cancha</p>
            <h1>{sede.nombre}</h1>
            <p className="sede-hero-datos">
              {sede.direccion} · {sede.telefono}
            </p>
          </div>
        </div>

        <div className="sede-reservas-cuerpo">
          <p style={{
            fontSize: 15, color: '#475569', lineHeight: 1.7,
            textAlign: 'center', maxWidth: 660, margin: '0 auto 24px',
          }}>
            {sede.descripcion}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14,
            background: '#f8fafc', borderRadius: 14, padding: 18,
            border: '1px solid #e2e8f0', marginBottom: 28,
          }}>
            <Stat n={canchas.length} l="Canchas" />
            <Stat
              n={canchas.length ? `$${Math.min(...canchas.map((c) => c.precio_hora)).toLocaleString('es-CO')}` : '—'}
              l="Desde / hora"
            />
            <Stat
              n={`${sede.hora_apertura?.slice(0, 5)}–${sede.hora_cierre?.slice(0, 5)}`}
              l="Horario"
            />
          </div>

          <MapaSede sede={sede} />

          <h3 style={{ color: '#0f172a', fontSize: 18, marginBottom: 14 }}>
            Canchas de {sede.nombre}
          </h3>

          {canchas.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>
              No hay canchas disponibles en esta sede.
            </p>
          ) : (
            <div className="canchas-grid">
              {canchas.map((c) => <CanchaCard key={c.id} cancha={c} sede={sede} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ n, l }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{n}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{l}</div>
    </div>
  )
}
