/* Flujo local de demostración. Un servidor debe controlar estos estados en producción. */
(function (root) {
  'use strict';
  const KEY = 'jose.registration.draft';
  const TTL = 5 * 60 * 1000;
  const WAIT = 30 * 1000;
  const normalizePhone = value => value.replace(/[\s()-]/g, '').replace(/^\+593/, '').replace(/^0/, '');
  const passwordRules = password => ({ length: password.length >= 8, uppercase: /[A-ZÁÉÍÓÚÜÑ]/.test(password), number: /[0-9]/.test(password), symbol: /[^\p{L}\p{N}\s]/u.test(password) });
  function validate(data) {
    const errors = {};
    if (!data.name.trim() || data.name.trim().split(/\s+/).length < 2) errors.name = 'Ingresa tus nombres y apellidos.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = 'Ingresa un correo electrónico válido.';
    if (!/^9\d{8}$/.test(normalizePhone(data.phone))) errors.phone = 'Ingresa un celular de 9 dígitos que comience con 9 (o 10 con el 0 inicial).';
    if (data.address.trim().length < 5) errors.address = 'Ingresa una dirección con calle, número y ciudad.';
    if (!data.terms) errors.terms = 'Debes aceptar los términos y la política de privacidad.';
    return errors;
  }
  function create(storage, auth, crypto = root.crypto, now = () => Date.now()) {
    function read() {
      try {
        const draft = JSON.parse(storage.getItem(KEY));
        if (draft && draft.data && !Object.keys(validate(draft.data)).length && /^\d{6}$/.test(draft.code) && Number.isFinite(draft.expiresAt) && Number.isFinite(draft.sentAt) && Number.isInteger(draft.attempts)) return draft;
      } catch { /* Borrador inexistente o inválido. */ }
      return null;
    }
    function write(draft) { storage.setItem(KEY, JSON.stringify(draft)); return draft; }
    function issue(data) {
      const bytes = crypto.getRandomValues(new Uint32Array(1));
      return write({ data, code: String(100000 + bytes[0] % 900000), sentAt: now(), expiresAt: now() + TTL, attempts: 0, verified: false });
    }
    function start(data) {
      const errors = validate(data);
      const normalized = { name: data.name.trim(), email: data.email.trim().toLowerCase(), phone: normalizePhone(data.phone), address: data.address.trim(), terms: Boolean(data.terms) };
      if (normalized.email === 'demo@jose.com' || auth.accounts(storage).some(account => account.email === normalized.email)) errors.email = 'Este correo ya tiene una cuenta de prueba. Inicia sesión.';
      if (Object.keys(errors).length) return { errors };
      const prior = read();
      if (prior && JSON.stringify(prior.data) === JSON.stringify(normalized)) return { draft: prior };
      return { draft: issue(normalized) };
    }
    function resend() {
      const draft = read();
      if (!draft) throw Error('Completa tus datos antes de solicitar un código.');
      if (now() - draft.sentAt < WAIT) throw Error('Espera a que termine el contador para reenviar.');
      let next = issue(draft.data);
      // Asegura que el código anterior quede invalidado incluso ante una coincidencia aleatoria.
      if (next.code === draft.code) { next.code = String(100000 + (Number(next.code) - 100000 + 1) % 900000); next = write(next); }
      return next;
    }
    function verify(code) {
      const draft = read();
      if (!draft) throw Error('Completa primero tus datos.');
      if (now() >= draft.expiresAt) throw Error('El código venció. Solicita uno nuevo.');
      if (draft.attempts >= 5) throw Error('Alcanzaste los 5 intentos. Solicita un nuevo código.');
      if (!/^\d{6}$/.test(code)) throw Error('Ingresa los 6 dígitos del código.');
      if (code !== draft.code) {
        draft.attempts++; draft.verified = false; write(draft);
        throw Error(draft.attempts >= 5 ? 'Alcanzaste los 5 intentos. Solicita un nuevo código.' : `Código incorrecto. Te quedan ${5 - draft.attempts} intentos.`);
      }
      draft.verified = true; return write(draft);
    }
    async function save(password, confirm) {
      const draft = read();
      if (!draft?.verified) throw Error('Verifica primero el código OTP.');
      if (now() >= draft.expiresAt) throw Error('La verificación venció. Vuelve y solicita un nuevo código.');
      if (!Object.values(passwordRules(password)).every(Boolean)) throw Error('La contraseña debe cumplir todos los requisitos.');
      if (password !== confirm) throw Error('Las contraseñas no coinciden.');
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
      const hash = await auth.passwordHash(password, salt);
      const current = read();
      if (!current?.verified || current.code !== draft.code || current.sentAt !== draft.sentAt || now() >= current.expiresAt) throw Error('La verificación cambió o venció. Verifica el código nuevamente.');
      const accounts = auth.accounts(storage);
      if (accounts.some(account => account.email === draft.data.email)) throw Error('Este correo ya está registrado.');
      accounts.push({ email: draft.data.email, name: draft.data.name, hash, salt });
      // Solo el verificador de contraseña queda en la pestaña; se descartan dirección y celular.
      storage.setItem(auth.ACCOUNTS_KEY, JSON.stringify(accounts));
      storage.setItem(auth.PREFILL_KEY, draft.data.email);
      storage.removeItem(KEY);
      return draft.data.email;
    }
    return { read, start, resend, verify, save };
  }
  root.JoseRegistration = { create, validate, passwordRules, normalizePhone, KEY, TTL, WAIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.JoseRegistration;
})(typeof window === 'undefined' ? globalThis : window);
