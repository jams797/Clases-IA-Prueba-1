// Pruebas de interacciones con un DOM mínimo, sin dependencias ni navegador.
const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');
const auth = require('../auth.js');

function setup(blockSession = false) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, value: '', type: id === 'password' ? 'password' : '', hidden: true,
      checked: false, disabled: false, textContent: '', attributes: {}, events: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      hasAttribute(key) { return key in this.attributes; },
      addEventListener(name, fn) { this.events[name] = fn; },
      focus() { this.focused = true; },
      showModal() { this.open = true; }, close() { this.open = false; }
    });
    return elements.get(id);
  }
  const local = new Map();
  const session = new Map();
  function storage(map, blocked) {
    return {
      getItem(key) { if (blocked) throw Error('blocked'); return map.get(key) || null; },
      setItem(key, value) { if (blocked) throw Error('blocked'); map.set(key, value); },
      removeItem(key) { map.delete(key); }
    };
  }
  const buttons = ['recovery', 'biometric'].map(name => {
    const button = element(name); button.dataset = { dialog: name }; return button;
  });
  const location = { assign(url) { this.destination = url; }, replace(url) { this.destination = url; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    window: { JoseAuth: auth, location },
    document: { querySelector: selector => element(selector.slice(1)), getElementById: element, querySelectorAll: () => buttons },
    sessionStorage: storage(session, blockSession), localStorage: storage(local)
  });
  return { element, local, session, location, submit: () => element('login-form').events.submit({ preventDefault() {} }) };
}

(async () => {
const ui = setup();
await ui.submit();
assert.equal(ui.element('email').attributes['aria-invalid'], 'true');
assert.equal(ui.element('password').attributes['aria-invalid'], 'true');
assert.ok(ui.element('email').focused);

ui.element('email').value = 'demo@jose.com';
ui.element('password').value = 'incorrecta';
await ui.submit();
assert.equal(ui.element('login-error').hidden, false);
assert.equal(ui.session.size, 0);
assert.equal(ui.element('password').value, '');

ui.element('toggle-password').events.click();
assert.equal(ui.element('password').type, 'text');
ui.element('toggle-password').events.click();
assert.equal(ui.element('password').type, 'password');

for (const name of ['recovery', 'biometric']) {
  ui.element(name).events.click();
  assert.equal(ui.element('info-dialog').open, true);
  assert.ok(ui.element('dialog-description').textContent.length > 40);
  ui.element('dialog-accept').events.click();
  assert.equal(ui.element('info-dialog').open, false);
}

ui.element('remember').checked = true;
ui.element('password').value = 'Jose2026!';
await ui.submit();
assert.equal(ui.location.destination, 'bienvenida.html');
assert.equal(ui.local.get(auth.REMEMBER_KEY), 'demo@jose.com');
assert.ok(auth.readSession({ getItem: key => ui.session.get(key) }));
assert.ok(!JSON.stringify([...ui.local, ...ui.session]).includes('Jose2026!'));
ui.element('remember').checked = false;
ui.element('remember').events.change();
assert.equal(ui.local.size, 0);

const blocked = setup(true);
blocked.element('email').value = 'demo@jose.com';
blocked.element('password').value = 'Jose2026!';
await blocked.submit();
assert.equal(blocked.location.destination, undefined);
assert.equal(blocked.element('submit-login').disabled, false);
assert.equal(blocked.element('login-error').hidden, false);
console.log('OK: campos, credenciales incorrectas, visibilidad, diálogos, acceso, recordar usuario y almacenamiento bloqueado');

})().catch(error => { console.error(error); process.exitCode = 1; });
