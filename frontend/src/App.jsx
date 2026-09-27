import { useState } from 'react'
import { useSesion } from './lib/useSesion'
import { cerrarSesion } from './lib/datos'
import { ToastProvider, useToast } from './componentes/Toast'
import Marketplace from './paginas/MarketPlace'
import Sede from './paginas/sede'
import Portada from './paginas/portada'

function Contenido() {
  const { perfil, cargando, autenticado, esAdmin } = useSesion()
  const toast = useToast()

  // Reemplaza a tus show()/hide() con display:none.
  // 'marketplace' o el slug de una sede.
  const [vista, setVista] = useState('marketplace')

  if (cargando) {
    return <p style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Cargando…</p>
  }

  async function salir() {
    await cerrarSesion()
    setVista('marketplace')
    toast('Sesión cerrada.')
  }

  return (
    <>
      <header className="header-wembley">
        <div className="logo-container">
          <div>
            <h1>Arma Tu Cancha ⚽</h1>
            <p className="info-contacto">📞 +57 316 2528100</p>
          </div>
        </div>

        <div className="auth-box-header">
          {autenticado ? (
            <div>
              <span id="saludo-usuario">
                👤 <strong>{perfil?.nombre ?? 'Jugador'}</strong>
                <span style={{
                  fontSize: 11, background: esAdmin ? '#22c55e' : '#38bdf8',
                  color: '#0f172a', padding: '2px 7px', borderRadius: 4,
                  fontWeight: 700, textTransform: 'uppercase', marginLeft: 6,
                }}>
                  {perfil?.rol ?? 'jugador'}
                </span>
              </span>
              <button onClick={salir} className="btn-logout" style={{ marginLeft: 12 }}>
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Inicia sesión abajo</span>
          )}
        </div>
      </header>

     {!autenticado && <Portada />}

      {autenticado && vista === 'marketplace' && (
        <Marketplace onElegirSede={(slug) => setVista(slug)} />
      )}

      {autenticado && vista !== 'marketplace' && (
        <Sede slug={vista} onVolver={() => setVista('marketplace')} />
      )}
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Contenido />
    </ToastProvider>
  )
}