// ---------------------------------------------------------------------
// Datos del sitio: contacto, responsable de los datos y analíticas.
//
// Es el ÚNICO lugar donde se cambian. Los usan el pie de página, la
// Política de Privacidad y los Términos. Un campo vacío ('') no se
// muestra en la página.
// ---------------------------------------------------------------------

export const CONTACTO = {
  // Persona o negocio responsable de los datos (Ley 1581 de 2012).
  responsable: 'Arma Tu Cancha',
  // NIT o cédula del responsable. Opcional.
  identificacion: '',
  // Correo para dudas y para ejercer los derechos sobre los datos.
  correo: '',
  telefono: '+57 316 2528100',
  direccion: '',
  ciudad: 'Cali, Valle del Cauca, Colombia',
}

// Fecha de la última versión de la Política de Privacidad y los Términos.
export const ACTUALIZACION_LEGAL = '2 de octubre de 2026'

// Analíticas sin cookies con GoatCounter (https://www.goatcounter.com).
// Crea la cuenta, elige un código (por ejemplo 'armatucancha') y ponlo
// aquí. Vacío = no se carga nada.
export const GOATCOUNTER_CODIGO = ''

// Correo que recibe un aviso cada vez que un establecimiento llena el
// formulario de "Trabaja con nosotros" (/aliados). Usa FormSubmit
// (https://formsubmit.co), gratis y sin cuenta:
//   1. Pon aquí el correo y sube la página.
//   2. Envía una solicitud de prueba: FormSubmit le manda a ese correo un
//      mensaje de "Activate form". Ábrelo y actívalo (solo la primera vez).
//   3. Desde ahí, cada solicitud llega al correo.
// Vacío = no se envía correo; las solicitudes igual quedan guardadas en
// Supabase y se ven en el panel (pestaña "Solicitudes").
export const CORREO_SOLICITUDES = ''

// Datos de pago generales. La pasarela los usa cuando la sede no ha
// llenado los suyos en el panel (Medios de pago). El QR va aparte, en
// frontend/public/pagos/ (ver lib/qrGenerico.js).
export const PAGOS_POR_DEFECTO = {
  nequi: { cuenta: '316 252 8100', titular: 'Arma Tu Cancha' },
  // EJEMPLO: cambia esta llave por la real.
  breb: { cuenta: '@armatucancha', titular: 'Arma Tu Cancha' },
}
