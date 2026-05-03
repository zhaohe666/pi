const store = require('../store');

function getTokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-admin-token'] || null;
}

function authRequired(req, res, next) {
  const token = getTokenFromReq(req);
  const session = store.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const user = store.users.get(session.userId);
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Unauthorized', message: 'User not active' });
  }
  req.user = user;
  req.token = token;
  next();
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
    }
    next();
  });
}

module.exports = { authRequired, adminRequired };
