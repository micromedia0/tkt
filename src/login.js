(function () {
  function renderLogin() {
    if (location.hash !== '#/login') return;
    const app = document.querySelector('#app');
    app.innerHTML = `<div class="shell"><form class="form login-form" id="login-form"><a href="#/">← Volver al inicio</a><span class="eyebrow">Inbox24</span><h1>Acceso Empresas</h1><p class="muted">Ingresá al backoffice con el email y la contraseña de tu mesa de ayuda.</p><label>Email del administrador<input class="input" name="email" type="email" required autocomplete="email" placeholder="admin@empresa.com"></label><label>Contraseña<input class="input" name="password" type="password" required autocomplete="current-password" placeholder="Tu contraseña"></label><button class="button" type="submit">Ingresar al Inbox</button><p id="login-message" class="muted"></p></form></div>`;
    document.querySelector('#login-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.target), email = String(form.get('email')).trim().toLowerCase(), password = String(form.get('password') || '');
      const button = event.target.querySelector('button[type="submit"]');
      const message = document.querySelector('#login-message');
      button.disabled = true; button.textContent = 'Ingresando...'; message.textContent = '';
      try { await window.INBOX24_SUPABASE.signInAdmin(email, password); location.hash = '#/inbox'; }
      catch (error) { message.textContent = error.message || 'No pudimos enviar el enlace.'; }
      finally { button.disabled = false; button.textContent = 'Ingresar al Inbox'; }
    });
  }
  function render() { setTimeout(renderLogin, 0); }
  addEventListener('hashchange', render);
  addEventListener('DOMContentLoaded', render);
  render();
})();
