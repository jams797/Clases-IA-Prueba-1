'use strict';
(() => {
  const auth = window.JoseAuth;
  const form = document.querySelector('#login-form');
  const email = document.querySelector('#email');
  const password = document.querySelector('#password');
  const remember = document.querySelector('#remember');
  const loginError = document.querySelector('#login-error');
  const submit = document.querySelector('#submit-login');
  const toggle = document.querySelector('#toggle-password');
  const dialog = document.querySelector('#info-dialog');

  try {
    if (auth.readSession(sessionStorage)) {
      window.location.replace('bienvenida.html');
      return;
    }
    const savedEmail = localStorage.getItem(auth.REMEMBER_KEY);
    if (savedEmail) { email.value = savedEmail; remember.checked = true; }
    const registeredEmail = sessionStorage.getItem(auth.PREFILL_KEY);
    if (registeredEmail) {
      email.value = registeredEmail;
      sessionStorage.removeItem(auth.PREFILL_KEY);
      const notice = document.createElement('p');
      notice.className = 'success-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = 'Cuenta de prueba creada. Ingresa con tu nueva contraseña.';
      form.prepend(notice);
    }
  } catch { /* El formulario sigue disponible si el navegador bloquea almacenamiento. */ }

  function setError(input, message) {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    document.getElementById(`${input.id}-error`).textContent = message || '';
  }

  for (const input of [email, password]) {
    input.addEventListener('blur', () => setError(input, auth.validate(email.value, password.value)[input.id]));
    input.addEventListener('input', () => {
      if (input.hasAttribute('aria-invalid')) setError(input, auth.validate(email.value, password.value)[input.id]);
      loginError.hidden = true;
    });
  }

  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  remember.addEventListener('change', () => {
    if (!remember.checked) {
      try { localStorage.removeItem(auth.REMEMBER_KEY); } catch { /* Almacenamiento no disponible. */ }
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    loginError.hidden = true;
    const errors = auth.validate(email.value, password.value);
    setError(email, errors.email);
    setError(password, errors.password);
    if (Object.keys(errors).length) {
      (errors.email ? email : password).focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Verificando…';
    let accepted = false;
    let verificationError = '';
    const loginEmail = email.value.trim().toLowerCase();
    try { accepted = await auth.verifyCredentials(loginEmail, password.value, sessionStorage); }
    catch { verificationError = 'No se pudieron verificar las credenciales. Utiliza localhost o HTTPS y vuelve a intentar.'; }
    submit.disabled = false;
    submit.textContent = 'Iniciar sesión';
    if (!accepted) {
      loginError.textContent = verificationError || 'El usuario o la contraseña son incorrectos. Revisa tus datos e intenta nuevamente.';
      loginError.hidden = false;
      password.value = '';
      password.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Iniciando sesión…';
    try {
      sessionStorage.setItem(auth.SESSION_KEY, JSON.stringify({ email: loginEmail, expiresAt: Date.now() + auth.SESSION_DURATION }));
    } catch {
      loginError.textContent = 'Activa el almacenamiento de sesión en tu navegador para poder ingresar.';
      loginError.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Iniciar sesión';
      return;
    }
    try {
      if (remember.checked) localStorage.setItem(auth.REMEMBER_KEY, email.value.trim());
      else localStorage.removeItem(auth.REMEMBER_KEY);
    } catch { /* Recordar usuario es opcional. */ }
    password.value = '';
    window.location.assign('bienvenida.html');
  });

  const messages = {
    recovery: ['Recuperar contraseña', 'Esta versión es una demostración y todavía no envía correos de recuperación. Puedes ingresar con demo@jose.com y la contraseña Jose2026!. En el proyecto final, esta opción se conectará con el servicio de recuperación de cuentas.'],
    biometric: ['Acceso con biometría', 'El acceso biométrico requiere una cuenta vinculada y un servicio de autenticación compatible con claves de acceso (WebAuthn). Aún no está configurado en esta demostración. Ingresa con tu usuario y contraseña de prueba.']
  };
  document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => {
    const [title, description] = messages[button.dataset.dialog];
    document.querySelector('#dialog-title').textContent = title;
    document.querySelector('#dialog-description').textContent = description;
    dialog.showModal();
  }));
  document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
  document.querySelector('#dialog-accept').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
})();
