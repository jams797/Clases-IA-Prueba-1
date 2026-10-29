const assert = require('assert').strict;
const auth = require('../auth.js');

function test(name, run) {
  run();
  console.log(`OK: ${name}`);
}

function storage(value) {
  const values = new Map([[auth.SESSION_KEY, value]]);
  return { getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key) };
}

test('valida campos obligatorios y formato de correo', () => {
  assert.deepEqual(Object.keys(auth.validate('  ', '')), ['email', 'password']);
  for (const email of ['correo', 'a@b', 'a b@correo.com', '@correo.com']) {
    assert.ok(auth.validate(email, 'clave').email);
  }
  assert.deepEqual(auth.validate(' demo@jose.com ', 'Jose2026!'), {});
});

test('solo acepta las credenciales de demostración', () => {
  assert.equal(auth.authenticate(' DEMO@JOSE.COM ', 'Jose2026!'), true);
  assert.equal(auth.authenticate('otro@jose.com', 'Jose2026!'), false);
  assert.equal(auth.authenticate('demo@jose.com', 'jose2026!'), false);
  assert.equal(auth.authenticate('demo@jose.com', ''), false);
});

test('recupera únicamente una sesión vigente con datos válidos', () => {
  const session = { email: 'demo@jose.com', expiresAt: Date.now() + 10000 };
  assert.deepEqual(auth.readSession(storage(JSON.stringify(session))), session);
  for (const value of [null, 'bad json', '{}', JSON.stringify({ ...session, expiresAt: Date.now() - 1000 }), JSON.stringify({ ...session, email: 'otro@correo.com' })]) {
    assert.equal(auth.readSession(storage(value)), null);
  }
});

test('maneja almacenamiento bloqueado sin aceptar una sesión', () => {
  assert.equal(auth.readSession({ getItem() { throw new Error('blocked'); } }), null);
});
