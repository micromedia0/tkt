(function () {
  function renderLogin() {
    if (location.hash !== '#/login') return;
    const app = document.querySelector('#app');
    app.innerHTML = `<div class="shell"><form class="form login-form" id="login-form"><a href="#/">← Volver al inicio</a><span class="eyebrow">Inbox24</span><h1>Iniciar sesión o registrarse</h1><p class="muted">Accedé a tu backoffice sin contraseñas.</p><button class="button login-google" id="admin-google" type="button">🌈 Continuar con Google</button><div class="login-divider"><span>o</span></div><label>Dirección de correo electrónico<input class="input" name="email" type="email" required autocomplete="email" placeholder="tu@empresa.com"></label><button class="button" type="submit">Continuar</button><p id="login-message" class="muted"></p></form></div>`;
    document.querySelector('#admin-google').onclick = () => window.INBOX24_SUPABASE.startAdminGoogleLogin();
    document.querySelector('#login-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.target), email = String(form.get('email')).trim().toLowerCase();
      const button = event.target.querySelector('button[type="submit"]');
      const message = document.querySelector('#login-message');
      button.disabled = true; button.textContent = 'Enviando enlace...'; message.textContent = '';
      try { await window.INBOX24_SUPABASE.requestAdminEmailLink(email); message.textContent = 'Revisá tu correo. Te enviamos un enlace para continuar.'; event.target.reset(); }
      catch (error) { message.textContent = error.message || 'No pudimos enviar el enlace.'; }
      finally { button.disabled = false; button.textContent = 'Continuar'; }
    });
  }
  function render() { setTimeout(renderLogin, 0); }
  addEventListener('hashchange', render);
  addEventListener('DOMContentLoaded', render);
  render();
})();
