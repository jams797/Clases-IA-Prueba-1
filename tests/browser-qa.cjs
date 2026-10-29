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
  assert.equal(await evaluate('document.getElementById("customer-name").textContent'), 'Ana Pérez');
  await responsive();
  await screenshot('bienvenida');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await screenshot('inicio-escritorio');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.getElementById("toggle-balances").click()');
  assert.equal(await evaluate('document.getElementById("toggle-balances").getAttribute("aria-pressed")'), 'true');
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".product-money strong")).every(element=>element.textContent.includes("•••"))'), true);
  await evaluate('document.querySelector("#product-track button").click()');
  assert.ok(await evaluate('document.getElementById("bank-dialog-content").textContent.includes("••••••")'));
  await evaluate('document.getElementById("close-bank-dialog").click();document.getElementById("toggle-balances").click()');
  await evaluate('document.querySelectorAll("#promo-dots button")[1].click()');
  await wait('document.getElementById("promo-track").scrollLeft > 100');
  await evaluate('document.getElementById("edit-shortcuts").click()');
  await evaluate('document.querySelectorAll(".shortcut-choice input").forEach(input=>input.checked=["transferir","movimientos"].includes(input.value));document.querySelector("#bank-dialog form").requestSubmit()');
  assert.equal(await evaluate('document.querySelectorAll("#shortcuts a").length'), 2);
  const navigate = async (hash, view = hash) => {
    await evaluate(`location.hash=${JSON.stringify(hash)}`);
    await wait(`location.hash===${JSON.stringify('#' + hash)} && !document.querySelector('[data-view="${view}"]').hidden`);
  };
  await navigate('productos'); await responsive();
  assert.equal(await evaluate('document.querySelectorAll("#all-products .product-card").length'), 3);
  await navigate('notificaciones');
  await evaluate('document.getElementById("read-notifications").click()');
  assert.equal(await evaluate('document.getElementById("notification-dot").hidden'), true);
  await navigate('movimientos');
  await evaluate('document.getElementById("movement-filter").value="ingresos";document.getElementById("movement-filter").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.querySelectorAll("#all-movements article").length'), 2);
  await navigate('transferir', 'operacion'); await responsive();
  await evaluate('document.getElementById("operation-form").requestSubmit()');
  assert.ok(await evaluate('document.getElementById("destination-error").textContent'));
  await evaluate('document.getElementById("destination").value="Carlos Pérez";document.getElementById("amount").value="12,35";document.getElementById("operation-form").requestSubmit()');
  assert.equal(await evaluate('document.getElementById("bank-dialog").open'), true);
  await evaluate('document.querySelector("#bank-dialog .dialog-actions .secondary").click()');
  assert.equal(await evaluate('JoseDashboard.create(sessionStorage,"ana.browser@example.com").get().products[0].balance'), 245030);
  await evaluate('document.getElementById("operation-form").requestSubmit();document.querySelector("#bank-dialog .dialog-actions .primary").click()');
  await wait('location.hash==="#movimientos" && !document.querySelector("[data-view=movimientos]").hidden');
  assert.equal(await evaluate('JoseDashboard.create(sessionStorage,"ana.browser@example.com").get().products[0].balance'), 243795);
  assert.equal(await evaluate('document.querySelector("#all-movements .movement-info p").textContent'), 'Carlos Pérez');
  for (const kind of ['pagos', 'recargas', 'qr']) { await navigate(kind, 'operacion'); await responsive(); }
  await navigate('perfil'); await responsive();
  assert.equal(await evaluate('document.querySelector("[data-nav=perfil]").getAttribute("aria-current")'), 'page');
  await screenshot('perfil');
  await evaluate('const expired=JSON.parse(sessionStorage.getItem(JoseAuth.SESSION_KEY));expired.expiresAt=Date.now()-1;sessionStorage.setItem(JoseAuth.SESSION_KEY,JSON.stringify(expired));document.dispatchEvent(new Event("visibilitychange"))');
  await wait('location.pathname==="/index.html" && document.readyState==="complete"');
  await evaluate('document.getElementById("email").value="ana.browser@example.com";document.getElementById("password").value="Nueva2026!";document.getElementById("login-form").requestSubmit()');
  await wait('location.pathname==="/bienvenida.html" && document.readyState==="complete" && !document.getElementById("session-content").hidden');
  assert.equal(await evaluate('document.querySelectorAll("#shortcuts a").length'), 2);
  await navigate('perfil');
  await evaluate('document.getElementById("logout").click()');
  await wait('location.pathname === "/index.html" && document.readyState === "complete"');
  assert.equal(await evaluate('sessionStorage.getItem(JoseAuth.SESSION_KEY)'), null);
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  await send('Page.navigate', { url: 'http://127.0.0.1:8080/bienvenida.html' });
  await wait('location.pathname==="/index.html" && document.readyState==="complete"');
  console.log('OK: Chrome a 320/390/780/1440 px, registro y login, inicio, saldos ocultos, carrusel, productos, accesos editables, notificaciones, filtros, simulación/cancelación, menú, perfil, vencimiento y protección de sesión. Capturas en /private/tmp/jose-*.png');
  socket.close();
})().catch(error => { console.error(error); process.exit(1); });
