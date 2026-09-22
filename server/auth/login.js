/**
 * POST /api/auth/login
 * Member login — only requires member code (no password).
 * Sets HttpOnly cookie: thik_member_session
 * Rate limited: 10 attempts / 5 minutes per IP.
 */
const { db }                = require('../../api/_db');
const { createMemberSession, getClientIp } = require('../../api/_auth');
const { checkRateLimit, resetRateLimit }   = require('../../api/_ratelimit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);

  // Rate limit: 10 cəhd / 5 dəqiqə
  const rl = await checkRateLimit(ip, 'member_login', 10, 300);
  if (!rl.ok) {
    return res.status(429).json({
      error: 'Çox sayda cəhd etdiniz. Zəhmət olmasa bir az gözləyin.',
      retryAfter: rl.retryAfterSecs
    });
  }

  const { memberCode } = req.body || {};

  if (!memberCode || typeof memberCode !== 'string') {
    return res.status(400).json({ error: 'Üzv kodu tələb olunur.' });
  }

  const code = memberCode.trim().toUpperCase();

  // Təhlükəsizlik: ümumi xəta mesajı (məlumat sızdırmırıq)
  const GENERIC_ERROR = 'Giriş məlumatları yanlışdır.';

  try {
    const sql = db();
    const rows = await sql`
      SELECT
        u.id, u.full_name, u.group_no, u.faculty,
        u.role, u.club_id, u.member_code, u.photo_url,
        u.position_in_club, u.joined_at, u.active,
        c.name AS club_name
      FROM users u
      LEFT JOIN clubs c ON c.id = u.club_id
      WHERE upper(u.member_code) = ${code}
        AND u.active = true
      LIMIT 1
    `;

    if (!rows[0]) {
      // Deliberately vague to prevent enumeration
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    const user = rows[0];

    // SUPER_ADMIN / ADMIN üzv kabinetindən daxil ola bilər — admin panel ayrıdır
    // Burada heç bir rol məhdudiyyəti yoxdur (hamı üzv kabinetinə girə bilər)

    // Uğurlu girişdə rate limit-i sıfırla
    await resetRateLimit(ip, 'member_login');

    // Session yarat + cookie qur
    await createMemberSession(res, user.id);

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
  } catch (e) {
    console.error('Member login error:', e.message);
    return res.status(500).json({ error: 'Server xətası baş verdi.' });
  }
};
