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
                   u.member_code, u.active, u.position_in_club, u.photo_url, u.joined_at,
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

    const { fullName, groupNo, faculty, clubId, positionInClub } = req.body || {};

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

    // Yeni hesab həmişə standart üzv kimi yaranır.
    // Klub sədri/müavini klub idarəsindən, admin səlahiyyəti isə ayrıca təhlükəsizlik axınından verilir.
    const safeRole = 'MEMBER';

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

    const { id, fullName, groupNo, faculty, positionInClub, active, role, clubId, photoUrl } = req.body || {};
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

      const targetBefore = await sql`SELECT role FROM users WHERE id = ${parseInt(id)} LIMIT 1`;
      if (!targetBefore[0]) return res.status(404).json({ error: 'Üzv tapılmadı.' });
      if (targetBefore[0].role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Baş Admin rolunu yalnız Baş Admin dəyişə bilər.' });
      }
      let safeRole = undefined;
      if (role !== undefined) {
        if (user.role === 'SUPER_ADMIN') safeRole = ['SUPER_ADMIN','ADMIN','CHAIR','VICE_CHAIR','MEMBER'].includes(role) ? role : undefined;
        else if (user.role === 'ADMIN') safeRole = ['ADMIN','CHAIR','VICE_CHAIR','MEMBER'].includes(role) ? role : undefined;
      }
      const safeClubId = ['SUPER_ADMIN','ADMIN'].includes(user.role) && clubId !== undefined ? (clubId ? parseInt(clubId) : null) : undefined;

      const targetId = parseInt(id);
      // Update only fields actually supplied. This avoids nulling optional columns
      // and keeps role changes independent from profile/photo edits.
      if (fullName !== undefined) await sql`UPDATE users SET full_name = ${String(fullName).trim()} WHERE id = ${targetId}`;
      if (groupNo !== undefined) await sql`UPDATE users SET group_no = ${groupNo || null} WHERE id = ${targetId}`;
      if (faculty !== undefined) await sql`UPDATE users SET faculty = ${faculty || null} WHERE id = ${targetId}`;
      if (positionInClub !== undefined) await sql`UPDATE users SET position_in_club = ${positionInClub || null} WHERE id = ${targetId}`;
      if (safeRole !== undefined) await sql`UPDATE users SET role = ${safeRole} WHERE id = ${targetId}`;
      if (safeClubId !== undefined) await sql`UPDATE users SET club_id = ${safeClubId} WHERE id = ${targetId}`;
      if (photoUrl !== undefined) await sql`UPDATE users SET photo_url = ${photoUrl || null} WHERE id = ${targetId}`;
      if (active !== undefined) await sql`UPDATE users SET active = ${!!active} WHERE id = ${targetId}`;

      await logActivity(user, `Üzv məlumatlarını yenilədi (id:${id})`, {
        targetType: 'user', targetId: parseInt(id), ip
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Update member error:', e);
      const msg = e && e.message ? String(e.message) : '';
      if (msg.includes('users_role_check') || msg.includes('violates check constraint')) {
        return res.status(409).json({ error: 'Database rol qaydası köhnədir. migration.sql yenidən işlədilməlidir.' });
      }
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

      // Club scope + iyerarxiya yoxlaması
      const targetForDelete = await sql`SELECT id, club_id, role, full_name FROM users WHERE id = ${parseInt(id)} LIMIT 1`;
      if (!targetForDelete[0]) return res.status(404).json({ error: 'Üzv tapılmadı.' });
      if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        if (targetForDelete[0].club_id !== user.club_id) {
          return res.status(403).json({ error: 'Bu üzvü idarə etmək üçün icazəniz yoxdur.' });
        }
        if (user.role !== 'CHAIR') {
          return res.status(403).json({ error: 'Üzvü deaktiv etmək yalnız klub sədri üçün mümkündür.' });
        }
        if (targetForDelete[0].role !== 'MEMBER') {
          return res.status(403).json({ error: 'Klub sədri rəhbərlik hesabını deaktiv edə bilməz.' });
        }
      }
      if (user.role === 'ADMIN' && ['SUPER_ADMIN','ADMIN'].includes(targetForDelete[0].role)) {
        return res.status(403).json({ error: 'İdarəçi başqa idarəçi hesabını deaktiv edə bilməz.' });
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
