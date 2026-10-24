(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  async function renderDesk() {
    const parts = location.hash.slice(2).split('/');
    if (parts[0] !== 'mesa' || !parts[1]) return;
    document.body.classList.add('public-desk-active');
    const app = document.querySelector('#app');
    app.innerHTML = '<div class="shell"><div class="empty">Cargando mesa...</div></div>';
    try {
      const desk = await window.INBOX24_SUPABASE.getPublicDesk(parts[1]);
      if (!desk) {
        app.innerHTML = '<div class="shell"><div class="empty"><h2>Mesa no encontrada.</h2><a class="button" href="#/">Volver al inicio</a></div></div>';
        return;
      }
      const categories = (desk.categories || []).sort((a, b) => a.position - b.position);
      const cover = desk.cover_url || '';
      const logo = desk.logo_url ? `<img class="desk-avatar" src="${esc(desk.logo_url)}" alt="Logo de ${esc(desk.name)}">` : '<div class="desk-avatar placeholder">IN</div>';
      app.innerHTML = `<div class="inbox-shell"><aside class="history-sidebar"><div class="history-caption">Mis tickets</div><div id="customer-tickets" class="customer-tickets"><div class="history-empty">Iniciá sesión para ver tus solicitudes.</div></div><div class="history-footer" id="customer-account"></div></aside><section class="shell"><section class="desk-hero" ${cover ? `style="background-image:linear-gradient(180deg,rgba(12,24,42,.08),rgba(12,24,42,.64)),url('${esc(cover)}')"` : ''}><div class="desk-avatar-wrap">${logo}</div><h1>${esc(desk.name)}</h1><p>${esc(desk.description || 'Elegí una categoría para iniciar tu solicitud.')}</p></section><div class="grid category-grid">${categories.map(category => `<a class="card category-card" href="#/solicitud/${desk.id}/${category.id}"><h3>${esc(category.name)}</h3><p class="muted">${esc(category.description || '')}</p></a>`).join('')}</div></section></div>`;
      window.renderCustomerSidebar?.();
    } catch (error) {
      app.innerHTML = '<div class="shell"><div class="empty"><h2>No pudimos cargar la mesa.</h2><a class="button" href="#/">Volver al inicio</a></div></div>';
    }
  }

  addEventListener('hashchange', renderDesk);
  addEventListener('DOMContentLoaded', renderDesk);
})();
