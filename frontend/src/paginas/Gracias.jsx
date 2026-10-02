// Después de registrarse, cuando la cuenta todavía debe confirmarse por correo.
export default function Gracias({ correo, onIrLogin }) {
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
