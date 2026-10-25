const config = window.INBOX24_CONFIG || {};

const headers = {
  apikey: config.anonKey || '',
  Authorization: `Bearer ${config.anonKey || ''}`,
  'Content-Type': 'application/json'
};

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  const v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
}));

function getCustomerUserId() {
  const session = JSON.parse(localStorage.getItem('inbox24-customer-session') || 'null');
  if (session?.user?.id) return session.user.id;
  try {
    const payload = JSON.parse(atob(String(session?.access_token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.sub || null;
  } catch (_) { return null; }
}

async function supabaseRequest(path, options = {}) {
  if (!config.url || !config.anonKey) throw new Error('Supabase no está configurado');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Supabase respondió ${response.status}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function listPublicDesks() {
  return supabaseRequest('desks?select=id,name,description,logo_url,cover_url,is_open,is_public,categories(id,name,description,active,position)&is_open=eq.true&is_public=eq.true&categories.active=eq.true&order=name');
}

async function getPublicDesk(id) {
  const rows = await supabaseRequest(`desks?select=id,name,description,logo_url,cover_url,is_open,is_public,categories(id,name,description,active,position)&id=eq.${encodeURIComponent(id)}&is_open=eq.true&categories.active=eq.true`);
  return rows[0] || null;
}

async function createPublicTicket({ deskId, categoryId, name, email, requesterId, message }) {
  requesterId = requesterId || getCustomerUserId();
  if (requesterId) {
    await supabaseRequest('users', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: requesterId, email: String(email).trim().toLowerCase(), name: name || null, active: true })
    });
  }
  const ticket = { id: newId(), public_number: `INB-${Date.now().toString().slice(-6)}`, desk_id: deskId, category_id: categoryId, requester_id: requesterId || null, requester_name: name, requester_email: email, status: 'NEW', priority: 'NORMAL' };
  await supabaseRequest('tickets', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(ticket)
  });

  await supabaseRequest('messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ticket_id: ticket.id, origin: 'USER', body: message })
  });

  return ticket;
}

async function requestEmailLink(email, intent = 'customer') {
  localStorage.setItem('inbox24-auth-intent', intent);
  const redirectTo = `${location.origin}${location.pathname}`;
  const response = await fetch(`${config.url}/auth/v1/otp`, {
    method: 'POST', headers,
    body: JSON.stringify({ email: String(email).trim().toLowerCase(), create_user: true, options: { emailRedirectTo: redirectTo } })
  });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.msg || data.message || 'No pudimos enviar el enlace de acceso.'); }
}

async function requestAdminEmailLink(email) { return requestEmailLink(email, 'admin'); }

async function signInCustomer(email, password) {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers, body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.msg || 'Email o contraseña incorrectos.');
  localStorage.setItem('inbox24-customer-session', JSON.stringify(data));
  return data;
}

async function signInAdmin(email, password) {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers, body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.msg || 'Email o contraseña incorrectos.');
  localStorage.setItem('inbox24-session', JSON.stringify(data));
  return data;
}

async function signUpCustomer(email, password) {
  const response = await fetch(`${config.url}/auth/v1/signup`, { method: 'POST', headers, body: JSON.stringify({ email, password }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.message || data.error_description || 'No pudimos crear la cuenta.');
  if (data.session) localStorage.setItem('inbox24-customer-session', JSON.stringify(data.session));
  return data;
}

async function requestCustomerPasswordReset(email) {
  const response = await fetch(`${config.url}/auth/v1/recover`, { method: 'POST', headers, body: JSON.stringify({ email, redirect_to: `${location.origin}${location.pathname}#/` }) });
  if (!response.ok) throw new Error('No pudimos enviar el enlace de recuperación.');
}

async function updateCustomerPassword(password) {
  const adminSession = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const customerSession = JSON.parse(localStorage.getItem('inbox24-customer-session') || 'null');
  const session = adminSession?.access_token ? adminSession : customerSession;
  if (!session?.access_token) throw new Error('El enlace de recuperación venció. Solicitá uno nuevo.');
  const response = await fetch(`${config.url}/auth/v1/user`, { method: 'PUT', headers: { ...headers, Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ password }) });
  if (!response.ok) throw new Error('No pudimos actualizar la contraseña.');
}

async function requestCustomerEmailLink(email) { return requestEmailLink(email, 'customer'); }

function startCustomerGoogleLogin() {
  localStorage.setItem('inbox24-auth-intent', 'customer');
  const redirectTo = `${location.origin}${location.pathname}#/`;
  location.href = `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
}

function startAdminGoogleLogin() {
  localStorage.setItem('inbox24-auth-intent', 'admin');
  const redirectTo = `${location.origin}${location.pathname}#/login`;
  location.href = `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
}

function confirmSignOut(kind = 'customer') {
  const key = kind === 'admin' ? 'inbox24-session' : 'inbox24-customer-session';
  const session = JSON.parse(localStorage.getItem(key) || 'null');
  const email = session?.user?.email || '';
  const name = email ? email.split('@')[0] : kind === 'admin' ? 'Administrador' : 'Usuario';
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'logout-modal';
    modal.innerHTML = `<div class="logout-card" role="dialog" aria-modal="true" aria-labelledby="logout-title"><h2 id="logout-title">¿Cerrar sesión?</h2><div class="logout-account"><span class="logout-avatar">${name.slice(0, 2).toUpperCase()}</span><span><b>${name}</b><small>${email}</small></span></div><p class="muted">Tendrás que volver a iniciar sesión para acceder a ${kind === 'admin' ? 'tu backoffice' : 'tus tickets'}.</p><button class="button" data-confirm>Cerrar sesión</button><button class="button secondary" data-cancel>Cancelar</button></div>`;
    document.body.appendChild(modal);
    const close = confirmed => { modal.remove(); resolve(confirmed); };
    modal.querySelector('[data-confirm]').onclick = () => { localStorage.removeItem(key); if (kind === 'admin') localStorage.removeItem('inbox24-admin-desk'); close(true); };
    modal.querySelector('[data-cancel]').onclick = () => close(false);
    modal.onclick = event => { if (event.target === modal) close(false); };
  });
}

function restoreCustomerSession() {
  const hash = location.hash;
  const queryParams = new URLSearchParams(location.search);
  const params = hash.includes('access_token=') ? new URLSearchParams(hash.slice(hash.indexOf('access_token='))) : queryParams;
  if (!hash.includes('access_token=') && params.get('type') !== 'recovery') return;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  let email = params.get('user_email') || '';
  try { if (!email && accessToken) email = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || ''; } catch (_) {}
  if (accessToken) localStorage.setItem('inbox24-customer-session', JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, user: { email } }));
  const intent = localStorage.getItem('inbox24-auth-intent') || 'customer';
  const destination = params.get('type') === 'recovery' ? (intent === 'admin' ? '#/recuperar-admin' : '#/recuperar') : intent === 'admin' ? '#/inbox' : '#/';
  if (accessToken) {
    localStorage.setItem(intent === 'admin' ? 'inbox24-session' : 'inbox24-customer-session', JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, user: { email } }));
    localStorage.removeItem('inbox24-auth-intent');
    history.replaceState(null, '', `${location.pathname}${destination}`);
  }
  else if (destination === '#/recuperar') location.hash = destination;
}

async function listCustomerTickets(email) {
  const session = JSON.parse(localStorage.getItem('inbox24-customer-session') || 'null');
  const requesterId = getCustomerUserId();
  const select = 'id,public_number,status,created_at,desk_id,category_id,requester_id,desks(id,name,logo_url,organizations(name)),categories(name)';
  const byId = requesterId ? await supabaseRequest(`tickets?select=${select}&requester_id=eq.${encodeURIComponent(requesterId)}&order=created_at.desc`) : [];
  const byEmail = await supabaseRequest(`tickets?select=${select}&requester_email=eq.${encodeURIComponent(email)}&order=created_at.desc`);
  const rows = [...byId, ...byEmail];
  return [...new Map(rows.map(row => [row.id, row])).values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function refreshAdminSession(session) {
  if (!session?.refresh_token) return null;
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  if (!response.ok) return null;
  const refreshed = await response.json();
  localStorage.setItem('inbox24-session', JSON.stringify(refreshed));
  return refreshed;
}

async function requestPasswordReset(email) {
  localStorage.setItem('inbox24-auth-intent', 'admin');
  const response = await fetch(`${config.url}/auth/v1/recover`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, redirect_to: `${location.origin}${location.pathname}#/recuperar-admin` })
  });
  if (!response.ok) throw new Error('No pudimos procesar la solicitud. Intentá nuevamente.');
}

async function listAdminTickets() {
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  if (!session?.access_token) throw new Error('Sesión vencida. Volvé a ingresar.');
  const response = await fetch(`${config.url}/rest/v1/tickets?select=id,public_number,requester_name,requester_email,status,priority,created_at,assigned_to_id,desks(name),categories(name)&order=created_at.desc`, {
    headers: { ...headers, Authorization: `Bearer ${session.access_token}` }
  });
  if (!response.ok) throw new Error(`No se pudieron cargar las solicitudes (${response.status}).`);
  return response.json();
}

async function updateAdminTicket(id, changes) {
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const response = await fetch(`${config.url}/rest/v1/tickets?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=representation' }, body: JSON.stringify(changes) });
  if (!response.ok) throw new Error(`No se pudo actualizar el ticket (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error('Supabase no actualizó el ticket. Verificá la política de actualización y que el ticket pertenezca a esta mesa.');
  return rows[0];
}

async function createAdminMessage({ ticketId, body }) {
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const response = await fetch(`${config.url}/rest/v1/messages`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=minimal' }, body: JSON.stringify({ id: newId(), ticket_id: ticketId, body, origin: 'AGENT' }) });
  if (!response.ok) throw new Error(`No se pudo enviar la respuesta (${response.status}).`);
}

async function getAdminDesk() {
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const userId = session?.user?.id;
  if (!session?.access_token || !userId) return null;
  const authHeaders = { ...headers, Authorization: `Bearer ${session.access_token}` };
  const agentResponse = await fetch(`${config.url}/rest/v1/agents?select=id,organization_id,name,email,role,active&auth_user_id=eq.${encodeURIComponent(userId)}&active=eq.true&limit=1`, { headers: authHeaders });
  if (!agentResponse.ok) throw new Error(`No se pudo cargar el agente (${agentResponse.status}).`);
  const agents = await agentResponse.json();
  if (!agents[0]?.organization_id) return null;
  const desksResponse = await fetch(`${config.url}/rest/v1/desks?select=id,name,logo_url,cover_url,is_open,is_public&organization_id=eq.${encodeURIComponent(agents[0].organization_id)}&limit=1`, { headers: authHeaders });
  if (!desksResponse.ok) throw new Error(`No se pudo cargar la mesa (${desksResponse.status}).`);
  const desk = (await desksResponse.json())[0] || null;
  if (!desk) return null;
  desk.organization_id = agents[0].organization_id;
  desk.agent_id = agents[0].id;
  const planResponse = await fetch(`${config.url}/rest/v1/plan_limits?select=plan_code,max_categories,max_agents&organization_id=eq.${encodeURIComponent(desk.organization_id)}&limit=1`, { headers: authHeaders });
  desk.plan = planResponse.ok ? (await planResponse.json())[0] || { plan_code: 'free', max_categories: 4, max_agents: 1 } : { plan_code: 'free', max_categories: 4, max_agents: 1 };
  return desk;
}

async function listAdminCategories() {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null');
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  if (!desk?.id || !session?.access_token) return [];
  const response = await fetch(`${config.url}/rest/v1/categories?select=id,name,description,active,position&desk_id=eq.${encodeURIComponent(desk.id)}&order=position`, { headers: { ...headers, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error(`No se pudieron cargar las categorías (${response.status}).`);
  return response.json();
}

async function createAdminCategory({ name, description }) {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null');
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const categories = await listAdminCategories();
  const max = Number(desk?.plan?.max_categories || 4);
  if (categories.length >= max) throw new Error(`Tu plan ${desk?.plan?.plan_code || 'free'} permite hasta ${max} categorías.`);
  const response = await fetch(`${config.url}/rest/v1/categories`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=representation' }, body: JSON.stringify({ id: newId(), desk_id: desk.id, name, description: description || null, position: categories.length, active: true }) });
  if (!response.ok) throw new Error(`No se pudo crear la categoría (${response.status}).`);
  return response.json();
}

async function updateAdminCategory(id, { name, description }) {
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const response = await fetch(`${config.url}/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=representation' }, body: JSON.stringify({ name: name.trim(), description: description?.trim() || null }) });
  if (!response.ok) throw new Error(`No se pudo actualizar la categoría (${response.status}).`);
  return response.json();
}

async function listAdminForms() {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null'); const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  if (!desk?.id || !session?.access_token) return [];
  // Los formularios se crean primero sin categoría. La política RLS ya limita
  // la respuesta a los formularios de la organización del agente, por lo que
  // no debemos filtrar por categories.desk_id y ocultar los formularios nuevos.
  const response = await fetch(`${config.url}/rest/v1/forms?select=id,name,category_id,version,active,categories(name)&order=created_at.desc`, { headers: { ...headers, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error(`No se pudieron cargar los formularios (${response.status}).`); return response.json();
}

async function createAdminForm({ name, fields }) {
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const form = { id: newId(), name: name.trim(), category_id: null, version: 1, active: true };
  const response = await fetch(`${config.url}/rest/v1/forms`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=minimal' }, body: JSON.stringify(form) });
  if (!response.ok) throw new Error(`No se pudo crear el formulario (${response.status}).`);
  if (fields.length) { const fieldsResponse = await fetch(`${config.url}/rest/v1/form_fields`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=minimal' }, body: JSON.stringify(fields.map((field, position) => ({ id: newId(), form_id: form.id, key: field.key, label: field.label, type: field.type, required: field.required, position }))) }); if (!fieldsResponse.ok) throw new Error(`No se pudieron guardar los campos (${fieldsResponse.status}).`); }
  return form;
}

async function getAdminForm(id) {
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const response = await fetch(`${config.url}/rest/v1/forms?select=id,name,category_id,version,active,form_fields(id,key,label,type,required,position)&id=eq.${encodeURIComponent(id)}`, { headers: { ...headers, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error(`No se pudo cargar el formulario (${response.status}).`); return (await response.json())[0] || null;
}

async function listAdminAgents() {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null');
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  if (!desk?.organization_id || !session?.access_token) return [];
  const response = await fetch(`${config.url}/rest/v1/agents?select=id,name,email,role,active&organization_id=eq.${encodeURIComponent(desk.organization_id)}&order=created_at`, { headers: { ...headers, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error(`No se pudieron cargar los agentes (${response.status}).`);
  const agents = await response.json();
  return agents.map(agent => ({ ...agent, user_id: agent.id, users: { name: agent.name, email: agent.email } }));
}

async function listAdminAreas() {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null');
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  if (!desk?.organization_id || !session?.access_token) return [];
  const response = await fetch(`${config.url}/rest/v1/areas?select=id,name,color,active&organization_id=eq.${encodeURIComponent(desk.organization_id)}&active=eq.true&order=name`, { headers: { ...headers, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error(`No se pudieron cargar las áreas (${response.status}).`);
  return response.json();
}

async function createAdminArea(name, color = '#2563eb') {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null');
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const response = await fetch(`${config.url}/rest/v1/areas`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: desk.organization_id, name: name.trim(), color, active: true }) });
  if (!response.ok) throw new Error(`No se pudo crear el área (${response.status}).`);
  return response.json();
}

async function listAdminAgentAreas() {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null'); const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  if (!desk?.organization_id || !session?.access_token) return [];
  const response = await fetch(`${config.url}/rest/v1/agent_areas?select=agent_id,area_id,agents!inner(organization_id)&agents.organization_id=eq.${encodeURIComponent(desk.organization_id)}`, { headers: { ...headers, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error(`No se pudieron cargar las asignaciones (${response.status}).`);
  return (await response.json()).map(link => ({ ...link, user_id: link.agent_id }));
}

async function updateAgentAreas(agentId, areaIds) {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null'); const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  const base = `${config.url}/rest/v1/agent_areas?agent_id=eq.${encodeURIComponent(agentId)}`;
  const remove = await fetch(base, { method: 'DELETE', headers: { ...headers, Authorization: `Bearer ${session.access_token}` } }); if (!remove.ok) throw new Error(`No se pudieron actualizar las áreas (${remove.status}).`);
  if (!areaIds.length) return;
  const response = await fetch(`${config.url}/rest/v1/agent_areas`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=minimal' }, body: JSON.stringify(areaIds.map(area_id => ({ agent_id: agentId, area_id }))) });
  if (!response.ok) throw new Error(`No se pudieron asignar las áreas (${response.status}).`);
}

async function updateAdminDesk(changes) {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null');
  let session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  if (!desk?.id || !session?.access_token) throw new Error('Sesión vencida. Volvé a ingresar.');
  const request = currentSession => fetch(`${config.url}/rest/v1/desks?id=eq.${encodeURIComponent(desk.id)}`, { method: 'PATCH', headers: { ...headers, Authorization: `Bearer ${currentSession.access_token}`, Prefer: 'return=representation' }, body: JSON.stringify(changes) });
  let response = await request(session);
  if (response.status === 401) {
    session = await refreshAdminSession(session);
    if (!session?.access_token) throw new Error('La sesión venció. Volvé a ingresar para cambiar el logo.');
    response = await request(session);
  }
  if (!response.ok) throw new Error(`No se pudo guardar la configuración (${response.status}).`);
  const updatedRows = await response.json();
  if (!Array.isArray(updatedRows) || !updatedRows[0]) throw new Error('Supabase no actualizó la mesa. El agente no tiene permisos sobre esta mesa.');
  const updated = updatedRows[0];
  localStorage.setItem('inbox24-admin-desk', JSON.stringify({ ...desk, ...updated }));
  return updated;
}

async function deleteAdminDesk() {
  const desk = JSON.parse(localStorage.getItem('inbox24-admin-desk') || 'null');
  const session = JSON.parse(localStorage.getItem('inbox24-session') || 'null');
  if (!desk?.id || !session?.access_token) throw new Error('Sesión vencida. Volvé a ingresar.');
  const response = await fetch(`${config.url}/rest/v1/desks?id=eq.${encodeURIComponent(desk.id)}`, {
    method: 'DELETE',
    headers: { ...headers, Authorization: `Bearer ${session.access_token}` }
  });
  if (!response.ok) throw new Error(`No se pudo eliminar la mesa (${response.status}).`);
  localStorage.removeItem('inbox24-admin-desk');
  localStorage.removeItem('inbox24-session');
}

async function createOrganizationDesk({ company, adminEmail, adminPassword, deskName, description, logoUrl, coverUrl }) {
  const authResponse = await fetch(`${config.url}/auth/v1/signup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  if (!authResponse.ok) {
    const authError = await authResponse.json().catch(() => ({}));
    throw new Error(authError.msg || authError.message || 'No se pudo crear el administrador');
  }
  const authData = await authResponse.json();
  const adminId = authData.user?.id || authData.id;
  if (!adminId) {
    throw new Error(authData.msg || authData.message || authData.error_description || 'Supabase no devolvió el usuario administrador. Verificá el correo y la contraseña.');
  }

  const organization = { id: newId(), name: company };
  await supabaseRequest('organizations', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(organization)
  });
  await supabaseRequest('agents', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: newId(), auth_user_id: adminId, organization_id: organization.id, email: adminEmail, name: company, role: 'superadmin', active: true })
  });
  const slug = `${deskName}-${Date.now()}`.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const desk = { id: newId(), organization_id: organization.id, name: deskName, slug, description, logo_url: logoUrl || null, cover_url: coverUrl || null, is_open: true, is_public: true };
  await supabaseRequest('desks', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(desk)
  });
  const category = { id: newId(), desk_id: desk.id, name: 'Consulta general', description: 'Preguntas y solicitudes generales.', position: 0, active: true };
  await supabaseRequest('categories', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(category)
  });
  await supabaseRequest('forms', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: newId(), category_id: category.id })
  });
  return { organization, desk, category };
}

window.INBOX24_SUPABASE = { listPublicDesks, getPublicDesk, createPublicTicket, createOrganizationDesk, requestAdminEmailLink, signInAdmin, signInCustomer, signUpCustomer, requestCustomerPasswordReset, updateCustomerPassword, requestCustomerEmailLink, startCustomerGoogleLogin, startAdminGoogleLogin, confirmSignOut, restoreCustomerSession, listCustomerTickets, requestPasswordReset, listAdminTickets, updateAdminTicket, createAdminMessage, getAdminDesk, listAdminCategories, createAdminCategory, updateAdminCategory, listAdminForms, createAdminForm, getAdminForm, listAdminAgents, listAdminAreas, createAdminArea, listAdminAgentAreas, updateAgentAreas, updateAdminDesk, deleteAdminDesk };
restoreCustomerSession();
