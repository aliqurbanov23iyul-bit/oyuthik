const handlers = {
  login: require('../server/auth/login'),
  'admin-login': require('../server/auth/admin-login'),
  logout: require('../server/auth/logout'),
  me: require('../server/auth/me'),
};

module.exports = async (req, res) => {
  const action = String(req.query?.action || '');
  const handler = handlers[action];
  if (!handler) return res.status(404).json({ error: 'Endpoint tapılmadı.' });
  return handler(req, res);
};
