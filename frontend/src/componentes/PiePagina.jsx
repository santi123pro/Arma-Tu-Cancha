import { useInstalarApp } from '../lib/pwa'
import { CONTACTO } from '../lib/sitio'

// Pie de página de todas las pantallas: contacto y enlaces legales.
// conAliados: el aviso para dueños de canchas se muestra solo a visitantes.
export default function PiePagina({ onIr, conAliados = true }) {
  const telefono = CONTACTO.telefono.replace(/\D/g, '')
  const instalar = useInstalarApp()

  return (
    <footer className="pie-pagina">
      {conAliados && (
        <div className="pie-aliados">
          <div>
            <strong>¿Tienes una cancha?</strong>
            <p>Súmala a Arma Tu Cancha y recibe reservas sin llamadas.</p>
          </div>
          <button type="button" className="btn-cta-primary" onClick={() => onIr('aliados')}>
            Trabaja con nosotros
          </button>
        </div>
      )}

      <div className="pie-contenido">
        <div>
          <strong className="pie-marca">Arma Tu Cancha</strong>
          <p>Reserva canchas de fútbol en {CONTACTO.ciudad.split(',')[0]}.</p>
        </div>

        <address className="pie-contacto">
          <a href={`https://wa.me/${telefono}`} target="_blank" rel="noreferrer">📞 {CONTACTO.telefono}</a>
          {CONTACTO.correo && <a href={`mailto:${CONTACTO.correo}`}>✉️ {CONTACTO.correo}</a>}
          {CONTACTO.direccion && <span>📍 {CONTACTO.direccion}</span>}
        </address>

        <nav className="pie-enlaces" aria-label="Información legal">
          <button type="button" onClick={() => onIr('privacidad')}>Política de Privacidad</button>
          <button type="button" onClick={() => onIr('terminos')}>Términos y condiciones</button>
          <button type="button" onClick={() => onIr('aliados')}>Trabaja con nosotros</button>
          {instalar && <button type="button" onClick={instalar}>Instalar la app</button>}
        </nav>
      </div>
      <p className="pie-derechos">© {new Date().getFullYear()} {CONTACTO.responsable}. Todos los derechos reservados.</p>
    </footer>
  )
}
