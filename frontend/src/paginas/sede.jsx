import { useEffect, useState } from 'react'
import { detalleSede } from '../lib/datos'

export default function Sede({ slug, onVolver }) {
  const [sede, setSede] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCargando(true)
    detalleSede(slug).then(({ datos, error }) => {
      if (error) setError(error)
      else setSede(datos)
      setCargando(false)
    })
  }, [slug])

  if (cargando) {
    return <p style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Cargando…</p>
  }

  if (error || !sede) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: '#dc2626' }}>{error ?? 'No encontramos ese establecimiento.'}</p>
        <button onClick={onVolver} className="btn-cta-primary" style={{ marginTop: 20 }}>
          Volver
        </button>
      </div>
    )
  }

  const canchas = sede.canchas ?? []

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>
      <button
        onClick={onVolver}
        style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0,
        }}
      >
        ← Volver a los complejos
      </button>

      <div style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,.07)',
      }}>
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          background: sede.color_hex ?? '#2563eb',
        }}>
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

        <div style={{ padding: '32px 36px' }}>
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
            Canchas de este complejo
          </h3>

          {canchas.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Este establecimiento aún no ha publicado canchas.
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: 16,
            }}>
              {canchas.map((c) => <TarjetaCancha key={c.id} cancha={c} />)}
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

function TarjetaCancha({ cancha }) {
  const rasgos = []
  if (cancha.techada) rasgos.push('Techada')
  if (cancha.iluminacion) rasgos.push('Iluminación')
  if (cancha.superficie) rasgos.push(cancha.superficie)

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>{cancha.nombre}</h4>
        <span style={{
          background: '#dcfce7', color: '#166534', padding: '3px 9px',
          borderRadius: 6, fontSize: 11, fontWeight: 700,
        }}>
          {cancha.tipo}
        </span>
      </div>

      {cancha.caracteristicas && (
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{cancha.caracteristicas}</p>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {rasgos.map((r) => (
          <span key={r} style={{
            background: '#f1f5f9', color: '#475569', padding: '2px 8px',
            borderRadius: 20, fontSize: 11,
          }}>
            {r}
          </span>
        ))}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f1f5f9',
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>
          ${cancha.precio_hora.toLocaleString('es-CO')}
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}> /hora</span>
        </span>
        <button
          className="btn-cta-primary"
          style={{ padding: '7px 16px', fontSize: 13 }}
          onClick={() => alert('La reserva la construimos en el siguiente paso.')}
        >
          Ver horarios
        </button>
      </div>
    </div>
  )
}