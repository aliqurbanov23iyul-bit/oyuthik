/**
 * GET    /api/admin/admin-credentials?userId=<id>  — check if user has admin access
 * POST   /api/admin/admin-credentials              — grant admin access + set password
 * PATCH  /api/admin/admin-credentials              — reset password or toggle active
 * DELETE /api/admin/admin-credentials              — revoke admin access
 *
 * Only SUPER_ADMIN or users with manage_admins permission can use this.
 * Passwords are NEVER returned in any response.
 */
const bcrypt = require('bcryptjs');
const { db }  = require('../_db');
const { requirePermission, logActivity, getClientIp } = require('../_auth');

module.exports = async (req, res) => {
  const ip = getClientIp(req);

  // GET: admin erişimini yoxla
  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, 'manage_admins');
    if (!actor) return;

    const userId = parseInt(req.query?.userId);
    if (!userId) return res.status(400).json({ error: 'userId tələb olunur.' });

    try {
      const sql = db();
      const rows = await sql`
        SELECT
          ac.id, ac.active, ac.last_login, ac.failed_attempts,
          ac.locked_until, ac.created_at, ac.updated_at,
          u.full_name, u.role, u.member_code
        FROM admin_credentials ac
        JOIN users u ON u.id = ac.user_id
        WHERE ac.user_id = ${userId}
        LIMIT 1
      `;
      if (!rows[0]) {
        return res.status(200).json({ hasAdminAccess: false });
      }
      // Şifrəni HEÇ VAXT qaytarma
      return res.status(200).json({
        hasAdminAccess: true,
        active:         rows[0].active,
        lastLogin:      rows[0].last_login,
        failedAttempts: rows[0].failed_attempts,
        lockedUntil:    rows[0].locked_until,
        createdAt:      rows[0].created_at,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  // POST: admin girişi ver + şifrə təyin et
  if (req.method === 'POST') {
    const actor = await requirePermission(req, res, 'manage_admins');
    if (!actor) return;

    const { userId, password } = req.body || {};
    if (!userId || !password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'userId və ən az 8 simvollu şifrə tələb olunur.' });
    }

    const targetUserId = parseInt(userId);

    try {
      const sql = db();
      const target = await sql`
        SELECT id, full_name, role FROM users WHERE id = ${targetUserId} LIMIT 1
      `;
      if (!target[0]) return res.status(404).json({ error: 'İstifadəçi tapılmadı.' });

      // MEMBER admin giriş ala bilər, SUPER_ADMIN dəyişdirilə bilməz
      if (target[0].role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'SUPER_ADMIN hesabını dəyişdirə bilməzsiniz.' });
      }

      const hash = await bcrypt.hash(password, 12);

      await sql`
        INSERT INTO admin_credentials(user_id, password_hash, active)
        VALUES(${targetUserId}, ${hash}, true)
        ON CONFLICT(user_id) DO UPDATE
        SET password_hash = ${hash},
            active        = true,
            failed_attempts = 0,
            locked_until    = null,
            updated_at      = now()
      `;

      await logActivity(actor, `${target[0].full_name} üçün admin girişi verdi`, {
        targetType: 'user', targetId: targetUserId, targetName: target[0].full_name, ip
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  // PATCH: şifrə reset et / aktiv/deaktiv et / kilidini aç
  if (req.method === 'PATCH') {
    const actor = await requirePermission(req, res, 'manage_admins');
    if (!actor) return;

    const { userId, password, active, unlock } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId tələb olunur.' });

    const targetUserId = parseInt(userId);

    try {
      const sql = db();
      const target = await sql`
        SELECT id, full_name, role FROM users WHERE id = ${targetUserId} LIMIT 1
      `;
      if (!target[0]) return res.status(404).json({ error: 'İstifadəçi tapılmadı.' });

      // Şifrə dəyişikliyi
      if (password) {
        if (typeof password !== 'string' || password.length < 8) {
          return res.status(400).json({ error: 'Şifrə ən az 8 simvol olmalıdır.' });
        }
        const hash = await bcrypt.hash(password, 12);
        await sql`
          UPDATE admin_credentials
          SET password_hash   = ${hash},
              failed_attempts = 0,
              locked_until    = null,
              updated_at      = now()
          WHERE user_id = ${targetUserId}
        `;
        await logActivity(actor, `${target[0].full_name} üçün admin şifrəsini sıfırladı`, {
          targetType: 'user', targetId: targetUserId, targetName: target[0].full_name, ip
        });
      }

      // Aktiv/deaktiv et
      if (active !== undefined) {
        await sql`
          UPDATE admin_credentials
          SET active     = ${!!active},
              updated_at = now()
          WHERE user_id = ${targetUserId}
        `;
        const action = active ? 'aktiv etdi' : 'deaktiv etdi';
        await logActivity(actor, `${target[0].full_name} üçün admin girişini ${action}`, {
          targetType: 'user', targetId: targetUserId, ip
        });
      }

      // Kilidi aç
      if (unlock) {
        await sql`
          UPDATE admin_credentials
          SET failed_attempts = 0,
              locked_until    = null,
              updated_at      = now()
          WHERE user_id = ${targetUserId}
        `;
        await logActivity(actor, `${target[0].full_name} hesabının kilidini açdı`, {
          targetType: 'user', targetId: targetUserId, ip
        });
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  // DELETE: admin girişini tamamilə ləğv et
  if (req.method === 'DELETE') {
    const actor = await requirePermission(req, res, 'manage_admins');
    if (!actor) return;

    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId tələb olunur.' });

    const targetUserId = parseInt(userId);

    try {
      const sql = db();
      const target = await sql`
        SELECT id, full_name, role FROM users WHERE id = ${targetUserId} LIMIT 1
      `;
      if (target[0]?.role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'SUPER_ADMIN girişini ləğv etmək olmaz.' });
      }

      await sql`DELETE FROM admin_credentials WHERE user_id = ${targetUserId}`;
      // Aktiv admin session-larını da sil
      await sql`DELETE FROM admin_sessions WHERE user_id = ${targetUserId}`;

      await logActivity(actor, `${target[0]?.full_name} üçün admin girişini ləğv etdi`, {
        targetType: 'user', targetId: targetUserId, ip
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
