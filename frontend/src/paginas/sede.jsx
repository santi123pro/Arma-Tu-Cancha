import { useEffect, useState } from 'react'
import { detalleSede } from '../lib/datos'
import CanchaCard from '../componentes/CanchaCard'
import Partidos from './Partidos'

export default function Sede({ slug, onVolver }) {
  const [sede, setSede] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)
  const [verPartidos, setVerPartidos] = useState(false)

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
    return <p style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Cargando canchas…</p>
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

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px' }}>
      <div className="sede-barra">
        <button type="button" className="sede-volver" onClick={onVolver}>
          ← Volver a los complejos
        </button>
        <button
          type="button"
          className="btn-cta-primary"
          aria-expanded={verPartidos}
          onClick={() => setVerPartidos((v) => !v)}
        >
          Partidos
        </button>
      </div>

      {verPartidos && <Partidos sedeId={sede.id} sedeNombre={sede.nombre} />}

      <div style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,.07)',
      }}>
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          background: sede.color_hex ?? '#2563eb',
        }}>
          <p style={{
            color: 'rgba(255,255,255,.85)', fontSize: 13, fontWeight: 700,
            letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 6px',
          }}>
            Reservar cancha
          </p>
          <h1 style={{
            fontSize: 42, fontWeight: 800, color: '#fff', margin: '0 0 6px',
            textShadow: '0 3px 12px rgba(0,0,0,.25)',
          }}>
            {sede.nombre}
          </h1>
          <p style={{ color: 'rgba(255,255,255,.85)', fontSize: 14, margin: 0 }}>
            {sede.direccion} · {sede.telefono}
          </p>
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
