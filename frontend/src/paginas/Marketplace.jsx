import { useEffect, useState } from 'react'
import { listarSedes } from '../lib/datos'
import TarjetaSede from '../componentes/TarjetaSede'
import Cargando from '../componentes/Cargando'

export default function Marketplace({ onElegirSede }) {
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    listarSedes().then(({ datos, error }) => {
      if (error) setError(error)
      else setSedes(datos ?? [])
      setCargando(false)
    })
  }, [])

  if (cargando) {
    return <Cargando tamano="grande" texto="Cargando establecimientos" />
  }

  if (error) {
    return <Mensaje color="#dc2626">{error}</Mensaje>
  }

  if (!sedes.length) {
    return (
      <Mensaje>
        Todavía no hay establecimientos registrados.
        <br />
        <small>¿Cargaste el archivo seed.sql en Supabase?</small>
      </Mensaje>
    )
  }

  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ fontSize: 28, color: '#0f172a', marginBottom: 10 }}>
        ¡Bienvenido, elige dónde vas a romperla hoy! ⚽
      </h2>
      <p style={{ color: '#64748b', marginBottom: 30 }}>
        Selecciona el complejo deportivo al que quieres ingresar.
      </p>

      <div className="lista-sedes">
        {sedes.map((s) => (
          <TarjetaSede key={s.id} sede={s} onEntrar={() => onElegirSede(s.slug)} />
        ))}
      </div>
    </div>
  )
}

function Mensaje({ children, color = '#64748b' }) {
  return (
    <p style={{ textAlign: 'center', padding: 60, color, lineHeight: 1.7 }}>
      {children}
    </p>
  )
}