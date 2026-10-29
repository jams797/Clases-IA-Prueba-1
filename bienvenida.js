'use strict';
(() => {
  const auth = window.JoseAuth;
  let expiryTimer;
  function checkSession() {
    let session = null;
    try { session = auth.readSession(sessionStorage); } catch { /* Sesión no disponible. */ }
    if (!session) { window.location.replace('index.html'); return; }
    document.querySelector('#session-email').textContent = session.email;
    document.querySelector('#session-content').hidden = false;
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(checkSession, Math.max(0, session.expiresAt - Date.now()));
  }
  document.querySelector('#logout').addEventListener('click', () => {
    try { sessionStorage.removeItem(auth.SESSION_KEY); } catch { /* No hay sesión almacenada. */ }
    window.location.replace('index.html');
  });
  window.addEventListener('pageshow', checkSession);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSession(); });
  checkSession();
})();
