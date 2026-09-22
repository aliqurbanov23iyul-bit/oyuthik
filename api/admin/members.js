/**
 * POST /api/admin/members    — create member
 * GET  /api/admin/members    — list members (scoped)
 * PATCH /api/admin/members   — edit member (body: {id, ...fields})
 * DELETE /api/admin/members  — deactivate member (body: {id})
 */
const { db }              = require('../_db');
const { requirePermission, logActivity, getClientIp } = require('../_auth');
const { generateMemberCode } = require('../_codegen');

module.exports = async (req, res) => {
  const ip = getClientIp(req);

  // ── GET: üzvləri siyahıla ──────────────────────────────────
  if (req.method === 'GET') {
    const user = await requirePermission(req, res, 'view_members');
    if (!user) return;

    try {
      const sql = db();
      const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);

      const members = isSuperOrAdmin
        ? await sql`
            SELECT u.id, u.full_name, u.group_no, u.faculty, u.role,
                   u.member_code, u.active, u.position_in_club, u.joined_at,
                   c.name club_name, c.id club_id
            FROM users u
            LEFT JOIN clubs c ON c.id = u.club_id
            ORDER BY u.full_name
          `
        : await sql`
            SELECT u.id, u.full_name, u.group_no, u.faculty, u.role,
                   u.member_code, u.active, u.position_in_club, u.joined_at,
                   c.name club_name, c.id club_id
            FROM users u
            LEFT JOIN clubs c ON c.id = u.club_id
            WHERE u.club_id = ${user.club_id}
            ORDER BY u.full_name
          `;

      return res.status(200).json({ members });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  // ── POST: yeni üzv yarat ────────────────────────────────────
  if (req.method === 'POST') {
    const user = await requirePermission(req, res, 'create_member');
    if (!user) return;

    const { fullName, groupNo, faculty, clubId, role, positionInClub } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Ad Soyad tələb olunur.' });
    }

    // CHAIR yalnız öz klubuna üzv əlavə edə bilər
    const targetClubId = (() => {
      if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        return clubId ? parseInt(clubId) : null;
      }
      return user.club_id; // CHAIR öz klubunu məcbur olaraq seçir
    })();

    // CHAIR SUPER_ADMIN/ADMIN rolu verə bilməz
    const safeRole = (() => {
      if (user.role === 'SUPER_ADMIN') return role || 'MEMBER';
      if (user.role === 'ADMIN') {
        return ['MEMBER', 'CHAIR', 'ADMIN'].includes(role) ? role : 'MEMBER';
      }
      return 'MEMBER'; // CHAIR yalnız MEMBER yarada bilər
    })();

    try {
      const memberCode = await generateMemberCode();
      const sql = db();

      await sql`
        INSERT INTO users(full_name, group_no, faculty, club_id, role, member_code, position_in_club)
        VALUES(
          ${fullName.trim()},
          ${groupNo  || null},
          ${faculty  || null},
          ${targetClubId},
          ${safeRole},
          ${memberCode},
          ${positionInClub || null}
        )
      `;

      await logActivity(user, `Yeni üzv yaratdı: ${fullName.trim()}`, {
        targetType: 'user', targetName: fullName.trim(), ip
      });

      return res.status(201).json({ ok: true, memberCode });
    } catch (e) {
      console.error('Create member error:', e.message);
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  // ── PATCH: üzv məlumatlarını yenilə ────────────────────────
  if (req.method === 'PATCH') {
    const user = await requirePermission(req, res, 'edit_member');
    if (!user) return;

    const { id, fullName, groupNo, faculty, positionInClub, active } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id tələb olunur.' });

    try {
      const sql = db();

      // Club scope: CHAIR yalnız öz üzvlərini redaktə edə bilər
      if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        const target = await sql`SELECT club_id FROM users WHERE id = ${parseInt(id)} LIMIT 1`;
        if (!target[0] || target[0].club_id !== user.club_id) {
          return res.status(403).json({ error: 'Bu üzvü redaktə etmək üçün icazəniz yoxdur.' });
        }
      }

      await sql`
        UPDATE users
        SET full_name        = COALESCE(${fullName        || null}, full_name),
            group_no         = COALESCE(${groupNo         || null}, group_no),
            faculty          = COALESCE(${faculty         || null}, faculty),
            position_in_club = COALESCE(${positionInClub  || null}, position_in_club),
            active           = COALESCE(${active !== undefined ? active : null}, active)
        WHERE id = ${parseInt(id)}
      `;

      await logActivity(user, `Üzv məlumatlarını yenilədi (id:${id})`, {
        targetType: 'user', targetId: parseInt(id), ip
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  // ── DELETE: üzvü deaktiv et və ya SUPER_ADMIN üçün tam sil ───
  if (req.method === 'DELETE') {
    const user = await requirePermission(req, res, 'delete_member');
    if (!user) return;

    const { id, permanent = false } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id tələb olunur.' });

    try {
      const sql = db();

      // Club scope yoxlaması
      if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        const target = await sql`SELECT club_id FROM users WHERE id = ${parseInt(id)} LIMIT 1`;
        if (!target[0] || target[0].club_id !== user.club_id) {
          return res.status(403).json({ error: 'Bu üzvü silmək üçün icazəniz yoxdur.' });
        }
      }

      if (permanent) {
        if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Üzvü tam silmək yalnız Baş Admin üçün mümkündür.' });
        if (parseInt(id) === user.id) return res.status(400).json({ error: 'Öz hesabınızı silə bilməzsiniz.' });
        const target = await sql`SELECT full_name, role FROM users WHERE id = ${parseInt(id)} LIMIT 1`;
        if (!target[0]) return res.status(404).json({ error: 'Üzv tapılmadı.' });
        if (target[0].role === 'SUPER_ADMIN') return res.status(400).json({ error: 'Baş Admin hesabını buradan silmək olmaz.' });
        await sql`DELETE FROM users WHERE id = ${parseInt(id)}`;
        await logActivity(user, `Üzv tam silindi: ${target[0].full_name} (id:${id})`, { targetType: 'user', targetId: parseInt(id), targetName: target[0].full_name, ip });
        return res.status(200).json({ ok: true, deleted: true });
      }

      await sql`UPDATE users SET active = false WHERE id = ${parseInt(id)}`;
      await logActivity(user, `Üzv deaktiv edildi (id:${id})`, { targetType: 'user', targetId: parseInt(id), ip });
      return res.status(200).json({ ok: true, deactivated: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
