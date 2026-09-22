/**
 * POST /api/auth/admin-login
 * Admin login — requires member code + admin password.
 * Sets HttpOnly cookie: thik_admin_session
 * Rate limited: 5 attempts / 15 minutes per IP. Lockout after failures.
 */
const bcrypt = require('bcryptjs');
const { db }  = require('../../api/_db');
const {
  createAdminSession,
  logActivity,
  getClientIp
}             = require('../../api/_auth');
const { checkRateLimit, resetRateLimit } = require('../../api/_ratelimit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip        = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';

  // Rate limit: 5 cəhd / 15 dəqiqə (admin üçün daha sərt)
  const rl = await checkRateLimit(ip, 'admin_login', 5, 900);
  if (!rl.ok) {
    return res.status(429).json({
      error: 'Çox sayda uğursuz cəhd. Zəhmət olmasa 15 dəqiqə gözləyin.',
      retryAfter: rl.retryAfterSecs
    });
  }

  const { memberCode, password } = req.body || {};

  if (!memberCode || !password || typeof memberCode !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Bütün sahələr tələb olunur.' });
  }

  const code = memberCode.trim().toUpperCase();

  // Eyni ümumi xəta mesajı — məlumat sızdırmırıq
  const GENERIC_ERROR = 'Giriş məlumatları yanlışdır.';

  try {
    const sql = db();

    // İstifadəçi + admin credentials-ı birlikdə yüklə
    const rows = await sql`
      SELECT
        u.id, u.full_name, u.role, u.club_id, u.active,
        u.member_code, u.position_in_club,
        c.name AS club_name,
        COALESCE(ac.password_hash, u.password_hash) AS password_hash,
        ac.active AS admin_active,
        ac.failed_attempts, ac.locked_until
      FROM users u
      LEFT JOIN clubs c ON c.id = u.club_id
      LEFT JOIN admin_credentials ac ON ac.user_id = u.id
      WHERE upper(u.member_code) = ${code}
      LIMIT 1
    `;

    // İstifadəçi yoxdursa da eyni xəta (timing attack azaldılır)
    const user = rows[0];
    const fakeHash = '$2a$12$invalidhashfortimingnormalization000000000000000000000000000';
    const hashToCheck = user?.password_hash || fakeHash;

    const passwordOk = await bcrypt.compare(password, hashToCheck);

    // İstifadəçi yoxdur
    if (!user) {
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    // İstifadəçi aktiv deyil
    if (!user.active) {
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    // Admin şifrəsi təyin edilməyib
    if (!user.password_hash) {
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    // Admin giriş deaktiv edilib
    if (user.admin_active === false) {
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    // Hesab kilidlənib?
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const retryAfterSecs = Math.ceil((new Date(user.locked_until) - Date.now()) / 1000);
      return res.status(429).json({
        error: 'Hesabınız müvəqqəti kilidlənib. Zəhmət olmasa gözləyin.',
        retryAfter: retryAfterSecs
      });
    }

    if (!passwordOk) {
      // Uğursuz cəhdi qeydə al
      const newAttempts = (user.failed_attempts || 0) + 1;
      const lockUntil = newAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000)  // 15 dəq kilidlə
        : null;

      await sql`
        UPDATE admin_credentials
        SET failed_attempts = ${newAttempts},
            locked_until    = ${lockUntil}
        WHERE user_id = ${user.id}
      `.catch(() => {});

      return res.status(401).json({ error: GENERIC_ERROR });
    }

    // ✅ Uğurlu giriş — cəhd sayğacını sıfırla
    await sql`
      UPDATE admin_credentials
      SET failed_attempts = 0,
          locked_until    = null,
          last_login      = now()
      WHERE user_id = ${user.id}
    `.catch(() => {});

    await resetRateLimit(ip, 'admin_login');

    // Session yarat
    await createAdminSession(res, user.id, ip, userAgent);

    // Logla
    await logActivity(user, 'Admin panelinə daxil oldu', { ip });

    return res.status(200).json({
      ok: true,
      user: {
        id:             user.id,
        fullName:       user.full_name,
        role:           user.role,
        clubId:         user.club_id,
        clubName:       user.club_name,
        positionInClub: user.position_in_club,
      }
    });
  } catch (e) {
    console.error('Admin login error:', e.message);
    return res.status(500).json({ error: 'Server xətası baş verdi.' });
  }
};
