/**
 * GET   /api/admin/permissions          — get all permissions + user's current perms
 * PUT   /api/admin/permissions          — set user permissions (replace all)
 *
 * Query: ?userId=<id>   (required for GET/PUT)
 */
const { db }              = require('../_db');
const { requirePermission, logActivity, getClientIp } = require('../_auth');

module.exports = async (req, res) => {
  const ip = getClientIp(req);

  // GET: istifadəçinin permission-larını göstər
  if (req.method === 'GET') {
    const user = await requirePermission(req, res, 'manage_permissions');
    if (!user) return;

    try {
      const sql = db();
      const userId = parseInt(req.query?.userId);

      // Bütün permission açarlarını yüklə
      const allPerms = await sql`SELECT * FROM permissions ORDER BY category, id`;

      if (userId) {
        const userPerms = await sql`
          SELECT permission_key, club_scope_id
          FROM user_permissions
          WHERE user_id = ${userId}
        `;
        const targetUser = await sql`
          SELECT id, full_name, role, club_id, member_code
          FROM users WHERE id = ${userId} LIMIT 1
        `;
        return res.status(200).json({
          permissions:     allPerms,
          userPermissions: userPerms,
          targetUser:      targetUser[0] || null,
        });
      }

      return res.status(200).json({ permissions: allPerms });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  // PUT: user permissions-ı yenilə
  if (req.method === 'PUT') {
    const actor = await requirePermission(req, res, 'manage_permissions');
    if (!actor) return;

    const { userId, permissions, clubScopeId } = req.body || {};
    if (!userId || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'userId və permissions tələb olunur.' });
    }

    const targetUserId = parseInt(userId);

    // SUPER_ADMIN-in permission-larını dəyişmək qadağandır
    try {
      const sql = db();
      const target = await sql`SELECT role, full_name FROM users WHERE id = ${targetUserId} LIMIT 1`;
      if (!target[0]) return res.status(404).json({ error: 'İstifadəçi tapılmadı.' });
      if (target[0].role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'SUPER_ADMIN-in permission-larını dəyişmək olmaz.' });
      }

      // Mevcut permission-ları sil, yenilərini əlavə et
      await sql`DELETE FROM user_permissions WHERE user_id = ${targetUserId}`;

      if (permissions.length > 0) {
        // Bütün etibarlı permission key-lərini yoxla
        const validKeys = await sql`SELECT key FROM permissions`;
        const validSet  = new Set(validKeys.map(p => p.key));
        const filtered  = permissions.filter(k => validSet.has(k));

        for (const key of filtered) {
          await sql`
            INSERT INTO user_permissions(user_id, permission_key, club_scope_id)
            VALUES(${targetUserId}, ${key}, ${clubScopeId ? parseInt(clubScopeId) : null})
            ON CONFLICT(user_id, permission_key) DO NOTHING
          `;
        }
      }

      await logActivity(actor, `${target[0].full_name} istifadəçisinin permission-larını yenilədi`, {
        targetType: 'user', targetId: targetUserId, targetName: target[0].full_name, ip
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Permission update error:', e.message);
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
