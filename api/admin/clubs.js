/**
 * GET  /api/admin/clubs  — list clubs
 * POST /api/admin/clubs  — create club
 * PATCH /api/admin/clubs — update club
 */
const { db }               = require('../_db');
const { requirePermission, logActivity, getClientIp } = require('../_auth');

module.exports = async (req, res) => {
  const ip = getClientIp(req);

  if (req.method === 'GET') {
    const user = await requirePermission(req, res, 'manage_clubs');
    if (!user) return;

    try {
      const sql = db();
      if (req.query && req.query.details && req.query.id) {
        const clubId=parseInt(req.query.id);
        if (!['SUPER_ADMIN','ADMIN'].includes(user.role) && clubId!==user.club_id) return res.status(403).json({error:'Bu klub üçün icazəniz yoxdur.'});
        const club=await sql`SELECT * FROM clubs WHERE id=${clubId} LIMIT 1`;
        if(!club[0]) return res.status(404).json({error:'Klub tapılmadı.'});
        const members=await sql`SELECT id,full_name,group_no,faculty,role,member_code,active,position_in_club,photo_url,joined_at FROM users WHERE club_id=${clubId} ORDER BY CASE WHEN role='CHAIR' THEN 0 WHEN role='VICE_CHAIR' THEN 1 ELSE 2 END, full_name`;
        return res.status(200).json({club:club[0],members});
      }
      const clubs = await sql`
        SELECT c.*, count(u.id)::int member_count,
          MAX(CASE WHEN u.role='CHAIR' THEN u.full_name END) chair_name,
          MAX(CASE WHEN u.role='VICE_CHAIR' THEN u.full_name END) vice_chair_name
        FROM clubs c LEFT JOIN users u ON u.club_id=c.id AND u.active=true
        GROUP BY c.id ORDER BY c.name
      `;
      return res.status(200).json({ clubs });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'POST') {
    const user = await requirePermission(req, res, 'manage_clubs');
    if (!user) return;

    const { name, description, logoUrl, instagramUrl, tiktokUrl, whatsappUrl, telegramUrl } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Klub adı tələb olunur.' });
    }

    try {
      const sql = db();
      const rows = await sql`
        INSERT INTO clubs(name, description, logo_url, instagram_url, tiktok_url, whatsapp_url, telegram_url)
        VALUES(${name.trim()}, ${description || ''}, ${logoUrl || null}, ${instagramUrl || null}, ${tiktokUrl || null}, ${whatsappUrl || null}, ${telegramUrl || null})
        RETURNING id
      `;
      await logActivity(user, `Yeni klub yaratdı: ${name.trim()}`, {
        targetType: 'club', targetId: rows[0].id, targetName: name.trim(), ip
      });
      return res.status(201).json({ ok: true, id: rows[0].id });
    } catch (e) {
      if (e.message.includes('unique')) {
        return res.status(409).json({ error: 'Bu adda klub artıq mövcuddur.' });
      }
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'PATCH') {
    const user = await requirePermission(req, res, 'manage_clubs');
    if (!user) return;

    const { id, name, description, logoUrl, instagramUrl, tiktokUrl, whatsappUrl, telegramUrl } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id tələb olunur.' });

    try {
      const sql = db();
      await sql`
        UPDATE clubs
        SET name        = COALESCE(${name        || null}, name),
            description = COALESCE(${description || null}, description),
            logo_url    = ${logoUrl !== undefined ? (logoUrl || null) : null},
            instagram_url = ${instagramUrl !== undefined ? (instagramUrl || null) : null},
            tiktok_url    = ${tiktokUrl !== undefined ? (tiktokUrl || null) : null},
            whatsapp_url  = ${whatsappUrl !== undefined ? (whatsappUrl || null) : null},
            telegram_url  = ${telegramUrl !== undefined ? (telegramUrl || null) : null}
        WHERE id = ${parseInt(id)}
      `;
      await logActivity(user, `Klub məlumatlarını yenilədi (id:${id})`, {
        targetType: 'club', targetId: parseInt(id), ip
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'DELETE') {
    const user = await requirePermission(req, res, 'manage_clubs');
    if (!user) return;
    if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Klubu yalnız Baş Admin silə bilər.' });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id tələb olunur.' });

    try {
      const sql = db();
      const clubId = parseInt(id);
      const rows = await sql`SELECT name FROM clubs WHERE id = ${clubId} LIMIT 1`;
      if (!rows[0]) return res.status(404).json({ error: 'Klub tapılmadı.' });

      // @neondatabase/serverless neon() uses sql.transaction(), not sql.begin().
      // Keep related rows valid and delete the club atomically.
      await sql.transaction([
        sql`UPDATE users SET club_id = NULL WHERE club_id = ${clubId}`,
        sql`UPDATE events SET club_id = NULL WHERE club_id = ${clubId}`,
        sql`DELETE FROM clubs WHERE id = ${clubId}`
      ]);

      await logActivity(user, `Klubu sildi: ${rows[0].name}`, {
        targetType: 'club', targetId: clubId, targetName: rows[0].name, ip
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Delete club error:', e);
      return res.status(500).json({ error: 'Klub silinərkən server xətası baş verdi.', detail: process.env.NODE_ENV === 'development' ? e.message : undefined });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
