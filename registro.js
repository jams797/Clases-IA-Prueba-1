'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const registration = window.JoseRegistration;
  let service;
  let stage = 'data';
  let busy = false;
  const fields = ['name', 'email', 'phone', 'address', 'terms'];
  const otpInputs = Array.from(document.querySelectorAll('.otp-inputs input'));
  const titleIds = { data: 'data-title', otp: 'otp-title', password: 'password-title' };

  function storageError(error) {
    $('storage-error').textContent = error?.message || 'No se pudo guardar el progreso. Habilita el almacenamiento de sesión en tu navegador.';
    $('storage-error').hidden = false;
  }
  function show(next, focus = true) {
    stage = next;
    for (const name of ['data', 'otp', 'password']) {
      $(`step-${name}`).hidden = name !== next;
      $(`${name}-footer`).hidden = name !== next;
      const step = document.querySelector(`[data-step="${name}"]`);
      if (name === next) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    }
    $('back').setAttribute('aria-label', next === 'data' ? 'Volver al inicio de sesión' : next === 'otp' ? 'Volver a tus datos' : 'Volver a la verificación');
    document.title = `${$(titleIds[next]).textContent} | Jose S.A.`;
    if (focus) { $(titleIds[next]).focus(); window.scrollTo({ top: 0, behavior: 'instant' }); }
    updateTimer();
  }
  function fillData(data) {
    for (const field of fields) {
      if (field === 'terms') $(field).checked = Boolean(data[field]);
      else $(field).value = data[field] || '';
    }
  }
  function data() {
    return Object.fromEntries(fields.map(field => [field, field === 'terms' ? $(field).checked : $(field).value]));
  }
  function fieldError(id, message) {
    $(id).setAttribute('aria-invalid', String(Boolean(message)));
    $(`${id}-error`).textContent = message || '';
  }
  function prepareOtp(draft) {
    $('masked-phone').textContent = `+593 ${draft.data.phone.slice(0, 2)} *** ${draft.data.phone.slice(-4)}`;
    $('demo-code').textContent = draft.code;
    $('otp-error').textContent = '';
    otpInputs.forEach(input => { input.value = ''; input.classList.remove('filled'); input.removeAttribute('aria-invalid'); });
  }
  function updateTimer() {
    if (!service || stage !== 'otp') return;
    const draft = service.read();
    if (!draft) return;
    const wait = Math.max(0, Math.ceil((draft.sentAt + registration.WAIT - Date.now()) / 1000));
    const remaining = Math.max(0, Math.ceil((draft.expiresAt - Date.now()) / 1000));
    $('resend').disabled = wait > 0;
    $('resend').textContent = wait > 0 ? `Reenviar (${wait}s)` : 'Reenviar';
    $('code-time').textContent = remaining ? `El código vence en ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'El código venció. Solicita uno nuevo.';
  }

  try {
    sessionStorage.setItem('jose.storage.probe', '1');
    sessionStorage.removeItem('jose.storage.probe');
    service = registration.create(sessionStorage, window.JoseAuth);
    const draft = service.read();
    if (draft) {
      fillData(draft.data);
      prepareOtp(draft);
      show(draft.verified && draft.expiresAt > Date.now() ? 'password' : 'otp', false);
    }
  } catch {
    storageError();
    document.querySelectorAll('form button[type="submit"]').forEach(button => { button.disabled = true; });
  }

  fields.forEach(field => {
    $(field).addEventListener(field === 'terms' ? 'change' : 'input', () => {
      if ($(field).hasAttribute('aria-invalid')) fieldError(field, registration.validate(data())[field]);
    });
    if (field !== 'terms') $(field).addEventListener('blur', () => fieldError(field, registration.validate(data())[field]));
  });
  $('data-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!service) return;
    try {
      const result = service.start(data());
      fields.forEach(field => fieldError(field, result.errors?.[field]));
      if (result.errors) { $(fields.find(field => result.errors[field])).focus(); return; }
      $('storage-error').hidden = true;
      prepareOtp(result.draft);
      show('otp');
      otpInputs[0].focus();
    } catch { storageError(); }
  });

  function spreadDigits(index, text) {
    const digits = text.replace(/\D/g, '').slice(0, 6 - index);
    if (!digits) { otpInputs[index].value = ''; otpInputs[index].classList.remove('filled'); return; }
    Array.from(digits).forEach((digit, offset) => {
      otpInputs[index + offset].value = digit;
      otpInputs[index + offset].classList.add('filled');
    });
    otpInputs[Math.min(index + digits.length, 5)].focus();
  }
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      const value = input.value;
      $('otp-error').textContent = '';
      otpInputs.forEach(box => box.removeAttribute('aria-invalid'));
      spreadDigits(value.length === 6 ? 0 : index, value);
    });
    input.addEventListener('paste', event => {
      event.preventDefault();
      const value = event.clipboardData.getData('text').replace(/\D/g, '');
      spreadDigits(value.length >= 6 ? 0 : index, value);
      $('otp-error').textContent = '';
    });
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !input.value && index > 0) {
        event.preventDefault(); otpInputs[index - 1].value = ''; otpInputs[index - 1].classList.remove('filled'); otpInputs[index - 1].focus();
      } else if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); otpInputs[index - 1].focus(); }
      else if (event.key === 'ArrowRight' && index < 5) { event.preventDefault(); otpInputs[index + 1].focus(); }
    });
  });
  $('otp-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!service) return;
    try {
      service.verify(otpInputs.map(input => input.value).join(''));
      show('password');
    } catch (error) {
      $('otp-error').textContent = error.message;
      otpInputs.forEach(input => input.setAttribute('aria-invalid', 'true'));
      (otpInputs.find(input => !input.value) || otpInputs[0]).focus();
    }
  });
  $('resend').addEventListener('click', () => {
    try {
      prepareOtp(service.resend()); updateTimer(); otpInputs[0].focus();
      $('resend-status').textContent = 'Se generó un nuevo código de prueba. El código anterior ya no es válido.';
    } catch (error) { $('otp-error').textContent = error.message; }
  });

  function checkPassword(showErrors = false) {
    const password = $('new-password').value;
    const confirm = $('confirm-password').value;
    const rules = registration.passwordRules(password);
    document.querySelectorAll('[data-rule]').forEach(item => {
      item.classList.toggle('met', rules[item.dataset.rule]);
      item.setAttribute('aria-label', `${item.textContent}: ${rules[item.dataset.rule] ? 'cumplido' : 'pendiente'}`);
    });
    const valid = Object.values(rules).every(Boolean);
    if (showErrors) {
      fieldError('new-password', password && valid ? '' : 'La contraseña debe cumplir todos los requisitos.');
      fieldError('confirm-password', confirm && password === confirm ? '' : 'Las contraseñas no coinciden.');
    } else if (confirm) fieldError('confirm-password', password === confirm ? '' : 'Las contraseñas no coinciden.');
    $('save-password').disabled = busy || !password || !confirm || !valid || password !== confirm;
    return valid && Boolean(confirm) && password === confirm;
  }
  for (const id of ['new-password', 'confirm-password']) {
    $(id).addEventListener('input', () => { checkPassword(); $('password-form-error').hidden = true; });
    $(id).addEventListener('blur', () => checkPassword(true));
  }
  document.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => {
    const input = $(button.dataset.toggle);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${button.dataset.toggle === 'new-password' ? 'contraseña' : 'confirmación de contraseña'}`);
  }));
  $('password-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !service || !checkPassword(true)) return;
    busy = true; $('save-password').disabled = true;
    $('back').disabled = true;
    $('save-password').textContent = 'Guardando…';
    try {
      await service.save($('new-password').value, $('confirm-password').value);
      $('new-password').value = ''; $('confirm-password').value = '';
      window.location.replace('index.html');
    } catch (error) {
      $('password-form-error').textContent = error.message;
      $('password-form-error').hidden = false;
      busy = false; $('back').disabled = false;
      $('save-password').textContent = 'Guardar contraseña';
      checkPassword();
    }
  });
  function editData() { if (!busy) show('data'); }
  $('edit-data').addEventListener('click', editData);
  $('back').addEventListener('click', () => {
    if (busy) return;
    if (stage === 'data') window.location.assign('index.html');
    else if (stage === 'otp') editData();
    else { $('new-password').value = ''; $('confirm-password').value = ''; checkPassword(); show('otp'); }
  });

  const policy = $('policy-dialog');
  document.querySelectorAll('[data-policy]').forEach(button => button.addEventListener('click', () => {
    const privacy = button.dataset.policy === 'privacy';
    $('policy-title').textContent = privacy ? 'Política de privacidad de la demo' : 'Términos de la demo';
    $('policy-description').textContent = privacy
      ? 'Usa datos ficticios. El borrador con tu nombre, correo, dirección y celular se guarda solo en esta pestaña. Al terminar se elimina el borrador y se conserva el nombre, correo y un verificador derivado de la contraseña; la contraseña no se almacena en texto. Al cerrar la pestaña se eliminan los datos de prueba. Si marcas «Recordar usuario» en el login, solo el correo permanece en el equipo hasta desmarcar la opción. No se envían SMS ni datos a un servidor.'
      : 'Esta interfaz permite probar el registro y acceso con datos ficticios. No abre una cuenta bancaria real ni permite operaciones financieras. El código OTP es simulado. La aceptación corresponde únicamente a esta demostración; los términos definitivos deberán incorporarse antes de ofrecer el servicio real.';
    policy.showModal();
  }));
  $('close-policy').addEventListener('click', () => policy.close());
  $('accept-policy').addEventListener('click', () => policy.close());
  setInterval(updateTimer, 1000);
  window.addEventListener('pageshow', () => {
    if (service && stage !== 'data' && !service.read()) show('data');
    updateTimer();
  });
})();
