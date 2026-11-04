import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opcionesSmtp, procesarLote, tokenValido } from './lote.ts'
import type { DatosCorreo } from './plantilla.ts'

const correo = (id: number): DatosCorreo => ({
  id,
  reserva_id: id * 10,
  destinatario: `persona${id}@ejemplo.test`,
  nombre: 'Ana',
  codigo: `C-${id}`,
  sede: 'Wembley',
  cancha: 'Cancha 1',
  fecha: '2026-11-04',
  hora_inicio: '19:00:00',
  hora_fin: '20:00:00',
  precio_total: 1000,
})

const silenciarConsola = (t: { mock: { method: (o: Console, m: 'error') => unknown } }) => t.mock.method(console, 'error')

test('un fallo a mitad de lote no detiene los demás envíos', async (t) => {
  silenciarConsola(t)
  const enviados: number[] = []
  const marcas: [number, boolean, string | undefined][] = []

  const resultado = await procesarLote(
    [correo(1), correo(2), correo(3)],
    async (c) => {
      enviados.push(c.id)
      if (c.id === 2) throw new Error('Gmail no responde')
    },
    async (id, exito, error) => { marcas.push([id, exito, error]) },
  )

  assert.deepEqual(enviados, [1, 2, 3])
  assert.deepEqual(resultado, { enviados: 2, fallidos: 1 })
  assert.deepEqual(marcas, [
    [1, true, undefined],
    [2, false, 'Gmail no responde'],
    [3, true, undefined],
  ])
})

test('el error guardado no incluye direcciones de correo', async (t) => {
  silenciarConsola(t)
  const marcas: (string | undefined)[] = []
  await procesarLote(
    [correo(1)],
    async () => { throw new Error('Rechazado: <persona1@ejemplo.test> por remitente@gmail.com') },
    async (_id, _exito, error) => { marcas.push(error) },
  )
  assert.equal(marcas[0], 'Rechazado: <[correo]> por [correo]')
})

test('si falla al marcar, el lote sigue con el siguiente', async (t) => {
  silenciarConsola(t)
  const enviados: number[] = []
  const resultado = await procesarLote(
    [correo(1), correo(2)],
    async (c) => { enviados.push(c.id) },
    async (id) => { if (id === 1) throw new Error('sin base de datos') },
  )
  assert.deepEqual(enviados, [1, 2])
  assert.deepEqual(resultado, { enviados: 2, fallidos: 0 })
})

test('los registros de consola no incluyen direcciones de correo', async (t) => {
  const consola = t.mock.method(console, 'error')
  await procesarLote(
    [correo(1)],
    async () => { throw new Error('Rechazado: persona1@ejemplo.test') },
    async () => {},
  )
  const texto = consola.mock.calls.map((c) => c.arguments.join(' ')).join(' ')
  assert.ok(!texto.includes('@'), texto)
  assert.ok(texto.includes('10'), 'debe identificar la reserva')
})

test('un cuelgue de Gmail se corta rápido para no frenar el lote', () => {
  const o = opcionesSmtp('remitente@gmail.com', 'clave')
  assert.equal(o.host, 'smtp.gmail.com')
  assert.equal(o.port, 465)
  assert.equal(o.secure, true)
  assert.deepEqual(o.auth, { user: 'remitente@gmail.com', pass: 'clave' })
  assert.equal(o.connectionTimeout, 10_000)
  assert.equal(o.greetingTimeout, 10_000)
  assert.equal(o.socketTimeout, 20_000)
})

test('el lote reutiliza una sola conexión', () => {
  const o = opcionesSmtp('remitente@gmail.com', 'clave')
  assert.equal(o.pool, true)
  assert.equal(o.maxConnections, 1)
})

test('tokenValido solo acepta el token exacto', () => {
  assert.equal(tokenValido('secreto', 'secreto'), true)
  assert.equal(tokenValido('secretO', 'secreto'), false)
  assert.equal(tokenValido('secreto1', 'secreto'), false)
  assert.equal(tokenValido('secret', 'secreto'), false)
  assert.equal(tokenValido(null, 'secreto'), false)
})

test('tokenValido rechaza siempre si no hay token configurado', () => {
  assert.equal(tokenValido('', ''), false)
  assert.equal(tokenValido(null, ''), false)
})
