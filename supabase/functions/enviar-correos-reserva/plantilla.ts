// Arma el correo de "reserva confirmada". No depende de Intl ni de la zona
// horaria del servidor: la fecha y la hora ya vienen como las ve Colombia.
// Tablas y estilos en línea porque Gmail y Outlook ignoran casi todo lo demás.

export type DatosCorreo = {
  id: number
  reserva_id: number
  destinatario: string
  nombre: string
  codigo: string
  sede: string
  cancha: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  precio_total: number
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const CUERPO = "Barlow,'Segoe UI',Arial,sans-serif"
const TITULO = "'Barlow Condensed','Arial Narrow',Arial,sans-serif"

function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// '2026-11-04' → { corta: '4 de noviembre', larga: 'Miércoles 4 de noviembre' }
function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const corta = `${dia} de ${MESES[mes - 1]}`
  const semana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
  return { corta, larga: `${DIAS[semana]} ${corta}` }
}

// '19:00:00' → '7:00 PM'
function formatearHora(hora: string): string {
  const [h, m] = hora.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// 120000 → '$120.000'
function formatearPesos(valor: number): string {
  return `$${String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

function saludo(nombre: string): string {
  const limpio = nombre.trim()
  if (!limpio || limpio === 'Sin nombre') return 'Hola.'
  return `Hola, ${limpio.split(/\s+/)[0]}.`
}

function filaDato(etiqueta: string, valor: string, arriba: number, abajo: number): string {
  return `<tr><td style="padding:${arriba}px 8px ${abajo}px 16px;color:#475569;">${etiqueta}</td>` +
    `<td align="right" style="padding:${arriba}px 16px ${abajo}px 8px;color:#0f172a;font-weight:600;">${escapar(valor)}</td></tr>`
}

export function armarCorreo(d: DatosCorreo, appUrl: string): { asunto: string; html: string; texto: string } {
  const base = appUrl.replace(/\/+$/, '')
  const enlace = `${base}/mis-reservas`
  const fecha = formatearFecha(d.fecha)
  const horario = `${formatearHora(d.hora_inicio)} a ${formatearHora(d.hora_fin)}`
  const valor = formatearPesos(d.precio_total)
  const hola = saludo(d.nombre)
  const aviso = `${d.sede} aprobó tu pago, así que el horario ya es tuyo.`
  const cancelar = 'Puedes cancelar desde Mis reservas hasta 24 horas antes del partido.'

  const asunto = `Reserva confirmada: ${d.sede}, ${fecha.corta}`

  const texto = [
    `${hola} ${aviso}`,
    '',
    `Código de reserva: ${d.codigo}`,
    `Sede: ${d.sede}`,
    `Cancha: ${d.cancha}`,
    `Fecha: ${fecha.larga}`,
    `Horario: ${horario}`,
    `Valor: ${valor}`,
    '',
    `Ver mis reservas: ${enlace}`,
    '',
    cancelar,
    '',
    'Arma Tu Cancha',
    'Cali, Valle del Cauca, Colombia · +57 316 2528100',
    'Este correo se envió porque hiciste una reserva con tu cuenta.',
  ].join('\n')

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(asunto)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;border-collapse:collapse;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border-collapse:separate;">
      <tr><td align="center" bgcolor="#0f172a" style="background:#0f172a;padding:24px 24px 20px;">
        <img src="${escapar(base)}/icono-correo.png" width="168" alt="Arma Tu Cancha" style="display:block;width:168px;max-width:100%;height:auto;border:0;color:#ffffff;font:700 22px Arial,sans-serif;">
      </td></tr>
      <tr><td height="4" bgcolor="#16a34a" style="background:#16a34a;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:32px 28px 8px;font-family:${CUERPO};color:#334155;font-size:16px;line-height:1.55;">
        <p style="margin:0 0 6px;color:#16a34a;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Pago aprobado</p>
        <h1 style="margin:0 0 12px;color:#0f172a;font-family:${TITULO};font-size:32px;line-height:1.1;font-weight:700;">Tu cancha está reservada</h1>
        <p style="margin:0;">${escapar(`${hola} ${aviso}`)}</p>
      </td></tr>
      <tr><td style="padding:20px 28px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;border-collapse:separate;font-family:${CUERPO};font-size:15px;color:#334155;">
          <tr><td colspan="2" style="padding:14px 16px 12px;border-bottom:1px dashed #86efac;">
            <span style="display:block;color:#166534;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">Código de reserva</span>
            <strong style="display:block;margin-top:2px;color:#0f172a;font-family:Consolas,Menlo,monospace;font-size:21px;letter-spacing:1px;">${escapar(d.codigo)}</strong>
          </td></tr>
          ${filaDato('Sede', d.sede, 12, 4)}
          ${filaDato('Cancha', d.cancha, 4, 4)}
          ${filaDato('Fecha', fecha.larga, 4, 4)}
          ${filaDato('Horario', horario, 4, 4)}
          ${filaDato('Valor', valor, 4, 14)}
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 28px 8px;">
        <a href="${escapar(enlace)}" style="display:inline-block;background:#16a34a;color:#ffffff;font:700 16px ${CUERPO};text-decoration:none;padding:13px 28px;border-radius:8px;">Ver mis reservas</a>
      </td></tr>
      <tr><td align="center" style="padding:12px 28px 28px;font-family:${CUERPO};color:#475569;font-size:14px;line-height:1.5;">
        ${cancelar}
      </td></tr>
      <tr><td align="center" bgcolor="#0f172a" style="background:#0f172a;padding:18px 24px;font-family:${CUERPO};color:#94a3b8;font-size:13px;line-height:1.5;">
        <strong style="color:#ffffff;">Arma Tu Cancha</strong><br>Cali, Valle del Cauca, Colombia · +57 316 2528100<br>Este correo se envió porque hiciste una reserva con tu cuenta.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  return { asunto, html, texto }
}
