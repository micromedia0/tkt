(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const getSession = () => JSON.parse(localStorage.getItem('inbox24-customer-session') || 'null');

  function showLogin(desk, continueWith) {
    const modal = document.createElement('div');
    modal.className = 'customer-modal';
    modal.innerHTML = '<div class="customer-modal-card"><button class="customer-modal-close" type="button">×</button><span class="eyebrow">Tu cuenta</span><h2>Ingresá para continuar</h2><p class="muted">Usá tu email y contraseña para guardar tus tickets.</p><form><label>Email<input class="input" name="email" type="email" required autocomplete="email" placeholder="tu@email.com"></label><label>Contraseña<input class="input" name="password" type="password" required minlength="8" autocomplete="current-password"></label><button class="button">Ingresar</button><p class="customer-login-error muted"></p></form><button class="customer-signup customer-link" type="button">Crear cuenta y enviar validación</button><button class="customer-forgot customer-link" type="button">Olvidé mi contraseña</button><button class="customer-google" type="button">◯ Continuar con Google</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('.customer-modal-close').onclick = () => { modal.remove(); location.hash = '#/mesa/' + desk.id; };
    modal.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const button = event.target.querySelector('button');
      const error = modal.querySelector('.customer-login-error');
      button.disabled = true; button.textContent = 'Ingresando...';
      try {
        const email = String(form.get('email')).trim().toLowerCase();
        const password = String(form.get('password'));
        const data = await window.INBOX24_SUPABASE.signInCustomer(email, password);
        localStorage.setItem('inbox24-customer-session', JSON.stringify(data));
        modal.remove(); continueWith(email);
      } catch (err) {
        error.textContent = err.message || 'No pudimos iniciar sesión.';
        button.disabled = false; button.textContent = 'Ingresar';
      }
    };
    modal.querySelector('.customer-signup').onclick = async () => { const email = modal.querySelector('[name=email]').value.trim().toLowerCase(); const password = modal.querySelector('[name=password]').value; const error = modal.querySelector('.customer-login-error'); if (!email || password.length < 8) { error.textContent = 'Ingresá un email y una contraseña de al menos 8 caracteres.'; return; } try { await window.INBOX24_SUPABASE.signUpCustomer(email, password); error.textContent = 'Te enviamos un correo para validar la cuenta. Después podrás ingresar con tu contraseña.'; } catch (err) { error.textContent = err.message || 'No pudimos crear la cuenta.'; } };
    modal.querySelector('.customer-forgot').onclick = async () => { const email = modal.querySelector('[name=email]').value.trim().toLowerCase(); const error = modal.querySelector('.customer-login-error'); if (!email) { error.textContent = 'Ingresá tu email para recuperar la contraseña.'; return; } try { await window.INBOX24_SUPABASE.requestCustomerPasswordReset(email); error.textContent = 'Te enviamos un enlace para cambiar tu contraseña.'; } catch (err) { error.textContent = err.message || 'No pudimos enviar el enlace.'; } };
    modal.querySelector('.customer-google').onclick = () => { sessionStorage.setItem('inbox24-customer-return', location.hash); window.INBOX24_SUPABASE.startCustomerGoogleLogin(); };
  }

  async function render() {
    const parts = location.hash.slice(2).split('/');
    if (parts[0] !== 'solicitud' || !parts[1] || !parts[2]) return;
    const app = document.querySelector('#app');
    app.innerHTML = '<div class="shell"><div class="empty">Cargando formulario...</div></div>';
    try {
      const desk = await window.INBOX24_SUPABASE.getPublicDesk(parts[1]);
      const category = desk?.categories?.find(item => item.id === parts[2]);
      if (!desk || !category) { app.innerHTML = '<div class="shell"><div class="empty"><h2>Solicitud no disponible.</h2></div></div>'; return; }
      const session = getSession();
      const renderForm = email => {
        app.innerHTML = '<div class="inbox-shell request-shell"><aside class="history-sidebar"><div class="history-caption">Mis tickets</div><div id="customer-tickets" class="customer-tickets"><div class="history-empty">Cargando tus solicitudes...</div></div><div class="history-footer" id="customer-account"></div></aside><section class="shell"><form class="form request-form" id="request-form"><a href="#/mesa/' + desk.id + '">← Volver a ' + esc(desk.name) + '</a><span class="eyebrow">' + esc(desk.name) + '</span><h1>' + esc(category.name) + '</h1><p class="muted">Describí el problema y la IA te va a responder por este mismo chat.</p><label>Asunto<input class="input" name="subject" required></label><label>¿Qué está pasando?<textarea class="textarea" name="message" required placeholder="Contanos qué necesitás..."></textarea></label><button class="button">Enviar solicitud →</button><p class="muted" id="request-message"></p></form></section></div>';
        window.renderCustomerSidebar?.();
        document.querySelector('#request-form').onsubmit = async event => {
          event.preventDefault();
          const form = new FormData(event.target), button = event.target.querySelector('button'), message = document.querySelector('#request-message');
          button.disabled = true; button.textContent = 'Enviando...';
          try {
            const ticket = await window.INBOX24_SUPABASE.createPublicTicket({ deskId: desk.id, categoryId: category.id, name: email, email, message: form.get('subject') + ': ' + form.get('message') });
            const localTickets = JSON.parse(localStorage.getItem('inbox24-customer-tickets') || '[]');
            localTickets.unshift({ ...ticket, requester_email: email, status: 'NEW', desks: { id: desk.id, name: desk.name, logo_url: desk.logo_url || null }, categories: { name: category.name } });
            localStorage.setItem('inbox24-customer-tickets', JSON.stringify(localTickets.slice(0, 50)));
            app.innerHTML = '<div class="inbox-shell"><aside class="history-sidebar"><div class="history-caption">Mis tickets</div><div id="customer-tickets" class="customer-tickets"></div><div class="history-footer" id="customer-account"></div></aside><section class="shell"><div class="empty"><span class="badge new">Solicitud creada</span><h1>¡Listo!</h1><p>Tu ticket <strong>' + esc(ticket.public_number) + '</strong> quedó guardado.</p><p class="muted">Volviendo al inicio...</p></div></section></div>';
            window.renderCustomerSidebar?.();
            setTimeout(() => { location.hash = '#/'; }, 2800);
          } catch (err) { message.textContent = err.message || 'No pudimos enviar la solicitud.'; button.disabled = false; button.textContent = 'Enviar solicitud →'; }
        };
      };
      if (session?.access_token && session.user?.email) renderForm(session.user.email); else showLogin(desk, renderForm);
    } catch (_) { app.innerHTML = '<div class="shell"><div class="empty"><h2>No pudimos cargar el formulario.</h2></div></div>'; }
  }
  addEventListener('hashchange', render);
  addEventListener('DOMContentLoaded', render);
  render();
})();
