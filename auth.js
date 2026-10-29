/* Demo local. Sustituir authenticate por una llamada al servidor para acceso real. */
(function (root) {
  'use strict';
  const DEMO_EMAIL = 'demo@jose.com';
  const DEMO_PASSWORD = 'Jose2026!';
  const SESSION_KEY = 'jose.demo.session';
  const REMEMBER_KEY = 'jose.rememberedEmail';
  const SESSION_DURATION = 30 * 60 * 1000;
  const ACCOUNTS_KEY = 'jose.demo.accounts';
  const PREFILL_KEY = 'jose.registration.email';

  function accounts(storage) {
    try {
      const value = JSON.parse(storage.getItem(ACCOUNTS_KEY));
      return Array.isArray(value) ? value.filter(account => account && typeof account.email === 'string' && typeof account.hash === 'string' && typeof account.salt === 'string') : [];
    } catch { return []; }
  }

  async function passwordHash(password, salt) {
    if (!root.crypto?.subtle) throw Error('Abre el proyecto en localhost o HTTPS para crear credenciales de prueba.');
    const key = await root.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await root.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function verifyCredentials(email, password, storage) {
    if (authenticate(email, password)) return true;
    const account = accounts(storage).find(item => item.email === email.trim().toLowerCase());
    return Boolean(account && await passwordHash(password, account.salt) === account.hash);
  }

  function validate(email, password) {
    const errors = {};
    if (!email.trim()) errors.email = 'Ingresa tu correo electrónico.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Ingresa un correo electrónico válido.';
    if (!password) errors.password = 'Ingresa tu contraseña.';
    return errors;
  }

  function authenticate(email, password) {
    return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
  }

  function readSession(storage) {
    try {
      const session = JSON.parse(storage.getItem(SESSION_KEY));
      if ((session?.email === DEMO_EMAIL || accounts(storage).some(account => account.email === session?.email)) && Number.isFinite(session?.expiresAt) && session.expiresAt > Date.now()) return session;
      storage.removeItem(SESSION_KEY);
    } catch { /* Los datos de sesión inválidos equivalen a una sesión cerrada. */ }
    return null;
  }

  root.JoseAuth = { validate, authenticate, verifyCredentials, passwordHash, accounts, readSession, SESSION_KEY, REMEMBER_KEY, SESSION_DURATION, ACCOUNTS_KEY, PREFILL_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.JoseAuth;
})(typeof window === 'undefined' ? globalThis : window);
