import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cuentaYaExiste } from './registro.js'

test('un usuario sin identidades es una cuenta que ya existía', () => {
  assert.equal(cuentaYaExiste({ user: { id: 'x', identities: [] }, session: null }), true)
})

test('un usuario nuevo con identidad no es una cuenta existente', () => {
  assert.equal(cuentaYaExiste({ user: { id: 'x', identities: [{ id: 'y' }] }, session: null }), false)
})

test('una cuenta activa al instante no es una cuenta existente', () => {
  assert.equal(cuentaYaExiste({ user: { id: 'x', identities: [{ id: 'y' }] }, session: { access_token: 't' } }), false)
})

test('sin datos de identidades no se afirma que exista', () => {
  assert.equal(cuentaYaExiste({ user: { id: 'x' }, session: null }), false)
  assert.equal(cuentaYaExiste({ user: null, session: null }), false)
  assert.equal(cuentaYaExiste(null), false)
})
