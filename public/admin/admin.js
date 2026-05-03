const TOKEN_KEY = 'imgkits_admin_token';
let token = localStorage.getItem(TOKEN_KEY);
let me = null;

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userChip = document.getElementById('user-chip');
const pageTitle = document.getElementById('page-title');
const pageContent = document.getElementById('page-content');
const logoutBtn = document.getElementById('logout-btn');
const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
const toastEl = document.getElementById('toast');

function api(path, opts = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { ...opts, headers }).then(async (res) => {
    if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { status: res.status, body: data });
    return data;
  });
}

function toast(msg, kind = '') {
  toastEl.textContent = msg;
  toastEl.className = 'toast' + (kind ? ' ' + kind : '');
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.hidden = true; }, 2400);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  userChip.innerHTML = `<strong>${escapeHtml(me.name || me.email)}</strong> · ${escapeHtml(me.role)}`;
  router();
}

function showLogin() {
  appView.hidden = true;
  loginView.hidden = false;
}

async function bootstrap() {
  if (!token) return showLogin();
  try {
    me = await api('/api/auth/me');
    showApp();
  } catch {
    logout();
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const fd = new FormData(loginForm);
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') })
    });
    token = data.token;
    me = data.user;
    localStorage.setItem(TOKEN_KEY, token);
    showApp();
  } catch (err) {
    loginError.hidden = false;
    loginError.textContent = err.message;
  }
});

function logout() {
  if (token) api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  token = null;
  me = null;
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
}
logoutBtn.addEventListener('click', logout);

window.addEventListener('hashchange', router);

const ROUTES = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  jobs:      { title: 'Jobs', render: renderJobs },
  users:     { title: 'Users', render: renderUsers },
  tools:     { title: 'Tools', render: renderTools },
  'api-keys':{ title: 'API Keys', render: renderApiKeys },
  settings:  { title: 'Settings', render: renderSettings },
  audit:     { title: 'Audit Logs', render: renderAudit }
};

function router() {
  if (!me) return;
  const route = (location.hash || '#dashboard').slice(1);
  const def = ROUTES[route] || ROUTES.dashboard;
  pageTitle.textContent = def.title;
  sidebarLinks.forEach(a => a.classList.toggle('active', a.dataset.route === route));
  pageContent.innerHTML = '<div class="loader">Loading…</div>';
  Promise.resolve(def.render()).catch(err => {
    pageContent.innerHTML = `<div class="card"><p style="color:#b91c1c;">Error: ${escapeHtml(err.message)}</p></div>`;
  });
}

/* =================== DASHBOARD =================== */
async function renderDashboard() {
  const stats = await api('/api/admin/stats');
  const t = stats.totals;
  const maxTrend = Math.max(...stats.trend.map(d => d.count), 1);
  const trendBars = stats.trend.map(d => `
    <div class="bar-col">
      <div class="bar" style="height: ${(d.count / maxTrend) * 160}px"></div>
      <div class="bar-label">${d.date.slice(5)}</div>
    </div>`).join('');

  const toolList = Object.entries(stats.byTool).sort((a, b) => b[1] - a[1]);
  const totalJobs = stats.totals.jobs || 1;

  pageContent.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Users</div><div class="stat-value">${t.users}</div><div class="stat-trend">${t.activeUsers} active</div></div>
      <div class="stat-card"><div class="stat-label">Jobs (24h)</div><div class="stat-value">${t.jobs24h}</div><div class="stat-trend">${t.jobs} total</div></div>
      <div class="stat-card"><div class="stat-label">Tools</div><div class="stat-value">${t.enabledTools}/${t.tools}</div><div class="stat-trend">enabled</div></div>
      <div class="stat-card"><div class="stat-label">API Keys</div><div class="stat-value">${t.apiKeys}</div><div class="stat-trend">issued</div></div>
      <div class="stat-card"><div class="stat-label">MRR</div><div class="stat-value">$${stats.revenue.mrr}</div><div class="stat-trend">${stats.revenue.currency}</div></div>
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-head"><h3>Jobs — last 7 days</h3></div>
        <div class="bar-chart">${trendBars}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3>By status</h3></div>
        <div class="donut-list">
          ${Object.entries(stats.byStatus).map(([k, v]) => `
            <div class="donut-item"><span class="pill pill-${k}">${k}</span><strong>${v}</strong></div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Tool usage</h3></div>
      ${toolList.length ? `
        <div class="donut-list">
          ${toolList.map(([slug, count]) => `
            <div class="donut-item">
              <span>${escapeHtml(slug)}</span>
              <strong>${count} (${Math.round(count / totalJobs * 100)}%)</strong>
            </div>`).join('')}
        </div>
      ` : '<div class="empty-state">No jobs yet — try a tool from the homepage.</div>'}
    </div>
  `;
}

/* =================== JOBS =================== */
async function renderJobs() {
  pageContent.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>All Jobs</h3>
        <div class="toolbar">
          <input class="input" id="jobs-q" placeholder="Search jobId or userId" />
          <select id="jobs-status">
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>
          <select id="jobs-tool"><option value="">All tools</option></select>
          <button class="btn btn-outline btn-sm" id="jobs-refresh">Refresh</button>
        </div>
      </div>
      <div id="jobs-table"><div class="loader">Loading…</div></div>
    </div>
  `;
  const tools = await api('/api/admin/tools');
  document.getElementById('jobs-tool').innerHTML += tools.map(t => `<option value="${t.slug}">${escapeHtml(t.name)}</option>`).join('');
  ['jobs-q', 'jobs-status', 'jobs-tool'].forEach(id => document.getElementById(id).addEventListener('input', loadJobs));
  document.getElementById('jobs-refresh').addEventListener('click', loadJobs);
  await loadJobs();
}

async function loadJobs() {
  const q = document.getElementById('jobs-q').value.trim();
  const status = document.getElementById('jobs-status').value;
  const tool = document.getElementById('jobs-tool').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (tool) params.set('tool', tool);
  const data = await api('/api/admin/jobs?' + params.toString());
  const tbl = document.getElementById('jobs-table');
  if (!data.items.length) {
    tbl.innerHTML = '<div class="empty-state">No jobs match these filters.</div>';
    return;
  }
  tbl.innerHTML = `
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Job</th><th>Tool</th><th>Status</th><th>Created</th><th>Done</th><th>Result</th><th>Actions</th></tr></thead>
      <tbody>${data.items.map(j => `
        <tr>
          <td><code>${j.jobId}</code></td>
          <td>${escapeHtml(j.tool)}</td>
          <td><span class="pill pill-${j.status}">${j.status}</span></td>
          <td>${fmtDate(j.createdAt)}</td>
          <td>${fmtDate(j.completedAt)}</td>
          <td>${j.resultUrl ? `<a href="${escapeHtml(j.resultUrl)}" target="_blank" rel="noopener">view</a>` : '—'}</td>
          <td><div class="row-actions">
            <button class="btn btn-success btn-sm" data-action="retry" data-id="${j.jobId}">Retry</button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${j.jobId}">Delete</button>
          </div></td>
        </tr>
      `).join('')}</tbody>
    </table></div>
  `;
  tbl.querySelectorAll('button[data-action]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    try {
      if (btn.dataset.action === 'retry') {
        await api(`/api/admin/jobs/${id}/retry`, { method: 'POST' });
        toast('Job re-queued', 'success');
      } else {
        if (!confirm(`Delete job ${id}?`)) return;
        await api(`/api/admin/jobs/${id}`, { method: 'DELETE' });
        toast('Job deleted', 'success');
      }
      await loadJobs();
    } catch (err) { toast(err.message, 'error'); }
  }));
}

/* =================== USERS =================== */
async function renderUsers() {
  pageContent.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>Users</h3>
        <div class="toolbar">
          <input class="input" id="users-q" placeholder="Search name or email" />
          <button class="btn btn-primary btn-sm" id="users-new">+ New User</button>
        </div>
      </div>
      <div id="users-table"><div class="loader">Loading…</div></div>
    </div>
  `;
  document.getElementById('users-q').addEventListener('input', loadUsers);
  document.getElementById('users-new').addEventListener('click', async () => {
    const email = prompt('Email:'); if (!email) return;
    const password = prompt('Password (min 4 chars):', 'demo'); if (!password) return;
    const name = prompt('Display name:', email.split('@')[0]) || '';
    try {
      await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ email, password, name }) });
      toast('User created', 'success');
      loadUsers();
    } catch (err) { toast(err.message, 'error'); }
  });
  await loadUsers();
}

async function loadUsers() {
  const q = document.getElementById('users-q').value.trim();
  const data = await api('/api/admin/users' + (q ? `?q=${encodeURIComponent(q)}` : ''));
  const tbl = document.getElementById('users-table');
  if (!data.items.length) { tbl.innerHTML = '<div class="empty-state">No users match.</div>'; return; }
  tbl.innerHTML = `
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Plan</th><th>Status</th><th>Credits</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>${data.items.map(u => `
        <tr>
          <td><strong>${escapeHtml(u.name || '—')}</strong><br/><code>${u.id}</code></td>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="pill pill-${u.role}">${u.role}</span></td>
          <td><span class="pill pill-${u.plan}">${u.plan}</span></td>
          <td><span class="pill pill-${u.status}">${u.status}</span></td>
          <td>${u.credits}</td>
          <td>${fmtDate(u.createdAt)}</td>
          <td><div class="row-actions">
            <button class="btn btn-outline btn-sm" data-action="edit" data-id="${u.id}">Edit</button>
            <button class="btn ${u.status === 'active' ? 'btn-danger' : 'btn-success'} btn-sm" data-action="toggle" data-id="${u.id}" data-status="${u.status}">
              ${u.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${u.id}">Delete</button>
          </div></td>
        </tr>
      `).join('')}</tbody>
    </table></div>
  `;
  tbl.querySelectorAll('button[data-action]').forEach(btn => btn.addEventListener('click', () => onUserAction(btn)));
}

async function onUserAction(btn) {
  const id = btn.dataset.id;
  try {
    if (btn.dataset.action === 'edit') {
      const credits = prompt('New credits:', '50');
      if (credits === null) return;
      const role = prompt('Role (user/admin):', 'user');
      const plan = prompt('Plan (free/pro/team):', 'free');
      await api(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: Number(credits), role, plan })
      });
      toast('User updated', 'success');
    } else if (btn.dataset.action === 'toggle') {
      const next = btn.dataset.status === 'active' ? 'suspended' : 'active';
      await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      toast(`User ${next}`, 'success');
    } else if (btn.dataset.action === 'delete') {
      if (!confirm('Delete this user?')) return;
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      toast('User deleted', 'success');
    }
    loadUsers();
  } catch (err) { toast(err.message, 'error'); }
}

/* =================== TOOLS =================== */
async function renderTools() {
  pageContent.innerHTML = `<div class="card"><div class="card-head"><h3>Tools</h3></div><div id="tools-table"><div class="loader">Loading…</div></div></div>`;
  await loadToolsAdmin();
}

async function loadToolsAdmin() {
  const tools = await api('/api/admin/tools');
  const tbl = document.getElementById('tools-table');
  tbl.innerHTML = `
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Slug</th><th>Name</th><th>Category</th><th>Credits</th><th>Enabled</th><th>Actions</th></tr></thead>
      <tbody>${tools.map(t => `
        <tr>
          <td><code>${t.slug}</code></td>
          <td>${escapeHtml(t.name)}<br/><small class="muted">${escapeHtml(t.description)}</small></td>
          <td>${escapeHtml(t.category)}</td>
          <td>${t.credits}</td>
          <td>
            <label class="switch">
              <input type="checkbox" data-slug="${t.slug}" data-action="toggle-enabled" ${t.enabled ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </td>
          <td><div class="row-actions">
            <button class="btn btn-outline btn-sm" data-slug="${t.slug}" data-action="edit-credits">Edit Credits</button>
          </div></td>
        </tr>
      `).join('')}</tbody>
    </table></div>
  `;
  tbl.querySelectorAll('input[data-action="toggle-enabled"]').forEach(input => {
    input.addEventListener('change', async () => {
      try {
        await api(`/api/admin/tools/${input.dataset.slug}`, {
          method: 'PATCH', body: JSON.stringify({ enabled: input.checked })
        });
        toast(`Tool ${input.checked ? 'enabled' : 'disabled'}`, 'success');
      } catch (err) { toast(err.message, 'error'); input.checked = !input.checked; }
    });
  });
  tbl.querySelectorAll('button[data-action="edit-credits"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const credits = prompt('Credits per call:', '1');
      if (credits === null) return;
      try {
        await api(`/api/admin/tools/${btn.dataset.slug}`, {
          method: 'PATCH', body: JSON.stringify({ credits: Number(credits) })
        });
        toast('Updated', 'success');
        loadToolsAdmin();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

/* =================== API KEYS =================== */
async function renderApiKeys() {
  pageContent.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>API Keys</h3>
        <button class="btn btn-primary btn-sm" id="key-new">+ New Key</button>
      </div>
      <div id="keys-table"><div class="loader">Loading…</div></div>
    </div>
  `;
  document.getElementById('key-new').addEventListener('click', async () => {
    const label = prompt('Label for new key:', 'My key');
    if (!label) return;
    try {
      const k = await api('/api/admin/api-keys', { method: 'POST', body: JSON.stringify({ label }) });
      alert(`Key created. Copy it now — it will not be shown again:\n\n${k.plainKey}`);
      loadKeys();
    } catch (err) { toast(err.message, 'error'); }
  });
  await loadKeys();
}

async function loadKeys() {
  const keys = await api('/api/admin/api-keys');
  const tbl = document.getElementById('keys-table');
  if (!keys.length) { tbl.innerHTML = '<div class="empty-state">No API keys yet.</div>'; return; }
  tbl.innerHTML = `
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Label</th><th>Preview</th><th>Owner</th><th>Created</th><th>Last used</th><th>Actions</th></tr></thead>
      <tbody>${keys.map(k => `
        <tr>
          <td>${escapeHtml(k.label)}</td>
          <td><code>${k.keyPreview}</code></td>
          <td><code>${k.userId}</code></td>
          <td>${fmtDate(k.createdAt)}</td>
          <td>${fmtDate(k.lastUsedAt)}</td>
          <td><button class="btn btn-danger btn-sm" data-id="${k.id}">Revoke</button></td>
        </tr>
      `).join('')}</tbody>
    </table></div>
  `;
  tbl.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Revoke this key?')) return;
      try {
        await api(`/api/admin/api-keys/${btn.dataset.id}`, { method: 'DELETE' });
        toast('Revoked', 'success');
        loadKeys();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

/* =================== SETTINGS =================== */
async function renderSettings() {
  const s = await api('/api/admin/settings');
  pageContent.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>System Settings</h3></div>
      <form id="settings-form">
        <div class="form-grid">
          <label class="field">
            <span>Site name</span>
            <input class="input" name="siteName" value="${escapeHtml(s.siteName || '')}" />
          </label>
          <label class="field">
            <span>Free credits / day</span>
            <input class="input" name="freeCreditsPerDay" type="number" value="${s.freeCreditsPerDay ?? 5}" />
          </label>
          <label class="field">
            <span>Max upload (MB)</span>
            <input class="input" name="maxUploadMb" type="number" value="${s.maxUploadMb ?? 20}" />
          </label>
          <label class="field">
            <span>Result expire (hours)</span>
            <input class="input" name="resultExpireHours" type="number" value="${s.resultExpireHours ?? 24}" />
          </label>
          <label class="switch" style="margin-top: 24px;">
            <input type="checkbox" name="maintenanceMode" ${s.maintenanceMode ? 'checked' : ''} />
            <span class="slider"></span>
            <span>Maintenance mode</span>
          </label>
          <label class="switch" style="margin-top: 24px;">
            <input type="checkbox" name="allowSignups" ${s.allowSignups ? 'checked' : ''} />
            <span class="slider"></span>
            <span>Allow signups</span>
          </label>
        </div>
        <div style="margin-top: 24px;">
          <button class="btn btn-primary" type="submit">Save Settings</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      siteName: fd.get('siteName'),
      freeCreditsPerDay: Number(fd.get('freeCreditsPerDay')),
      maxUploadMb: Number(fd.get('maxUploadMb')),
      resultExpireHours: Number(fd.get('resultExpireHours')),
      maintenanceMode: fd.get('maintenanceMode') === 'on',
      allowSignups: fd.get('allowSignups') === 'on'
    };
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
      toast('Settings saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* =================== AUDIT =================== */
async function renderAudit() {
  const logs = await api('/api/admin/audit-logs');
  pageContent.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>Audit Logs</h3></div>
      ${logs.length ? `
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Meta</th></tr></thead>
          <tbody>${logs.map(l => `
            <tr>
              <td>${fmtDate(l.at)}</td>
              <td>${escapeHtml(l.actor)}</td>
              <td><code>${escapeHtml(l.action)}</code></td>
              <td>${escapeHtml(l.target || '')}</td>
              <td><code>${escapeHtml(JSON.stringify(l.meta).slice(0, 80))}</code></td>
            </tr>`).join('')}</tbody>
        </table></div>
      ` : '<div class="empty-state">No audit logs yet.</div>'}
    </div>
  `;
}

bootstrap();
