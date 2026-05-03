const crypto = require('crypto');
const db = require('./db');

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function rid(prefix, bytes = 5) {
  return `${prefix}_${crypto.randomBytes(bytes).toString('hex')}`;
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    plan: row.plan,
    credits: row.credits,
    salt: row.salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

function rowToJob(row) {
  if (!row) return null;
  let metadata = {};
  try { metadata = row.metadata ? JSON.parse(row.metadata) : {}; } catch { metadata = {}; }
  return {
    jobId: row.job_id,
    tool: row.tool,
    status: row.status,
    userId: row.user_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    resultUrl: row.result_url,
    metadata
  };
}

function rowToApiKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    keyPreview: row.key_preview,
    keyHash: row.key_hash,
    enabled: !!row.enabled,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at
  };
}

function rowToTool(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    enabled: !!row.enabled,
    credits: row.credits
  };
}

const usersApi = {
  all() { return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(rowToUser); },
  get(id) { return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)); },
  has(id) { return !!db.prepare('SELECT 1 FROM users WHERE id = ?').get(id); },
  delete(id) { return db.prepare('DELETE FROM users WHERE id = ?').run(id); },
  size() { return db.prepare('SELECT COUNT(*) AS c FROM users').get().c; },
  values() { return this.all(); }
};

const jobsApi = {
  all() { return db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all().map(rowToJob); },
  get(jobId) { return rowToJob(db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId)); },
  has(jobId) { return !!db.prepare('SELECT 1 FROM jobs WHERE job_id = ?').get(jobId); },
  delete(jobId) { return db.prepare('DELETE FROM jobs WHERE job_id = ?').run(jobId); },
  size() { return db.prepare('SELECT COUNT(*) AS c FROM jobs').get().c; },
  values() { return this.all(); }
};

const apiKeysApi = {
  all() { return db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all().map(rowToApiKey); },
  get(id) { return rowToApiKey(db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id)); },
  has(id) { return !!db.prepare('SELECT 1 FROM api_keys WHERE id = ?').get(id); },
  delete(id) { return db.prepare('DELETE FROM api_keys WHERE id = ?').run(id); },
  size() { return db.prepare('SELECT COUNT(*) AS c FROM api_keys').get().c; },
  values() { return this.all(); }
};

const toolsApi = {
  all() { return db.prepare('SELECT * FROM tools ORDER BY slug').all().map(rowToTool); },
  get(slug) { return rowToTool(db.prepare('SELECT * FROM tools WHERE slug = ?').get(slug)); },
  has(slug) { return !!db.prepare('SELECT 1 FROM tools WHERE slug = ?').get(slug); },
  size() { return db.prepare('SELECT COUNT(*) AS c FROM tools').get().c; },
  values() { return this.all(); }
};

function findUserByEmail(email) {
  return rowToUser(db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email));
}

function verifyPassword(user, password) {
  return user && user.passwordHash === hashPassword(password, user.salt);
}

function createUser({ email, password, name, role = 'user', credits = 50, status = 'active', plan = 'free' }) {
  const id = rid('usr');
  const salt = crypto.randomBytes(8).toString('hex');
  const created_at = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, email, name, role, status, plan, credits, salt, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, name || email.split('@')[0], role, status, plan, credits, salt, hashPassword(password, salt), created_at);
  return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

function updateUser(id, patch) {
  const allowed = { name: 'name', role: 'role', status: 'status', plan: 'plan', credits: 'credits', last_login_at: 'last_login_at' };
  const sets = [];
  const params = [];
  for (const [key, col] of Object.entries(allowed)) {
    if (key in patch) { sets.push(`${col} = ?`); params.push(patch[key]); }
  }
  if (!sets.length) return usersApi.get(id);
  params.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return usersApi.get(id);
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, now, now + SESSION_TTL_MS);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { userId: row.user_id, createdAt: row.created_at };
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function createJob({ tool, payload, userId = null }) {
  const job_id = rid('job', 6);
  const created_at = new Date().toISOString();
  const metadata = JSON.stringify({ input: payload });
  db.prepare(`
    INSERT INTO jobs (job_id, tool, status, user_id, created_at, metadata)
    VALUES (?, ?, 'queued', ?, ?, ?)
  `).run(job_id, tool, userId, created_at, metadata);
  return jobsApi.get(job_id);
}

function updateJob(jobId, patch) {
  const allowed = { status: 'status', completed_at: 'completed_at', result_url: 'result_url' };
  const sets = [];
  const params = [];
  for (const [key, col] of Object.entries(allowed)) {
    if (key in patch) { sets.push(`${col} = ?`); params.push(patch[key]); }
  }
  if (!sets.length) return jobsApi.get(jobId);
  params.push(jobId);
  db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE job_id = ?`).run(...params);
  return jobsApi.get(jobId);
}

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>\x00-\x1F\x7F]/g, '').slice(0, maxLen).trim();
}

function updateTool(slug, patch) {
  const allowed = { name: 'name', description: 'description', enabled: 'enabled', credits: 'credits', category: 'category' };
  const sets = [];
  const params = [];
  for (const [key, col] of Object.entries(allowed)) {
    if (key in patch) {
      let value = patch[key];
      if (key === 'enabled') value = value ? 1 : 0;
      else if (key === 'credits') value = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
      else if (key === 'name') value = sanitizeText(value, 80);
      else if (key === 'description') value = sanitizeText(value, 240);
      else if (key === 'category') value = sanitizeText(value, 40);
      sets.push(`${col} = ?`);
      params.push(value);
    }
  }
  if (!sets.length) return toolsApi.get(slug);
  params.push(slug);
  db.prepare(`UPDATE tools SET ${sets.join(', ')} WHERE slug = ?`).run(...params);
  return toolsApi.get(slug);
}

function createApiKey(userId, label) {
  const id = rid('key', 4);
  const plainKey = `sk_${crypto.randomBytes(16).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
  const keyPreview = `${plainKey.slice(0, 8)}...${plainKey.slice(-4)}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO api_keys (id, user_id, label, key_preview, key_hash, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, userId, label, keyPreview, keyHash, createdAt);
  return { record: apiKeysApi.get(id), plainKey };
}

const settings = new Proxy({}, {
  get(_t, key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return undefined;
    try { return JSON.parse(row.value); } catch { return row.value; }
  },
  set(_t, key, value) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
    return true;
  },
  ownKeys() {
    return db.prepare('SELECT key FROM settings').all().map(r => r.key);
  },
  getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  },
  has(_t, key) {
    return !!db.prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
  }
});

function settingsSnapshot() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}

function audit(actor, action, target, meta = {}) {
  db.prepare(`
    INSERT INTO audit_logs (actor, action, target, meta, at) VALUES (?, ?, ?, ?, ?)
  `).run(actor, action, target || null, JSON.stringify(meta), new Date().toISOString());
  db.prepare(`
    DELETE FROM audit_logs WHERE id NOT IN (
      SELECT id FROM audit_logs ORDER BY id DESC LIMIT 1000
    )
  `).run();
}

function listAuditLogs(limit = 100) {
  return db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit).map(r => ({
    id: `log_${r.id}`,
    actor: r.actor,
    action: r.action,
    target: r.target,
    meta: r.meta ? JSON.parse(r.meta) : {},
    at: r.at
  }));
}

require('./db/seed');

module.exports = {
  db,
  users: usersApi,
  jobs: jobsApi,
  apiKeys: apiKeysApi,
  tools: toolsApi,
  settings,
  settingsSnapshot,
  createUser,
  updateUser,
  findUserByEmail,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  createJob,
  updateJob,
  updateTool,
  createApiKey,
  audit,
  listAuditLogs
};
