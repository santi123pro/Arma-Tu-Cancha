// Datos de contacto entre el organizador de un partido y sus jugadores.
// Las filas vienen de contactos_mis_partidos() (migración 0011), que ya
// filtra en el servidor quién puede ver a quién.

// '300 123 4567' → '573001234567' (WhatsApp necesita el indicativo).
function numeroWhatsApp(telefono) {
  const digitos = telefono.replace(/\D/g, '')
  return digitos.length === 10 && digitos.startsWith('3') ? '57' + digitos : digitos
}

// '3001234567' → '300 123 4567'
function telefonoLegible(telefono) {
  const d = telefono.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : telefono
}

function iniciales(nombre) {
  return (nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function Persona({ contacto, detalle, mensaje }) {
  const { nombre, telefono } = contacto
  return (
    <li className="contacto">
      <span className="contacto-avatar" aria-hidden="true">{iniciales(nombre)}</span>
      <span className="contacto-datos">
        <strong>{nombre}</strong>
        <small>
          {telefono ? telefonoLegible(telefono) : 'Sin celular registrado'}
          {detalle && <> · {detalle}</>}
        </small>
      </span>
      {telefono && (
        <span className="contacto-acciones">
          <a
            className="contacto-boton contacto-whatsapp"
            href={`https://wa.me/${numeroWhatsApp(telefono)}?text=${encodeURIComponent(mensaje)}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Escribir a ${nombre} por WhatsApp`}
            title="WhatsApp"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z" />
            </svg>
          </a>
          <a
            className="contacto-boton contacto-llamar"
            href={`tel:${telefono.replace(/[^\d+]/g, '')}`}
            aria-label={`Llamar a ${nombre}`}
            title="Llamar"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1Z" />
            </svg>
          </a>
        </span>
      )}
    </li>
  )
}

// Vista del organizador: todos los jugadores que se unieron.
export function JugadoresDelPartido({ contactos, error, resumen }) {
  return (
    <div className="contactos-panel">
      <p className="contactos-titulo">
        👥 Jugadores anotados {contactos.length > 0 && <span>{contactos.length}</span>}
      </p>
      {error ? (
        <p className="contactos-vacio">No fue posible cargar los datos de contacto.</p>
      ) : contactos.length === 0 ? (
        <p className="contactos-vacio">
          Aún no se ha unido nadie. Cuando alguien tome un cupo, verás aquí su nombre y su celular.
        </p>
      ) : (
        <ul className="contactos-lista">
          {contactos.map((c) => (
            <Persona
              key={c.usuario_id}
              contacto={c}
              detalle={c.posicion}
              mensaje={`Hola, ${c.nombre}. Te escribo por el partido del ${resumen} que armé en Arma Tu Cancha.`}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// Vista del jugador: solo quien armó el partido.
export function OrganizadorDelPartido({ contacto, error, resumen }) {
  return (
    <div className="contactos-panel">
      <p className="contactos-titulo">📣 Organizador del partido</p>
      {error || !contacto ? (
        <p className="contactos-vacio">No fue posible cargar los datos del organizador.</p>
      ) : (
        <ul className="contactos-lista">
          <Persona
            contacto={contacto}
            mensaje={`Hola, ${contacto.nombre}. Me uní a tu partido del ${resumen} en Arma Tu Cancha.`}
          />
        </ul>
      )}
    </div>
  )
}
