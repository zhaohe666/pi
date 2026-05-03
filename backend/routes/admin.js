const express = require('express');
const store = require('../store');
const { adminRequired, authRequired } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, salt, ...rest } = u;
  return rest;
}

function publicKey(k) {
  if (!k) return null;
  const { keyHash, ...rest } = k;
  return rest;
}

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email + password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: admin@imgkits.local }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200: { description: Authenticated }
 *       401: { description: Invalid credentials }
 */
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'BadRequest', message: 'email and password are required' });
  }
  const user = store.findUserByEmail(email);
  if (!user || !store.verifyPassword(user, password)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Forbidden', message: `Account is ${user.status}` });
  }
  store.updateUser(user.id, { last_login_at: new Date().toISOString() });
  const token = store.createSession(user.id);
  store.audit(user.email, 'login', user.id);
  res.json({ token, user: publicUser(store.users.get(user.id)) });
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and invalidate token
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: Logged out }
 */
router.post('/auth/logout', authRequired, (req, res) => {
  store.destroySession(req.token);
  store.audit(req.user.email, 'logout', req.user.id);
  res.status(204).end();
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current logged-in user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
router.get('/auth/me', authRequired, (req, res) => {
  res.json(publicUser(req.user));
});

router.use('/admin', adminRequired);

/**
 * @openapi
 * /api/admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Aggregate dashboard statistics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Stats payload }
 */
router.get('/admin/stats', (req, res) => {
  const allJobs = store.jobs.all();
  const allUsers = store.users.all();
  const last24h = Date.now() - 24 * 3600 * 1000;
  const recentJobs = allJobs.filter(j => new Date(j.createdAt).getTime() >= last24h);

  const byTool = {};
  for (const j of allJobs) byTool[j.tool] = (byTool[j.tool] || 0) + 1;
  const byStatus = { queued: 0, processing: 0, done: 0, failed: 0 };
  for (const j of allJobs) byStatus[j.status] = (byStatus[j.status] || 0) + 1;

  const trend = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(Date.now() - (6 - i) * 86400000);
    const dayKey = day.toISOString().slice(0, 10);
    const count = allJobs.filter(j => j.createdAt.startsWith(dayKey)).length;
    return { date: dayKey, count };
  });

  const tools = store.tools.all();
  res.json({
    totals: {
      users: allUsers.length,
      activeUsers: allUsers.filter(u => u.status === 'active').length,
      jobs: allJobs.length,
      jobs24h: recentJobs.length,
      tools: tools.length,
      enabledTools: tools.filter(t => t.enabled).length,
      apiKeys: store.apiKeys.size()
    },
    byTool,
    byStatus,
    trend,
    revenue: {
      mrr: allUsers.filter(u => u.plan === 'pro').length * 9 + allUsers.filter(u => u.plan === 'team').length * 29,
      currency: 'USD'
    }
  });
});

/**
 * @openapi
 * /api/admin/jobs:
 *   get:
 *     tags: [Admin]
 *     summary: List jobs with filters
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: tool
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: Jobs list }
 */
router.get('/admin/jobs', (req, res) => {
  const { status, tool, q } = req.query;
  const limit = parseInt(req.query.limit, 10) || 50;
  let list = store.jobs.all();
  if (status) list = list.filter(j => j.status === status);
  if (tool) list = list.filter(j => j.tool === tool);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(j =>
      j.jobId.toLowerCase().includes(needle) ||
      (j.userId || '').toLowerCase().includes(needle)
    );
  }
  res.json({ total: list.length, items: list.slice(0, limit) });
});

/**
 * @openapi
 * /api/admin/jobs/{jobId}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a job
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 */
router.delete('/admin/jobs/:jobId', (req, res) => {
  if (!store.jobs.has(req.params.jobId)) return res.status(404).json({ error: 'NotFound' });
  store.jobs.delete(req.params.jobId);
  store.audit(req.user.email, 'job.delete', req.params.jobId);
  res.status(204).end();
});

/**
 * @openapi
 * /api/admin/jobs/{jobId}/retry:
 *   post:
 *     tags: [Admin]
 *     summary: Re-queue a job
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job re-queued }
 */
router.post('/admin/jobs/:jobId/retry', (req, res) => {
  const job = store.jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'NotFound' });
  store.updateJob(job.jobId, { status: 'queued', completed_at: null, result_url: null });
  setTimeout(() => store.updateJob(job.jobId, { status: 'processing' }), 200);
  setTimeout(() => store.updateJob(job.jobId, {
    status: 'done',
    completed_at: new Date().toISOString(),
    result_url: `https://placehold.co/800x600/7c3aed/ffffff/png?text=${encodeURIComponent(job.tool)}`
  }), 1500);
  store.audit(req.user.email, 'job.retry', job.jobId);
  res.json(store.jobs.get(job.jobId));
});

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List users
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { description: Users list }
 *   post:
 *     tags: [Admin]
 *     summary: Create a user
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               name: { type: string }
 *               role: { type: string, enum: [user, admin] }
 *               credits: { type: integer }
 *     responses:
 *       201: { description: Created }
 */
router.get('/admin/users', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  let list = store.users.all().map(publicUser);
  if (q) list = list.filter(u => u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q));
  res.json({ total: list.length, items: list });
});

router.post('/admin/users', (req, res) => {
  const { email, password, name, role = 'user', credits = 50 } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'BadRequest', message: 'email and password are required' });
  if (store.findUserByEmail(email)) return res.status(409).json({ error: 'Conflict', message: 'Email already in use' });
  const user = store.createUser({ email, password, name, role, credits });
  store.audit(req.user.email, 'user.create', user.id, { email });
  res.status(201).json(publicUser(user));
});

/**
 * @openapi
 * /api/admin/users/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 */
router.patch('/admin/users/:id', (req, res) => {
  if (!store.users.has(req.params.id)) return res.status(404).json({ error: 'NotFound' });
  const updated = store.updateUser(req.params.id, req.body || {});
  store.audit(req.user.email, 'user.update', req.params.id, req.body);
  res.json(publicUser(updated));
});

router.delete('/admin/users/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'BadRequest', message: 'Cannot delete yourself' });
  if (!store.users.has(req.params.id)) return res.status(404).json({ error: 'NotFound' });
  store.users.delete(req.params.id);
  store.audit(req.user.email, 'user.delete', req.params.id);
  res.status(204).end();
});

/**
 * @openapi
 * /api/admin/tools:
 *   get:
 *     tags: [Admin]
 *     summary: List tools (including disabled)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tools list }
 */
router.get('/admin/tools', (req, res) => {
  res.json(store.tools.all());
});

/**
 * @openapi
 * /api/admin/tools/{slug}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a tool (enable/disable, credits, etc.)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/admin/tools/:slug', (req, res) => {
  if (!store.tools.has(req.params.slug)) return res.status(404).json({ error: 'NotFound' });
  const updated = store.updateTool(req.params.slug, req.body || {});
  store.audit(req.user.email, 'tool.update', req.params.slug, req.body);
  res.json(updated);
});

/**
 * @openapi
 * /api/admin/api-keys:
 *   get:
 *     tags: [Admin]
 *     summary: List API keys
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: API keys list }
 *   post:
 *     tags: [Admin]
 *     summary: Generate a new API key
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               userId: { type: string }
 *     responses:
 *       201: { description: Created. plainKey returned only once. }
 */
router.get('/admin/api-keys', (req, res) => {
  res.json(store.apiKeys.all().map(publicKey));
});

router.post('/admin/api-keys', (req, res) => {
  const { label = 'New key', userId = req.user.id } = req.body || {};
  if (!store.users.has(userId)) return res.status(400).json({ error: 'BadRequest', message: 'Invalid userId' });
  const { record, plainKey } = store.createApiKey(userId, label);
  store.audit(req.user.email, 'apikey.create', record.id);
  res.status(201).json({ ...publicKey(record), plainKey });
});

/**
 * @openapi
 * /api/admin/api-keys/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Revoke an API key
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Revoked }
 */
router.delete('/admin/api-keys/:id', (req, res) => {
  if (!store.apiKeys.has(req.params.id)) return res.status(404).json({ error: 'NotFound' });
  store.apiKeys.delete(req.params.id);
  store.audit(req.user.email, 'apikey.delete', req.params.id);
  res.status(204).end();
});

/**
 * @openapi
 * /api/admin/settings:
 *   get:
 *     tags: [Admin]
 *     summary: Get system settings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Settings object }
 *   put:
 *     tags: [Admin]
 *     summary: Update system settings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated settings }
 */
router.get('/admin/settings', (req, res) => {
  res.json(store.settingsSnapshot());
});

router.put('/admin/settings', (req, res) => {
  const allowed = ['siteName', 'maintenanceMode', 'allowSignups', 'freeCreditsPerDay', 'maxUploadMb', 'resultExpireHours'];
  for (const k of allowed) if (k in (req.body || {})) store.settings[k] = req.body[k];
  store.audit(req.user.email, 'settings.update', 'system', req.body);
  res.json(store.settingsSnapshot());
});

/**
 * @openapi
 * /api/admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Recent audit log entries
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200: { description: Audit logs }
 */
router.get('/admin/audit-logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json(store.listAuditLogs(limit));
});

module.exports = router;
