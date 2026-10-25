(function () {
  function renderLogin() {
    if (location.hash === '#/recuperar-admin') { renderAdminRecovery(); return; }
    if (location.hash !== '#/login') return;
    const app = document.querySelector('#app');
    app.innerHTML = `<div class="shell"><form class="form login-form" id="login-form"><a href="#/">← Volver al inicio</a><span class="eyebrow">Inbox24</span><h1>Acceso Empresas</h1><p class="muted">Ingresá al backoffice con el email y la contraseña de tu mesa de ayuda.</p><label>Email del administrador<input class="input" name="email" type="email" required autocomplete="email" placeholder="admin@empresa.com"></label><label>Contraseña<input class="input" name="password" type="password" required autocomplete="current-password" placeholder="Tu contraseña"></label><button class="button" type="submit">Ingresar al Inbox</button><a class="customer-link" href="#/recuperar-admin">Olvidé mi contraseña</a><a class="button secondary" href="#/crear">Crear mesa de ayuda</a><p id="login-message" class="muted"></p></form></div>`;
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
  function renderAdminRecovery() {
    const app = document.querySelector('#app');
    const adminSession = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
    if (adminSession?.access_token) {
      app.innerHTML = `<div class="shell"><form class="form login-form" id="admin-password-form"><a href="#/login">← Volver al acceso empresas</a><span class="eyebrow">Seguridad</span><h1>Elegí una nueva contraseña</h1><p class="muted">La contraseña del administrador se actualizará ahora.</p><label>Nueva contraseña<input class="input" name="password" type="password" minlength="8" required></label><label>Repetir contraseña<input class="input" name="confirmation" type="password" minlength="8" required></label><button class="button" type="submit">Guardar contraseña</button><p id="recovery-message" class="muted"></p></form></div>`;
      document.querySelector('#admin-password-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.target, data = new FormData(form), message = document.querySelector('#recovery-message');
        if (data.get('password') !== data.get('confirmation')) { message.textContent = 'Las contraseñas no coinciden.'; return; }
        const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Guardando...';
        try { await window.INBOX24_SUPABASE.updateCustomerPassword(data.get('password')); message.textContent = 'Contraseña actualizada. Ya podés ingresar.'; setTimeout(() => { localStorage.removeItem('inbox24-session'); location.hash = '#/login'; }, 900); }
        catch (error) { message.textContent = error.message || 'No pudimos actualizar la contraseña.'; button.disabled = false; button.textContent = 'Guardar contraseña'; }
      });
      return;
    }
    app.innerHTML = `<div class="shell"><form class="form login-form" id="admin-recovery-form"><a href="#/login">← Volver al acceso empresas</a><span class="eyebrow">Seguridad</span><h1>Recuperar contraseña</h1><p class="muted">Te enviaremos un enlace al email del administrador.</p><label>Email del administrador<input class="input" name="email" type="email" required autocomplete="email" placeholder="admin@empresa.com"></label><button class="button" type="submit">Enviar enlace</button><p id="recovery-message" class="muted"></p></form></div>`;
    document.querySelector('#admin-recovery-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.target, email = String(new FormData(form).get('email')).trim().toLowerCase(), button = form.querySelector('button'), message = document.querySelector('#recovery-message');
      button.disabled = true; button.textContent = 'Enviando...'; message.textContent = '';
      try { await window.INBOX24_SUPABASE.requestPasswordReset(email); message.textContent = 'Revisá tu correo. Te enviamos un enlace para cambiar tu contraseña.'; }
      catch (error) { message.textContent = error.message || 'No pudimos enviar el enlace.'; button.disabled = false; button.textContent = 'Enviar enlace'; }
    });
  }
  function render() { setTimeout(renderLogin, 0); }
  addEventListener('hashchange', render);
  addEventListener('DOMContentLoaded', render);
  render();
})();
