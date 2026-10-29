'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const auth = window.JoseAuth;
  const model = window.JoseDashboard;
  const dialog = $('bank-dialog');
  let expiryTimer;
  let session;
  let store;
  let route = 'inicio';
  let activeProduct = 0;
  const operationKinds = ['transferir', 'pagos', 'recargas', 'qr'];
  const operationConfig = {
    transferir: { title: 'Transferir', description: 'Envía una transferencia de prueba desde tu cuenta de ahorros.', label: 'Cuenta o nombre del destinatario', placeholder: 'Ej. María García · 1234567890' },
    pagos: { title: 'Pagar servicios', description: 'Simula el pago de luz, agua, internet u otros servicios.', label: 'Servicio y referencia de pago', placeholder: 'Ej. Energía eléctrica · 12345678' },
    recargas: { title: 'Recargas', description: 'Prueba una recarga a un celular ecuatoriano.', label: 'Número celular', placeholder: '099 123 4567' },
    qr: { title: 'Pago QR', description: 'Prueba el flujo de pago ingresando una referencia ficticia. Esta demo no escanea códigos ni utiliza la cámara.', label: 'Comercio o referencia QR de prueba', placeholder: 'Ej. Café de la ciudad · QR-DEMO' }
  };
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#i-' + name); svg.append(use); return svg;
  }
  function money(cents, signed = false) {
    if (store.get().hidden) return '$ ••••••';
    const sign = signed ? (cents >= 0 ? '+ ' : '− ') : '';
    return sign + '$ ' + new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  }
  function exactMoney(cents) { return '$ ' + new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100); }
  function announce(text, error = false) {
    $('app-status').textContent = text; $('app-status').hidden = false;
    $('app-status').classList.toggle('form-error', error);
  }
  function checkSession() {
    let current = null;
    try { current = auth.readSession(sessionStorage); } catch { /* Acceso no disponible. */ }
    if (!current || (session && session.email !== current.email)) {
      $('session-content').hidden = true;
      if (dialog.open) dialog.close();
      clearTimeout(expiryTimer);
      window.location.replace('index.html'); return null;
    }
    session = current;
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(checkSession, Math.max(0, session.expiresAt - Date.now()));
    return current;
  }
  if (!checkSession()) return;
  store = model.create(sessionStorage, session.email);
  const account = auth.accounts(sessionStorage).find(item => item.email === session.email);
  const customerName = typeof account?.name === 'string' && account.name.trim() ? account.name.trim() : 'Jose Morán';
  $('customer-name').textContent = customerName;
  $('profile-name').textContent = customerName;
  $('session-email').textContent = session.email;
  $('avatar').textContent = customerName.charAt(0).toUpperCase();
  $('profile-avatar').textContent = customerName.charAt(0).toUpperCase();
  function greeting() {
    const hour = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Guayaquil', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    $('greeting').textContent = hour < 12 ? 'Buenos días,' : hour < 19 ? 'Buenas tardes,' : 'Buenas noches,';
  }
  greeting();
  function updateDots(id, index) {
    Array.from($(id).children).forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
  }
  function scrollItem(trackId, index) {
    const track = $(trackId);
    const offset = track.children[index].offsetLeft - track.children[0].offsetLeft;
    track.scrollTo({ left: offset, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function dots(id, count, trackId, label) {
    const container = $(id); container.replaceChildren();
    for (let index = 0; index < count; index++) {
      const button = node('button'); button.type = 'button';
      button.setAttribute('aria-label', `${label} ${index + 1} de ${count}`);
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => scrollItem(trackId, index)); container.append(button);
    }
  }
  function openDialog(title, content) {
    $('bank-dialog-title').textContent = title;
    $('bank-dialog-content').replaceChildren(...content);
    dialog.showModal();
  }
  function detailList(items) {
    const list = node('dl', 'dialog-details');
    items.forEach(([label, value]) => { const row = node('div'); row.append(node('dt', '', label), node('dd', '', value)); list.append(row); });
    return list;
  }
  function button(text, action, style = 'primary') {
    const result = node('button', 'button ' + style, text); result.type = 'button'; result.addEventListener('click', action); return result;
  }
  function productCard(product) {
    const card = node('button', 'product-card ' + product.color); card.type = 'button';
    const top = node('div', 'product-top');
    const title = node('div'); title.append(node('span', 'product-title', product.title), node('span', 'product-type', product.type));
    top.append(title, node('span', 'product-brand', 'Jose S.A.'));
    const amount = node('div', 'product-money'); amount.append(node('span', '', product.label), node('strong', '', money(product.balance)));
    const bottom = node('div', 'product-bottom'); bottom.append(node('span', 'product-number', '•••• ' + product.number), node('span', 'product-status', product.status));
    card.append(top, amount, bottom);
    card.addEventListener('click', () => {
      const latest = store.get().products.find(item => item.id === product.id);
      const help = node('p', '', 'Producto de demostración. Los valores y números son ficticios.');
      openDialog(latest.title, [detailList([['Tipo', latest.type], ['Número', '•••• ' + latest.number], [latest.label, money(latest.balance)], ['Estado', latest.status]]), help, button('Ver movimientos', () => { dialog.close(); go('movimientos'); })]);
    });
    return card;
  }
  function movementItem(movement) {
    const row = node('article', 'movement');
    const image = node('span', 'movement-icon'); image.append(icon(movement.kind === 'transferir' ? 'transfer' : movement.kind === 'recargas' ? 'phone' : movement.kind === 'qr' ? 'qr' : 'bolt'));
    const info = node('div', 'movement-info'); info.append(node('h3', '', movement.title), node('p', '', movement.detail));
    const value = node('div', 'movement-value');
    const date = node('time', '', new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', timeZone: 'America/Guayaquil' }).format(new Date(movement.date)));
    date.dateTime = movement.date;
    value.append(node('strong', movement.amount > 0 ? 'incoming' : '', money(movement.amount, true)), date);
    row.append(image, info, value); return row;
  }
  function renderHistory() {
    const filter = $('movement-filter').value;
    const rows = store.get().movements.filter(m => filter === 'todos' || (filter === 'ingresos' && m.amount > 0) || (filter === 'salidas' && m.amount < 0) || (filter === 'transferir' && m.kind === 'transferir') || (filter === 'pagos' && ['pagos', 'recargas', 'qr'].includes(m.kind)));
    $('all-movements').replaceChildren(...(rows.length ? rows.map(movementItem) : [node('p', 'empty-message', 'No hay movimientos para este filtro.')]));
  }
  function render() {
    const state = store.get();
    $('toggle-balances').setAttribute('aria-pressed', String(state.hidden));
    $('toggle-balances').setAttribute('aria-label', state.hidden ? 'Mostrar saldos' : 'Ocultar saldos');
    $('product-track').replaceChildren(...state.products.map(productCard));
    $('all-products').replaceChildren(...state.products.map(productCard));
    dots('product-dots', state.products.length, 'product-track', 'Producto');
    updateDots('product-dots', activeProduct);
    const track = $('product-track');
    if (track.children[activeProduct]) track.scrollLeft = track.children[activeProduct].offsetLeft - track.children[0].offsetLeft;
    $('shortcuts').replaceChildren(...state.shortcuts.map(id => {
      const action = model.actions.find(item => item.id === id);
      const link = node('a', 'shortcut'); link.href = '#' + action.id;
      const image = node('span', 'shortcut-icon'); image.append(icon(action.icon)); link.append(image, node('span', '', action.label)); return link;
    }));
    $('recent-movements').replaceChildren(...state.movements.slice(0, 4).map(movementItem));
    renderHistory();
    $('operation-balance').textContent = money(state.products[0].balance);
    $('notification-dot').hidden = state.notificationsRead;
    $('notification-dot').parentElement.setAttribute('aria-label', state.notificationsRead ? 'Ver notificaciones' : 'Ver notificaciones sin leer');
    $('read-notifications').disabled = state.notificationsRead;
    $('read-notifications').textContent = state.notificationsRead ? 'Todas leídas' : 'Marcar como leídas';
  }
  function go(next) {
    if (location.hash === '#' + next) showRoute(); else location.hash = next;
  }
  function showRoute(focus = true) {
    if (!checkSession()) return;
    if (dialog.open) dialog.close();
    const requested = location.hash.slice(1) || 'inicio';
    route = ['inicio', 'productos', 'movimientos', 'perfil', 'notificaciones', ...operationKinds].includes(requested) ? requested : 'inicio';
    const view = operationKinds.includes(route) ? 'operacion' : route;
    document.querySelectorAll('[data-view]').forEach(panel => { panel.hidden = panel.dataset.view !== view; });
    const active = route === 'transferir' ? 'transferir' : ['pagos', 'recargas', 'qr'].includes(route) ? 'pagos' : route === 'perfil' ? 'perfil' : 'inicio';
    document.querySelectorAll('[data-nav]').forEach(link => {
      if (link.dataset.nav === active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    if (view === 'operacion') {
      const config = operationConfig[route];
      $('operation-title').textContent = config.title;
      $('operation-description').textContent = config.description;
      $('destination-label').textContent = config.label;
      $('destination').placeholder = config.placeholder;
      $('destination').type = route === 'recargas' ? 'tel' : 'text';
      $('destination').inputMode = route === 'recargas' ? 'tel' : 'text';
      $('operation-form').reset();
      for (const id of ['destination', 'amount']) { $(id + '-error').textContent = ''; $(id).removeAttribute('aria-invalid'); }
      $('payment-links').hidden = route !== 'pagos';
    }
    const titles = { inicio: 'Inicio', productos: 'Mis productos', movimientos: 'Movimientos', perfil: 'Mi perfil', notificaciones: 'Notificaciones' };
    document.title = (titles[route] || operationConfig[route]?.title || 'Inicio') + ' | Jose S.A.';
    $('app-status').hidden = true;
    if (focus) { $('main-content').focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  $('toggle-balances').addEventListener('click', () => {
    try { store.preferences({ hidden: !store.get().hidden }); render(); }
    catch { announce('No se pudo guardar la preferencia. Revisa el almacenamiento del navegador.', true); }
  });
  $('movement-filter').addEventListener('change', renderHistory);
  $('read-notifications').addEventListener('click', () => {
    try { store.preferences({ notificationsRead: true }); render(); announce('Marcaste todas las notificaciones como leídas.'); }
    catch { announce('No se pudo guardar el estado de las notificaciones.', true); }
  });
  $('edit-shortcuts').addEventListener('click', () => {
    const form = node('form');
    const description = node('p', '', 'Elige entre uno y cuatro accesos para tu pantalla de inicio.');
    form.append(description);
    const selected = store.get().shortcuts;
    model.actions.forEach(action => {
      const label = node('label', 'shortcut-choice'); const input = node('input'); input.type = 'checkbox'; input.value = action.id; input.name = 'shortcut'; input.checked = selected.includes(action.id);
      label.append(input, node('span', '', action.label)); form.append(label);
    });
    const error = node('p', 'dialog-error'); error.setAttribute('role', 'alert');
    const save = node('button', 'button primary', 'Guardar accesos'); save.type = 'submit';
    form.append(error, save);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const shortcuts = Array.from(form.querySelectorAll('input:checked')).map(input => input.value);
      if (!shortcuts.length || shortcuts.length > 4) { error.textContent = 'Selecciona entre uno y cuatro accesos.'; return; }
      try { store.preferences({ shortcuts }); render(); dialog.close(); announce('Tus accesos rápidos se actualizaron.'); }
      catch { error.textContent = 'No se pudieron guardar los accesos. Intenta de nuevo.'; }
    });
    openDialog('Edita tus accesos', [form]);
  });
  $('operation-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!checkSession()) return;
    const kind = route;
    const destination = $('destination').value.trim();
    const amount = $('amount').value;
    const result = model.validateOperation(kind, destination, amount, store.get().products[0].balance);
    for (const id of ['destination', 'amount']) {
      $(id + '-error').textContent = result.errors[id] || ''; $(id).setAttribute('aria-invalid', String(Boolean(result.errors[id])));
    }
    if (Object.keys(result.errors).length) { $(Object.keys(result.errors)[0]).focus(); return; }
    const explanation = node('p', '', 'Al confirmar, se descontará este valor únicamente de tu saldo ficticio y se agregará un movimiento de prueba.');
    const error = node('p', 'dialog-error'); error.setAttribute('role', 'alert');
    const confirm = button('Confirmar simulación', () => {
      if (!checkSession()) return;
      confirm.disabled = true;
      try {
        const response = store.execute(kind, destination, amount);
        if (response.errors) { error.textContent = Object.values(response.errors).join(' '); confirm.disabled = false; return; }
        $('movement-filter').value = 'todos';
        render(); dialog.close();
        go('movimientos');
        // hashchange se procesa después; mostrar el resultado al finalizar la navegación.
        setTimeout(() => announce('Operación de prueba completada. Tu saldo ficticio y tus movimientos se actualizaron.'), 0);
      } catch { error.textContent = 'No se pudo guardar la simulación. Tu saldo no se modificó.'; confirm.disabled = false; }
    });
    const controls = node('div', 'dialog-actions'); controls.append(button('Cancelar', () => dialog.close(), 'secondary'), confirm);
    openDialog('Revisa tu operación', [detailList([['Operación', operationConfig[kind].title], ['Destino', destination], ['Valor de prueba', exactMoney(result.cents)], ['Cuenta de origen', 'Ahorros •••• 4821']]), explanation, error, controls]);
  });
  document.querySelectorAll('[data-promo]').forEach(link => link.addEventListener('click', () => go(['pagos', 'productos', 'transferir'][Number(link.dataset.promo)])));
  dots('promo-dots', 3, 'promo-track', 'Novedad');
  for (const [trackId, dotsId] of [['promo-track', 'promo-dots'], ['product-track', 'product-dots']]) {
    $(trackId).addEventListener('scroll', () => {
      const track = $(trackId);
      let nearest = 0; let distance = Infinity;
      Array.from(track.children).forEach((child, index) => {
        const next = Math.abs(child.offsetLeft - track.children[0].offsetLeft - track.scrollLeft);
        if (next < distance) { nearest = index; distance = next; }
      });
      if (trackId === 'product-track') activeProduct = nearest;
      updateDots(dotsId, nearest);
    }, { passive: true });
  }
  $('close-bank-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  $('logout').addEventListener('click', () => {
    clearTimeout(expiryTimer);
    try { sessionStorage.removeItem(auth.SESSION_KEY); } catch { /* Almacenamiento no disponible. */ }
    $('session-content').hidden = true; window.location.replace('index.html');
  });
  window.addEventListener('hashchange', showRoute);
  window.addEventListener('pageshow', () => { if (checkSession()) greeting(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && checkSession()) greeting(); });
  render(); showRoute(false); $('session-content').hidden = false;
})();
