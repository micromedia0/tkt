(function () {
  function renderLogin() {
    if (location.hash !== '#/login') return;
    const app = document.querySelector('#app');
      app.innerHTML = `<div class="shell"><form class="form" id="login-form"><a href="#/">← Volver al inicio</a><h1>Ingresar</h1><p class="muted">Accedé al Inbox de tu empresa.</p><label>Email<input class="input" name="email" type="email" required autocomplete="email"></label><label>Contraseña<input class="input" name="password" type="password" required autocomplete="current-password"></label><button class="button" type="submit">Ingresar al Inbox</button><a href="#/recuperar" class="muted">¿Olvidaste tu contraseña?</a><p id="login-error" class="muted"></p></form></div>`;
    document.querySelector('#login-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const button = event.target.querySelector('button');
      const error = document.querySelector('#login-error');
      button.disabled = true;
      button.textContent = 'Ingresando...';
      error.textContent = '';
      try {
        const session = await window.INBOX24_SUPABASE.signInAdmin(form.get('email'), form.get('password'));
        localStorage.setItem('inbox24-session', JSON.stringify(session));
        location.hash = '#/inbox';
      } catch (err) {
        error.textContent = err.message || 'No pudimos iniciar sesión.';
        button.disabled = false;
        button.textContent = 'Ingresar al Inbox';
      }
    });
  }

  function renderRecovery() {
    if (location.hash !== '#/recuperar') return;
    const customerSession = JSON.parse(localStorage.getItem('inbox24-customer-session') || 'null');
    if (customerSession?.access_token && window.INBOX24_SUPABASE?.updateCustomerPassword) return;
    const app = document.querySelector('#app');
    app.innerHTML = `<div class="shell"><form class="form" id="recovery-form"><a href="#/login">← Volver al ingreso</a><h1>Recuperar contraseña</h1><p class="muted">Te enviaremos un enlace para crear una nueva contraseña.</p><label>Email<input class="input" name="email" type="email" required autocomplete="email"></label><button class="button" type="submit">Enviar enlace</button><p id="recovery-message" class="muted"></p></form></div>`;
    document.querySelector('#recovery-form').addEventListener('submit', async event => {
      event.preventDefault();
      const email = new FormData(event.target).get('email');
      const button = event.target.querySelector('button');
      const message = document.querySelector('#recovery-message');
      button.disabled = true;
      button.textContent = 'Enviando...';
      message.textContent = '';
      try {
        await (window.INBOX24_SUPABASE.requestCustomerPasswordReset || window.INBOX24_SUPABASE.requestPasswordReset)(email);
        message.textContent = 'Si el correo está registrado, recibirás un enlace para recuperar el acceso.';
      } catch (error) {
        message.textContent = error.message || 'No pudimos enviar el enlace.';
        button.disabled = false;
        button.textContent = 'Enviar enlace';
      }
    });
  }
  function render() { setTimeout(() => { renderLogin(); renderRecovery(); }, 0); }
  addEventListener('hashchange', render);
  addEventListener('DOMContentLoaded', render);
  render();
})();
