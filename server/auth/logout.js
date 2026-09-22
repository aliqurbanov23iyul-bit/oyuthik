/**
 * POST /api/auth/logout
 * Query param: ?type=member (default) or ?type=admin
 * Destroys the corresponding session cookie.
 */
const {
  destroyMemberSession,
  destroyAdminSession,
  logActivity,
  getAdminSession,
  getClientIp
} = require('../../api/_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const type = req.query?.type || 'member';

  try {
    if (type === 'admin') {
      // Log before destroying session
      const user = await getAdminSession(req);
      if (user) {
        await logActivity(user, 'Admin panelindən çıxdı', { ip: getClientIp(req) });
      }
      await destroyAdminSession(req, res);
    } else {
      await destroyMemberSession(req, res);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Logout error:', e.message);
    return res.status(500).json({ error: 'Server xətası.' });
  }
};
