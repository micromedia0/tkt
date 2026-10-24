(function () {
  function renderCreateDesk() {
    if (location.hash !== '#/crear') return;
    const app = document.querySelector('#app');
    if (!app) return;
    app.innerHTML = `<div class="shell"><form class="form" id="create-desk-form"><a href="#/">← Volver al inicio</a><h1>Creá tu mesa de ayuda</h1><p class="muted">Configurá la mesa y el acceso del administrador.</p><label>Nombre de la empresa<input class="input" name="company" required placeholder="Ej. Acme Servicios"></label><label>Email del administrador<input class="input" name="adminEmail" type="email" required placeholder="admin@empresa.com"></label><label>Contraseña del administrador<input class="input" name="adminPassword" type="password" minlength="8" required placeholder="Mínimo 8 caracteres"></label><label>Nombre de la mesa<input class="input" name="desk" required placeholder="Ej. Atención al cliente"></label><label>Descripción<input class="input" name="description" placeholder="Contanos qué tipo de solicitudes recibís"></label><label>Logo de la mesa<input class="input" name="logo" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Foto de portada<input class="input" name="cover" type="file" accept="image/png,image/jpeg,image/webp"></label><button class="button" type="submit">Crear mesa de ayuda</button></form></div>`;
    document.querySelector('#create-desk-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      const form = new FormData(event.target);
      const slug = String(form.get('desk')).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mesa-de-ayuda';
      const logoFile = form.get('logo');
      const logoUrl = logoFile instanceof File && logoFile.size ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(logoFile); }) : '';
      const coverFile = form.get('cover');
      const coverUrl = coverFile instanceof File && coverFile.size ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(coverFile); }) : '';
      const desk = { id: `desk-${Date.now()}`, name: form.get('desk'), description: form.get('description') || 'Mesa de ayuda', company: form.get('company'), open: true, public: true, categories: [] };
      const button = event.target.querySelector('button');
      button.disabled = true;
      button.textContent = 'Creando mesa...';
      try {
        const remote = window.INBOX24_SUPABASE?.createOrganizationDesk;
        if (typeof remote !== 'function') throw new Error('La conexión con Supabase no se cargó. Abrí TkT Ticketia desde http://localhost y volvé a intentar.');
        const result = await remote({ company: form.get('company'), adminEmail: form.get('adminEmail'), adminPassword: form.get('adminPassword'), deskName: form.get('desk'), description: form.get('description') || 'Mesa de ayuda', logoUrl, coverUrl });
        const created = result?.desk;
        if (!created?.id) throw new Error('Supabase no devolvió la mesa creada.');
        app.innerHTML = `<div class="empty"><span class="badge new">Mesa creada</span><h1>¡Listo!</h1><p>Tu mesa de ayuda ya está creada y abierta para configurarla.</p><p class="muted">URL pública: <strong>${location.origin}${location.pathname}#/mesa/${created.id}</strong></p><a class="button" href="#/">Volver al inicio</a></div>`;
      } catch (error) {
        const message = String(error.message || error);
        const rateLimited = message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('too many requests');
        button.disabled = false;
        button.textContent = 'Crear mesa de ayuda';
        const notice = rateLimited
          ? 'Supabase alcanzó temporalmente el límite de emails de registro. Esperá unos minutos o configurá un proveedor de correo propio en Supabase y volvé a intentar.'
          : 'No pudimos crear la mesa en Supabase. No se guardó como alta válida.';
        app.querySelector('.form').insertAdjacentHTML('beforeend', `<p class="muted">${notice}</p><p class="muted">Detalle técnico: ${message.replace(/[<>]/g, '')}</p>`);
      }
    });
  }

  addEventListener('hashchange', () => setTimeout(renderCreateDesk, 0));
  addEventListener('DOMContentLoaded', () => setTimeout(renderCreateDesk, 0));
  setTimeout(renderCreateDesk, 0);
  renderCreateDesk();
})();
