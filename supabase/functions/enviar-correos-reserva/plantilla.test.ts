import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armarCorreo, type DatosCorreo } from './plantilla.ts'

const APP = 'https://ejemplo.test/app'

const datos = (cambios: Partial<DatosCorreo> = {}): DatosCorreo => ({
  id: 1,
  reserva_id: 10,
  destinatario: 'ana@ejemplo.test',
  nombre: 'Ana Gómez',
  codigo: 'WEM-7K2P9',
  sede: 'Wembley',
  cancha: 'Cancha 2',
  fecha: '2026-11-04',
  hora_inicio: '19:00:00',
  hora_fin: '20:00:00',
  precio_total: 120000,
  ...cambios,
})

test('el asunto lleva la sede y la fecha', () => {
  assert.equal(armarCorreo(datos(), APP).asunto, 'Reserva confirmada: Wembley, 4 de noviembre')
})

test('el html y el texto traen todos los datos de la reserva', () => {
  const { html, texto } = armarCorreo(datos(), APP)
  for (const parte of [html, texto]) {
    for (const dato of ['WEM-7K2P9', 'Wembley', 'Cancha 2', 'Miércoles 4 de noviembre', '7:00 PM', '8:00 PM', '$120.000']) {
      assert.ok(parte.includes(dato), `falta ${dato}`)
    }
  }
})

test('saluda con el primer nombre', () => {
  assert.ok(armarCorreo(datos(), APP).texto.includes('Hola, Ana.'))
})

test('sin nombre real, el saludo no inventa uno', () => {
  // crear_reserva guarda 'Sin nombre' cuando no tiene el dato.
  for (const nombre of ['Sin nombre', '   ']) {
    const { texto } = armarCorreo(datos({ nombre }), APP)
    assert.ok(texto.startsWith('Hola. Wembley aprobó tu pago'), texto)
  }
})

test('la fecha no cambia con la zona horaria del servidor', () => {
  const original = process.env.TZ
  try {
    for (const zona of ['UTC', 'America/Bogota', 'Asia/Tokyo']) {
      process.env.TZ = zona
      assert.ok(armarCorreo(datos(), APP).html.includes('Miércoles 4 de noviembre'), zona)
      assert.ok(armarCorreo(datos({ fecha: '2026-01-01' }), APP).html.includes('Jueves 1 de enero'), zona)
    }
  } finally {
    process.env.TZ = original
  }
})

test('las horas cubren medianoche y mediodía', () => {
  const { texto } = armarCorreo(datos({ hora_inicio: '00:30:00', hora_fin: '12:00:00' }), APP)
  assert.ok(texto.includes('12:30 AM'))
  assert.ok(texto.includes('12:00 PM'))
})

test('el valor usa separador de miles sin importar el tamaño', () => {
  assert.ok(armarCorreo(datos({ precio_total: 1250000 }), APP).texto.includes('$1.250.000'))
  assert.ok(armarCorreo(datos({ precio_total: 900 }), APP).texto.includes('$900'))
})

test('los datos variables se escapan en el html', () => {
  const { html } = armarCorreo(datos({
    nombre: '<b>Ana & "Luis"</b>',
    sede: 'Arena & Gol',
    cancha: '<img src=x>',
  }), APP)
  assert.ok(html.includes('&lt;b&gt;Ana'))
  assert.ok(!html.includes('<b>Ana'))
  assert.ok(html.includes('Arena &amp; Gol'))
  assert.ok(!html.includes('<img src=x>'))
})

test('el enlace a mis reservas no tiene doble barra', () => {
  for (const app of [APP, `${APP}/`]) {
    const { html, texto } = armarCorreo(datos(), app)
    assert.ok(html.includes(`href="${APP}/mis-reservas"`))
    assert.ok(texto.includes(`${APP}/mis-reservas`))
  }
})

test('el encabezado lleva el logo, su texto alternativo y el color de la marca', () => {
  const { html } = armarCorreo(datos(), `${APP}/`)
  assert.ok(html.includes(`src="${APP}/icono-correo.png"`))
  assert.ok(html.includes('alt="Arma Tu Cancha"'))
  assert.ok(html.includes('#0f172a'))
})
