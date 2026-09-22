/**
 * GET    /api/admin/events  — list events
 * POST   /api/admin/events  — create event
 * PATCH  /api/admin/events  — edit event
 * DELETE /api/admin/events  — delete event
 */
const { db }               = require('../_db');
const { requirePermission, logActivity, getClientIp } = require('../_auth');

module.exports = async (req, res) => {
  const ip = getClientIp(req);

  if (req.method === 'GET') {
    const user = await requirePermission(req, res, 'create_event');
    if (!user) return;

    try {
      const sql = db();
      if (req.query && req.query.attendees && req.query.id) {
        const eventId = parseInt(req.query.id);
        const ev = await sql`SELECT id, club_id FROM events WHERE id=${eventId} LIMIT 1`;
        if (!ev[0]) return res.status(404).json({ error:'Tədbir tapılmadı.' });
        if (!['SUPER_ADMIN','ADMIN'].includes(user.role) && ev[0].club_id !== user.club_id) return res.status(403).json({ error:'Bu tədbirin iştirakçılarını görməyə icazəniz yoxdur.' });
        const attendees = await sql`SELECT u.id,u.full_name,u.member_code,u.group_no,u.faculty,u.photo_url,c.name club_name,a.status FROM event_attendance a JOIN users u ON u.id=a.user_id LEFT JOIN clubs c ON c.id=u.club_id WHERE a.event_id=${eventId} AND a.status='GOING' ORDER BY u.full_name`;
        return res.status(200).json({ attendees, count:attendees.length });
      }
      const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
      const events = isSuperOrAdmin
        ? await sql`
            SELECT e.*, c.name club_name, u.full_name creator_name
            FROM events e
            LEFT JOIN clubs c ON c.id = e.club_id
            LEFT JOIN users u ON u.id = e.created_by
            ORDER BY e.event_date DESC LIMIT 200
          `
        : await sql`
            SELECT e.*, c.name club_name, u.full_name creator_name
            FROM events e
            LEFT JOIN clubs c ON c.id = e.club_id
            LEFT JOIN users u ON u.id = e.created_by
            WHERE e.club_id = ${user.club_id}
            ORDER BY e.event_date DESC LIMIT 200
          `;
      return res.status(200).json({ events });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'POST') {
    const user = await requirePermission(req, res, 'create_event');
    if (!user) return;

    const { title, eventDate, location, description, clubId, coverUrl } = req.body || {};
    if (!title || !eventDate) {
      return res.status(400).json({ error: 'Başlıq və tarix tələb olunur.' });
    }

    // Club scope
    const targetClubId = ['SUPER_ADMIN', 'ADMIN'].includes(user.role)
      ? (clubId ? parseInt(clubId) : null)
      : user.club_id;

    try {
      const sql = db();
      const rows = await sql`
        INSERT INTO events(title, event_date, location, description, club_id, created_by, cover_url)
        VALUES(
          ${title.trim()},
          ${eventDate},
          ${location    || ''},
          ${description || ''},
          ${targetClubId},
          ${user.id},
          ${coverUrl || null}
        )
        RETURNING id
      `;
      await logActivity(user, `Yeni tədbir yaratdı: "${title.trim()}"`, {
        targetType: 'event', targetId: rows[0].id, targetName: title.trim(), ip
      });
      return res.status(201).json({ ok: true, id: rows[0].id });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'PATCH') {
    const user = await requirePermission(req, res, 'edit_event');
    if (!user) return;

    const { id, title, eventDate, location, description, coverUrl } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id tələb olunur.' });

    try {
      const sql = db();
      // Club scope
      if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        const existing = await sql`SELECT club_id FROM events WHERE id = ${parseInt(id)} LIMIT 1`;
        if (!existing[0] || existing[0].club_id !== user.club_id) {
          return res.status(403).json({ error: 'Bu tədbirinə icazəniz yoxdur.' });
        }
      }
      await sql`
        UPDATE events
        SET title       = COALESCE(${title       || null}, title),
            event_date  = COALESCE(${eventDate   || null}, event_date),
            location    = COALESCE(${location    || null}, location),
            description = COALESCE(${description || null}, description),
            cover_url   = ${coverUrl !== undefined ? (coverUrl || null) : null}
        WHERE id = ${parseInt(id)}
      `;
      await logActivity(user, `Tədbir redaktə etdi (id:${id})`, {
        targetType: 'event', targetId: parseInt(id), ip
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'DELETE') {
    const user = await requirePermission(req, res, 'delete_event');
    if (!user) return;

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id tələb olunur.' });

    try {
      const sql = db();
      if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        const existing = await sql`SELECT club_id FROM events WHERE id = ${parseInt(id)} LIMIT 1`;
        if (!existing[0] || existing[0].club_id !== user.club_id) {
          return res.status(403).json({ error: 'Bu tədbirinə icazəniz yoxdur.' });
        }
      }
      await sql`DELETE FROM events WHERE id = ${parseInt(id)}`;
      await logActivity(user, `Tədbir sildi (id:${id})`, {
        targetType: 'event', targetId: parseInt(id), ip
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
