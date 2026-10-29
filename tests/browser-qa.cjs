// QA opcional: requiere Node 22+ y Chrome iniciado con --remote-debugging-port=9223.
const fs = require('fs');
const assert = require('assert').strict;
(async () => {
  const tabs = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      if (message.error) reject(Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  async function wait(expression) {
    for (let attempt = 0; attempt < 80; attempt++) {
      try { if (await evaluate(expression)) return; } catch { /* Cambio de documento. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('Tiempo agotado: ' + expression);
  }
  const screenshot = async name => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync('/private/tmp/jose-' + name + '.png', Buffer.from(data, 'base64'));
  };
  async function responsive() {
    for (const width of [320, 390, 780, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Desbordamiento a ' + width);
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8080/registro.html' });
  await wait('document.readyState === "complete" && !!window.JoseRegistration');
  await evaluate('sessionStorage.clear(); localStorage.clear(); location.reload()');
  await wait('document.readyState === "complete" && !!window.JoseRegistration && !!document.getElementById("data-form")');
  await responsive(); await screenshot('registro');
  await evaluate('document.getElementById("data-form").requestSubmit()');
  assert.ok(await evaluate('document.getElementById("name-error").textContent'));
  await evaluate(`(() => {
    const data = {name:'Ana Pérez',email:'ana.browser@example.com',phone:'0991234567',address:'Calle 1, Quito'};
    for (const [id,value] of Object.entries(data)) document.getElementById(id).value=value;
    document.getElementById('terms').checked=true;
    document.getElementById('data-form').requestSubmit();
  })()`);
  assert.equal(await evaluate('document.getElementById("step-otp").hidden'), false);
  assert.equal(await evaluate('document.getElementById("resend").disabled'), true);
  await responsive(); await screenshot('otp');
  await evaluate(`(() => {const input=document.getElementById('otp-0'); input.value='000000'; input.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('otp-form').requestSubmit();})()`);
  assert.ok(await evaluate('document.getElementById("otp-error").textContent.includes("incorrecto")'));
  await evaluate(`(() => {const input=document.getElementById('otp-0'); const data=new DataTransfer(); data.setData('text',document.getElementById('demo-code').textContent); input.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true})); document.getElementById('otp-form').requestSubmit();})()`);
  assert.equal(await evaluate('document.getElementById("step-password").hidden'), false);
  assert.equal(await evaluate('document.getElementById("save-password").disabled'), true);
  await evaluate(`(() => {for(const id of ['new-password','confirm-password']){const input=document.getElementById(id);input.value='Nueva2026!';input.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
  assert.equal(await evaluate('document.getElementById("save-password").disabled'), false);
  await responsive(); await screenshot('crear-password');
  await evaluate('document.getElementById("password-form").requestSubmit()');
  await wait('location.pathname === "/index.html" && !!document.getElementById("login-form") && document.readyState === "complete"');
  assert.equal(await evaluate('document.getElementById("email").value'), 'ana.browser@example.com');
  assert.ok(await evaluate('!!document.querySelector(".success-notice")'));
  await evaluate('document.getElementById("password").value="Nueva2026!";document.getElementById("login-form").requestSubmit()');
  await wait('location.pathname === "/bienvenida.html" && document.readyState === "complete" && !document.getElementById("session-content").hidden');
  assert.equal(await evaluate('document.getElementById("session-email").textContent'), 'ana.browser@example.com');
  await screenshot('bienvenida');
  await evaluate('document.getElementById("logout").click()');
  await wait('location.pathname === "/index.html" && document.readyState === "complete"');
  assert.equal(await evaluate('sessionStorage.getItem(JoseAuth.SESSION_KEY)'), null);
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log('OK: Chrome, pantallas a 320/390/780/1440 px, validaciones, OTP pegado, alta, correo prellenado, login y cierre de sesión. Capturas en /private/tmp/jose-*.png');
  socket.close();
})().catch(error => { console.error(error); process.exit(1); });
