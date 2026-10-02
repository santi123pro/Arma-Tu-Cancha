// Después de registrarse. Dos casos:
//  - lista: la cuenta quedó activa al instante → bienvenida y a elegir sede.
//  - si no: falta confirmar el correo → se le explica cómo seguir.
export default function Gracias({ lista = false, nombre, correo, onIrLogin, onContinuar }) {
  if (lista) {
    const primerNombre = nombre?.split(' ')[0]
    return (
      <main className="pagina-estado">
        <div className="estado-tarjeta">
          <p className="estado-icono" aria-hidden="true">🎉</p>
          <h1>¡Gracias por unirte{primerNombre ? `, ${primerNombre}` : ''}!</h1>
          <p>
            Tu cuenta quedó lista. Ya puedes reservar canchas, unirte a partidos abiertos
            e inscribir a tu equipo en torneos.
          </p>
          <button type="button" className="btn-cta-primary" onClick={onContinuar}>
            Elegir mi sede ⚽
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="pagina-estado">
      <div className="estado-tarjeta">
        <p className="estado-icono" aria-hidden="true">🎉</p>
        <h1>¡Gracias por unirte a Arma Tu Cancha!</h1>
        <p>
          Te enviamos un correo{correo ? <> a <strong>{correo}</strong></> : ''} para confirmar tu cuenta.
          Ábrelo y toca el enlace; después ya puedes iniciar sesión y reservar.
        </p>
        <p className="estado-nota">¿No te llegó? Revisa la carpeta de spam o promociones.</p>
        <button type="button" className="btn-cta-primary" onClick={onIrLogin}>
          Ir a iniciar sesión
        </button>
      </div>
    </main>
  )
}
