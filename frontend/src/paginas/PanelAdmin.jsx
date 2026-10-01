import { useState } from 'react'
import Analitica from '../componentes/admin/Analitica'
import Usuarios from '../componentes/admin/Usuarios'
import Contenido from '../componentes/admin/Contenido'

const PESTANAS = [
  { id: 'analitica', icono: '📊', texto: 'Analítica', Componente: Analitica },
  { id: 'usuarios', icono: '👥', texto: 'Usuarios', Componente: Usuarios },
  { id: 'contenido', icono: '🏆', texto: 'Partidos y torneos', Componente: Contenido },
]

export default function PanelAdmin({ nombre, onVolver }) {
  const [pestana, setPestana] = useState('analitica')
  const actual = PESTANAS.find((p) => p.id === pestana)

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
          {PESTANAS.map((p) => (
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
        <actual.Componente />
      </div>
    </main>
  )
}
