import { useState } from 'react'
import Analitica from '../componentes/admin/Analitica'
import Usuarios from '../componentes/admin/Usuarios'
import Contenido from '../componentes/admin/Contenido'
import Solicitudes from '../componentes/admin/Solicitudes'

// soloSede: pestañas que también ve el admin de sede.
const PESTANAS = [
  { id: 'analitica', icono: '📊', texto: 'Analítica', Componente: Analitica, soloSede: true },
  { id: 'usuarios', icono: '👥', texto: 'Usuarios', Componente: Usuarios },
  { id: 'contenido', icono: '🏆', texto: 'Partidos y torneos', Componente: Contenido },
  { id: 'solicitudes', icono: '🤝', texto: 'Solicitudes', Componente: Solicitudes },
]

// Sin sedeId: superadmin, ve todo. Con sedeId: admin de sede, solo su analítica.
export default function PanelAdmin({ nombre, sedeId = null, onVolver }) {
  const [pestana, setPestana] = useState('analitica')
  const pestanas = sedeId ? PESTANAS.filter((p) => p.soloSede) : PESTANAS
  const actual = pestanas.find((p) => p.id === pestana) ?? pestanas[0]

  return (
    <main className="pagina-admin">
      <section className="admin-hero">
        <div className="admin-hero-contenido">
          <button type="button" className="partidos-hero-volver" onClick={onVolver}>
            ← Volver a las sedes
          </button>
          <span className="hero-badge">Panel de administración</span>
          <h1 className="partidos-hero-titulo">
            Hola, {nombre ?? 'admin'}. <span>Así va la cancha.</span>
          </h1>
        </div>

        <nav className="admin-pestanas" role="tablist">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === pestana}
              className={p.id === pestana ? 'activo' : ''}
              onClick={() => setPestana(p.id)}
            >
              {p.icono} {p.texto}
            </button>
          ))}
        </nav>
      </section>

      <div className="admin-contenido" role="tabpanel">
        <actual.Componente sedeId={sedeId} />
      </div>
    </main>
  )
}
