(function () {
  let desksPromise = null;
  let searchSequence = 0;
  let debounceTimer = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const isSearchRoute = () => !location.hash || location.hash === '#/' || location.hash === '#/buscar' || location.hash === '#/recuperar' || location.hash.startsWith('#/ticket/');

  function renderSearch() {
    if (!isSearchRoute()) return;
    if (location.hash === '#/recuperar') { renderRecovery(); return; }
    document.body.classList.remove('public-desk-active');
    const app = document.querySelector('#app');
    if (!app) return;
    app.innerHTML = `<div class="inbox-shell"><aside class="history-sidebar"><div class="history-caption">Mis tickets</div><div id="customer-tickets" class="customer-tickets"><div class="history-empty">Iniciá sesión para ver tus solicitudes.</div></div><div class="history-footer" id="customer-account"></div></aside><section class="shell"><section class="hero"><span class="eyebrow">Tu centro de ayuda</span><h1>Tu mesa de ayuda,<br><em>sin vueltas.</em></h1><p>Buscá una empresa, contanos qué necesitás y la IA se encarga del resto.</p><form class="search" id="public-search-form"><span>⌕</span><input class="input" id="public-search-input" name="q" placeholder="Buscá una empresa o servicio" autocomplete="off" autofocus><button class="button">Buscar</button></form></section><div id="public-results"></div></section></div>`;
    renderCustomerSidebar();
    const returnRoute = sessionStorage.getItem('inbox24-customer-return');
    if (returnRoute && JSON.parse(localStorage.getItem('inbox24-customer-session') || 'null')?.access_token) { sessionStorage.removeItem('inbox24-customer-return'); location.hash = returnRoute; }
    const form = document.querySelector('#public-search-form');
    const input = document.querySelector('#public-search-input');
    form.addEventListener('submit', event => { event.preventDefault(); runSearch(input.value); });
    input.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => runSearch(input.value), 100); });
  }

  function renderRecovery() {
    const app = document.querySelector('#app');
    const recoveryError = location.hash.includes('otp_expired') || location.hash.includes('access_denied');
    if (recoveryError) { app.innerHTML = '<div class="shell"><div class="empty"><span class="badge new">Enlace vencido</span><h1>Solicitá un enlace nuevo</h1><p>Este enlace de recuperación ya fue usado o venció. Volvé al inicio y elegí “Olvidé mi contraseña” nuevamente.</p><a class="button" href="#/">Volver al inicio</a></div></div>'; return; }
    app.innerHTML = '<div class="shell"><form class="form recovery-form"><span class="eyebrow">Seguridad</span><h1>Elegí una nueva contraseña</h1><p class="muted">La contraseña se actualizará para tu cuenta de TkT Ticketia.</p><label>Nueva contraseña<input class="input" name="password" type="password" minlength="8" required></label><label>Repetir contraseña<input class="input" name="confirmation" type="password" minlength="8" required></label><button class="button">Guardar contraseña</button><p class="muted recovery-message"></p></form></div>';
    const form = app.querySelector('form');
    form.onsubmit = async event => { event.preventDefault(); const data = new FormData(form), message = form.querySelector('.recovery-message'); if (data.get('password') !== data.get('confirmation')) { message.textContent = 'Las contraseñas no coinciden.'; return; } const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Guardando...'; try { await window.INBOX24_SUPABASE.updateCustomerPassword(data.get('password')); message.textContent = 'Contraseña actualizada. Ya podés ingresar normalmente.'; setTimeout(() => { location.hash = '#/'; }, 900); } catch (error) { message.textContent = error.message || 'No pudimos actualizar la contraseña.'; button.disabled = false; button.textContent = 'Guardar contraseña'; } };
  }

  async function renderCustomerSidebar() {
    const account = document.querySelector('#customer-account');
    const tickets = document.querySelector('#customer-tickets');
    if (!account || !tickets) return;
    const session = JSON.parse(localStorage.getItem('inbox24-customer-session') || 'null');
    const email = session?.user?.email;
    if (!email) {
      tickets.innerHTML = '<div class="history-empty">Tus tickets aparecerán acá.</div>';
      account.innerHTML = '<button class="history-login" id="customer-login-trigger"><span class="history-avatar">◎</span><span><b>Iniciá sesión</b></span></button>';
      document.querySelector('#customer-login-trigger').onclick = showCustomerLogin;
      return;
    }
    account.innerHTML = '<div class="history-user"><span class="history-avatar">' + esc(email[0].toUpperCase()) + '</span><span><b>' + esc(email.split('@')[0]) + '</b><small>' + esc(email) + '</small></span><button id="customer-logout" title="Cerrar sesión">↪</button></div>';
    document.querySelector('#customer-logout').onclick = () => { localStorage.removeItem('inbox24-customer-session'); renderCustomerSidebar(); };
    try {
      const localRows = JSON.parse(localStorage.getItem('inbox24-customer-tickets') || '[]').filter(ticket => ticket.requester_email === email);
      const rows = [...localRows, ...(await window.INBOX24_SUPABASE.listCustomerTickets(email) || [])];
      const publicDesks = await window.INBOX24_SUPABASE.listPublicDesks().catch(() => []);
      const logoByDesk = Object.fromEntries((publicDesks || []).map(desk => [desk.id, desk.logo_url]));
      rows.forEach(ticket => { if (ticket.desks && !ticket.desks.logo_url) ticket.desks.logo_url = logoByDesk[ticket.desk_id] || null; });
      const groups = {};
      (rows || []).forEach(ticket => { const company = ticket.desks?.organizations?.name || ticket.desks?.name || 'Empresa'; (groups[company] ||= []).push(ticket); });
      tickets.innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([company, items]) => { const logo = items.find(ticket => ticket.desks?.logo_url)?.desks?.logo_url; const avatar = logo ? '<img class="ticket-company-logo" src="' + esc(logo) + '" alt="Logo de ' + esc(company) + '">' : '<span class="ticket-company-avatar">' + esc(company.slice(0, 1).toUpperCase()) + '</span>'; return '<details class="ticket-company"><summary class="ticket-company-card">' + avatar + '<span><b>' + esc(company) + '</b><small>' + items.length + (items.length === 1 ? ' ticket' : ' tickets') + '</small></span><span class="ticket-company-chevron">⌄</span></summary><div class="ticket-company-chats">' + items.map(ticket => '<a class="history-ticket" href="#/ticket/' + ticket.id + '"><b>' + esc(ticket.categories?.name || 'Solicitud') + '</b><small>' + esc(ticket.status || 'En proceso') + ' · #' + esc(ticket.public_number || '') + '</small></a>').join('') + '</div></details>'; }).join('') : '<div class="history-empty">Todavía no tenés tickets.</div>';
    } catch (_) { tickets.innerHTML = '<div class="history-empty">No pudimos cargar tus tickets.</div>'; }
  }

  function showCustomerLogin() {
    const modal = document.createElement('div'); modal.className = 'customer-modal';
    modal.innerHTML = '<div class="customer-modal-card"><button class="customer-modal-close">×</button><span class="eyebrow">Tu historial</span><h2>Iniciar sesión o registrarse</h2><p class="muted">Accedé a tus tickets sin contraseñas.</p><button class="button login-google customer-google" type="button">🌈 Continuar con Google</button><div class="login-divider"><span>o</span></div><form><label>Dirección de correo electrónico<input class="input" name="email" type="email" required placeholder="tu@email.com"></label><button class="button">Continuar</button><p class="customer-login-error muted"></p></form><button class="customer-signup" hidden></button><button class="customer-forgot" hidden></button></div>';
    document.body.appendChild(modal); modal.querySelector('.customer-modal-close').onclick = () => modal.remove();
    modal.querySelector('form').onsubmit = async event => { event.preventDefault(); const email = String(new FormData(event.target).get('email')).trim().toLowerCase(), button = event.target.querySelector('button'), error = modal.querySelector('.customer-login-error'); button.disabled = true; button.textContent = 'Enviando enlace...'; try { await window.INBOX24_SUPABASE.requestCustomerEmailLink(email); error.textContent = 'Revisá tu correo. Te enviamos un enlace para continuar.'; event.target.reset(); } catch (err) { error.textContent = err.message || 'No pudimos enviar el enlace.'; } finally { button.disabled = false; button.textContent = 'Continuar'; } };
    modal.querySelector('.customer-signup').onclick = async () => { const email = modal.querySelector('[name=email]').value.trim().toLowerCase(), password = modal.querySelector('[name=password]').value, error = modal.querySelector('.customer-login-error'); if (!email || password.length < 8) { error.textContent = 'Ingresá un email y una contraseña de al menos 8 caracteres.'; return; } try { await window.INBOX24_SUPABASE.signUpCustomer(email, password); error.textContent = 'Te enviamos un correo para validar la cuenta.'; } catch (err) { error.textContent = err.message || 'No pudimos crear la cuenta.'; } };
    modal.querySelector('.customer-forgot').onclick = async () => { const email = modal.querySelector('[name=email]').value.trim().toLowerCase(), error = modal.querySelector('.customer-login-error'); if (!email) { error.textContent = 'Ingresá tu email para recuperar la contraseña.'; return; } try { await window.INBOX24_SUPABASE.requestCustomerPasswordReset(email); error.textContent = 'Te enviamos un enlace para cambiar tu contraseña.'; } catch (err) { error.textContent = err.message || 'No pudimos enviar el enlace.'; } };
    modal.querySelector('.customer-google').onclick = () => window.INBOX24_SUPABASE.startCustomerGoogleLogin();
  }

  async function getDesks() {
    if (!desksPromise) desksPromise = window.INBOX24_SUPABASE.listPublicDesks().then(items => Array.isArray(items) ? items : []);
    return desksPromise;
  }

  async function runSearch(query) {
    const results = document.querySelector('#public-results');
    if (!results || !isSearchRoute()) return;
    const normalized = String(query || '').trim().toLowerCase();
    const sequence = ++searchSequence;
    if (!normalized) { results.innerHTML = ''; return; }
    results.innerHTML = '<div class="empty">Buscando mesas...</div>';
    try {
      const desks = await getDesks();
      if (sequence !== searchSequence || !isSearchRoute()) return;
      const matches = desks.filter(desk => String(desk.name || '').toLowerCase().startsWith(normalized) || String(desk.organizations?.name || '').toLowerCase().startsWith(normalized));
      results.innerHTML = matches.length ? `<div class="grid desk-results">${matches.map(desk => `<a class="card desk-card" href="#/mesa/${desk.id}">${desk.logo_url ? `<img class="desk-logo" src="${esc(desk.logo_url)}" alt="Logo de ${esc(desk.name)}">` : '<div class="desk-logo placeholder">IN</div>'}<h3>${esc(desk.name)}</h3></a>`).join('')}</div>` : '<div class="empty">No encontramos mesas que empiecen con ese término.</div>';
    } catch (error) {
      if (sequence !== searchSequence) return;
      desksPromise = null;
      results.innerHTML = '<div class="empty">No pudimos consultar las mesas. Intentá nuevamente.</div>';
    }
  }

  addEventListener('hashchange', () => setTimeout(renderSearch, 0));
  addEventListener('DOMContentLoaded', () => setTimeout(renderSearch, 0));
  setTimeout(renderSearch, 0);
  window.renderCustomerSidebar = renderCustomerSidebar;
})();
