import { ACTUALIZACION_LEGAL, CONTACTO } from '../lib/sitio'

// Política de Privacidad y Términos y condiciones. Los datos del
// responsable y de contacto salen de lib/sitio.js.

function Contacto() {
  return (
    <ul>
      <li><strong>Responsable:</strong> {CONTACTO.responsable}
        {CONTACTO.identificacion && ` (${CONTACTO.identificacion})`}</li>
      {CONTACTO.correo && (
        <li><strong>Correo:</strong> <a href={`mailto:${CONTACTO.correo}`}>{CONTACTO.correo}</a></li>
      )}
      {CONTACTO.telefono && <li><strong>Teléfono / WhatsApp:</strong> {CONTACTO.telefono}</li>}
      {CONTACTO.direccion && <li><strong>Dirección:</strong> {CONTACTO.direccion}</li>}
      <li><strong>Ciudad:</strong> {CONTACTO.ciudad}</li>
    </ul>
  )
}

const canal = CONTACTO.correo ? `el correo ${CONTACTO.correo}` : `el teléfono ${CONTACTO.telefono}`

function Marco({ titulo, onVolver, children }) {
  return (
    <main className="pagina-legal">
      <article className="legal-tarjeta">
        <button type="button" className="sede-volver" onClick={onVolver}>← Volver</button>
        <h1>{titulo}</h1>
        <p className="legal-fecha">Última actualización: {ACTUALIZACION_LEGAL}</p>
        {children}
      </article>
    </main>
  )
}

export function Privacidad({ onVolver }) {
  return (
    <Marco titulo="Política de Privacidad" onVolver={onVolver}>
      <p>
        En Arma Tu Cancha cuidamos tus datos personales. Esta política explica qué datos
        recogemos, para qué los usamos y cómo puedes ejercer tus derechos, de acuerdo con la
        Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <Contacto />

      <h2>2. Qué datos recogemos</h2>
      <ul>
        <li><strong>Datos de tu cuenta:</strong> nombre, correo, teléfono (opcional) y contraseña. La contraseña se guarda cifrada y nadie del equipo puede verla.</li>
        <li><strong>Reservas:</strong> cancha, fecha, horario, valor y código de cada reserva.</li>
        <li><strong>Partidos y torneos:</strong> los partidos que publicas o a los que te unes y los equipos que inscribes.</li>
        <li><strong>Datos técnicos:</strong> para mantener tu sesión abierta, el navegador guarda un identificador de sesión en su almacenamiento local. No usamos cookies de publicidad ni de rastreo.</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Crear y administrar tu cuenta.</li>
        <li>Registrar tus reservas para que la sede correspondiente pueda atenderte.</li>
        <li>Organizar partidos abiertos y torneos.</li>
        <li>Recuperar tu contraseña cuando lo pidas.</li>
        <li>Generar estadísticas de uso <strong>agregadas y anónimas</strong> para mejorar el servicio.</li>
      </ul>
      <p>No vendemos ni alquilamos tus datos.</p>

      <h2>4. Con quién se comparten</h2>
      <ul>
        <li><strong>La sede donde reservas</strong> ve tu nombre y los datos de tu reserva para poder atenderte.</li>
        <li><strong>Partidos abiertos:</strong> si te unes a un partido, el organizador ve tu nombre y tu teléfono, y tú ves los del organizador, para que puedan coordinar. Los demás jugadores no ven tus datos.</li>
        <li><strong>Proveedores técnicos:</strong> Supabase (base de datos y autenticación), GitHub Pages (alojamiento de la página) y OpenStreetMap (mapas). Si se activan las estadísticas, se usa GoatCounter, que no usa cookies ni guarda datos personales. Algunos de estos proveedores procesan la información fuera de Colombia, con medidas de seguridad adecuadas.</li>
      </ul>

      <h2>5. Tus derechos</h2>
      <p>Como titular de los datos puedes, en cualquier momento:</p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Pedir prueba de la autorización que nos diste.</li>
        <li>Saber cómo hemos usado tus datos.</li>
        <li>Revocar la autorización o pedir que borremos tus datos, siempre que no exista un deber legal de conservarlos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
      </ul>

      <h2>6. Cómo ejercerlos</h2>
      <p>
        Escríbenos por {canal} indicando tu nombre, el correo de tu cuenta y lo que necesitas.
        Respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles,
        como indica la ley.
      </p>

      <h2>7. Seguridad y conservación</h2>
      <p>
        Los datos viajan cifrados (HTTPS) y el acceso está restringido por reglas que solo dejan
        ver a cada persona lo que le corresponde. Guardamos tus datos mientras tengas la cuenta
        activa. Si pides eliminarla, borramos tu cuenta y tu perfil; las reservas que ya hiciste
        pueden conservarse como registro de la sede, y puedes pedirnos también su supresión.
      </p>

      <h2>8. Cambios a esta política</h2>
      <p>
        Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha
        de actualización.
      </p>
    </Marco>
  )
}

export function Terminos({ onVolver }) {
  return (
    <Marco titulo="Términos y condiciones" onVolver={onVolver}>
      <p>
        Al crear una cuenta o usar Arma Tu Cancha aceptas estos términos. Léelos con calma: son
        cortos y están escritos para que se entiendan.
      </p>

      <h2>1. Qué es Arma Tu Cancha</h2>
      <p>
        Una plataforma para reservar canchas sintéticas de fútbol en sedes de Cali, publicar o
        unirse a partidos abiertos e inscribir equipos en torneos. Cada sede presta el servicio
        de la cancha; Arma Tu Cancha facilita la reserva.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Debes dar datos reales y mantener tu contraseña en secreto.</li>
        <li>Eres responsable de lo que se haga con tu cuenta.</li>
        <li>Podemos suspender cuentas que hagan reservas falsas, abusen del sistema o falten al respeto a otros usuarios.</li>
      </ul>

      <h2>3. Reservas</h2>
      <ul>
        <li>Puedes reservar con hasta 15 días de anticipación, dentro del horario de cada sede.</li>
        <li>Cada reserva tiene un código; preséntalo en la sede.</li>
        <li>Puedes cancelar sin costo hasta 24 horas antes. Con menos tiempo, comunícate directamente con la sede.</li>
        <li>El valor y la forma de pago los define cada sede.</li>
        <li>Si no llegas a tu reserva, la sede puede marcarla como no asistida.</li>
      </ul>

      <h2>4. Partidos abiertos</h2>
      <ul>
        <li>Quien publica un partido debe tener la cancha reservada o coordinarla con la sede.</li>
        <li>Al unirte, compartes tu nombre y teléfono con el organizador para coordinar el partido.</li>
        <li>Arma Tu Cancha no responde por acuerdos de dinero entre jugadores.</li>
      </ul>

      <h2>5. Torneos</h2>
      <p>
        Cada torneo lo organiza una sede, que define las reglas, el premio y el calendario. La
        inscripción de un equipo la hace su capitán.
      </p>

      <h2>6. Uso adecuado</h2>
      <p>
        No está permitido usar la plataforma para fines ilegales, intentar acceder a datos de
        otras personas, alterar su funcionamiento ni publicar contenido ofensivo.
      </p>

      <h2>7. Responsabilidad</h2>
      <p>
        Hacemos lo posible para que la plataforma funcione sin interrupciones, pero puede haber
        fallas o mantenimientos. La práctica deportiva tiene riesgos propios: cada jugador
        participa bajo su propia responsabilidad y la de la sede.
      </p>

      <h2>8. Datos personales</h2>
      <p>
        El tratamiento de tus datos se rige por nuestra Política de Privacidad.
      </p>

      <h2>9. Cambios y ley aplicable</h2>
      <p>
        Podemos actualizar estos términos y publicaremos la nueva versión en esta página. Se
        rigen por las leyes de la República de Colombia.
      </p>

      <h2>10. Contacto</h2>
      <Contacto />
    </Marco>
  )
}
