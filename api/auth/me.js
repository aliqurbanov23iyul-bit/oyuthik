/**
 * GET /api/auth/me
 * Returns current user info based on session cookie.
 * Query param: ?type=member (default) or ?type=admin
 *
 * Admin response includes permissions array.
 * Member response excludes sensitive data.
 */
const {
  getMemberSession,
  getAdminSession
} = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const type = req.query?.type || 'member';

  try {
    if (type === 'admin') {
      const user = await getAdminSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Admin girişi tələb olunur.' });
      }
      return res.status(200).json({
        ok: true,
        user: {
          id:             user.id,
          fullName:       user.full_name,
          role:           user.role,
          clubId:         user.club_id,
          clubName:       user.club_name,
          positionInClub: user.position_in_club,
          permissions:    user.permissions || [],
          permissionScopes: user.permissionScopes || {},
        }
      });
    } else {
      const user = await getMemberSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Giriş tələb olunur.' });
      }
      return res.status(200).json({
        ok: true,
        user: {
          id:             user.id,
          fullName:       user.full_name,
          groupNo:        user.group_no,
          faculty:        user.faculty,
          role:           user.role,
          clubId:         user.club_id,
          clubName:       user.club_name,
          photoUrl:       user.photo_url,
          positionInClub: user.position_in_club,
          joinedAt:       user.joined_at,
          memberCode:     user.member_code,
        }
      });
    }
  } catch (e) {
    console.error('Me endpoint error:', e.message);
    return res.status(500).json({ error: 'Server xətası.' });
  }
};
