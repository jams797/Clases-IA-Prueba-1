/* Datos ficticios y operaciones locales; reemplazar por servicios del servidor. */
(function (root) {
  'use strict';
  const actions = [
    { id: 'transferir', label: 'Transferir', icon: 'transfer' },
    { id: 'pagos', label: 'Pagar servicios', icon: 'bolt' },
    { id: 'recargas', label: 'Recargas', icon: 'phone' },
    { id: 'qr', label: 'Pago QR', icon: 'qr' },
    { id: 'productos', label: 'Mis productos', icon: 'card' },
    { id: 'movimientos', label: 'Movimientos', icon: 'history' }
  ];
  const initialProducts = [
    { id: 'ahorros', title: 'Cuenta de ahorros', type: 'Débito', label: 'Saldo disponible', balance: 245030, number: '4821', status: 'Activa', color: 'blue' },
    { id: 'credito', title: 'Tarjeta de crédito', type: 'Crédito', label: 'Cupo disponible', balance: 350000, number: '7392', status: 'Activa', color: 'navy' },
    { id: 'meta', title: 'Ahorro programado', type: 'Mi meta', label: 'Saldo ahorrado', balance: 85000, number: '1056', status: 'Activa', color: 'teal' }
  ];
  function initialState() {
    const date = days => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); };
    return {
      products: initialProducts.map(item => ({ ...item })), hidden: false, notificationsRead: false,
      shortcuts: actions.slice(0, 4).map(item => item.id),
      movements: [
        { id: 'm1', title: 'Transferencia recibida', detail: 'María García', amount: 45000, date: date(0), kind: 'transferir' },
        { id: 'm2', title: 'Pago de servicio', detail: 'Energía eléctrica', amount: -4280, date: date(1), kind: 'pagos' },
        { id: 'm3', title: 'Transferencia enviada', detail: 'Carlos Pérez', amount: -8500, date: date(1), kind: 'transferir' },
        { id: 'm4', title: 'Recarga celular', detail: 'Celular ••• 4567', amount: -1000, date: date(2), kind: 'recargas' },
        { id: 'm5', title: 'Pago recibido', detail: 'Servicios profesionales', amount: 120000, date: date(3), kind: 'transferir' },
        { id: 'm6', title: 'Pago QR', detail: 'Café de la ciudad', amount: -650, date: date(4), kind: 'qr' }
      ]
    };
  }
  function validState(value) {
    const initial = initialState();
    if (!value || !Array.isArray(value.products) || !Array.isArray(value.movements)) return initial;
    if (value.products.length !== 3 || value.products.some((p, i) => p.id !== initial.products[i].id || !Number.isSafeInteger(p.balance) || p.balance < 0)) return initial;
    if (value.movements.some(m => !m || typeof m.title !== 'string' || typeof m.detail !== 'string' || !Number.isSafeInteger(m.amount) || !Number.isFinite(Date.parse(m.date)))) return initial;
    return {
      ...initial,
      products: initial.products.map((p, i) => ({ ...p, balance: value.products[i].balance })),
      movements: value.movements.slice(0, 200), hidden: value.hidden === true, notificationsRead: value.notificationsRead === true,
      shortcuts: Array.isArray(value.shortcuts) && value.shortcuts.length > 0 && value.shortcuts.length <= 4 && new Set(value.shortcuts).size === value.shortcuts.length && value.shortcuts.every(id => actions.some(action => action.id === id)) ? value.shortcuts : initial.shortcuts
    };
  }
  function parseAmount(value) {
    const normalized = String(value).trim().replace(',', '.');
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
    const [whole, fraction = ''] = normalized.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
  }
  function validateOperation(kind, destination, amount, balance) {
    const errors = {};
    if (!['transferir', 'pagos', 'recargas', 'qr'].includes(kind)) errors.destination = 'Selecciona una operación válida.';
    else if (kind === 'recargas' && !/^0?9\d{8}$/.test(destination.replace(/[\s()-]/g, ''))) errors.destination = 'Ingresa un celular ecuatoriano válido.';
    else if (kind !== 'recargas' && destination.trim().length < 3) errors.destination = kind === 'transferir' ? 'Ingresa la cuenta o el nombre del destinatario.' : 'Ingresa la referencia o el nombre del servicio.';
    const cents = parseAmount(amount);
    if (cents === null) errors.amount = 'Ingresa un valor mayor a cero con máximo dos decimales.';
    else if (cents > balance) errors.amount = 'El valor supera el saldo disponible de tu cuenta de ahorros.';
    return { errors, cents };
  }
  function create(storage, email) {
    const key = 'jose.dashboard.' + email;
    let state;
    try { state = validState(JSON.parse(storage.getItem(key))); } catch { state = initialState(); }
    function persist(next) { storage.setItem(key, JSON.stringify(next)); state = next; }
    function get() { return JSON.parse(JSON.stringify(state)); }
    function preferences(changes) {
      const next = validState({ ...state, ...changes }); persist(next); return get();
    }
    function execute(kind, destination, amount) {
      const result = validateOperation(kind, destination, amount, state.products[0].balance);
      if (Object.keys(result.errors).length) return result;
      const titles = { transferir: 'Transferencia enviada', pagos: 'Pago de servicio', recargas: 'Recarga celular', qr: 'Pago QR' };
      const movement = { id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), title: titles[kind], detail: destination.trim(), amount: -result.cents, date: new Date().toISOString(), kind };
      const next = get(); next.products[0].balance -= result.cents;
      next.movements.unshift(movement); next.movements = next.movements.slice(0, 200);
      persist(next); return { movement };
    }
    return { get, preferences, execute };
  }
  root.JoseDashboard = { actions, initialState, parseAmount, validateOperation, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.JoseDashboard;
})(typeof window === 'undefined' ? globalThis : window);
