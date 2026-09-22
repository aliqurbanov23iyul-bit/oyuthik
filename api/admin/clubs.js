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
      const clubs = await sql`
        SELECT c.*, count(u.id)::int member_count
        FROM clubs c
        LEFT JOIN users u ON u.club_id = c.id AND u.active = true
        GROUP BY c.id
        ORDER BY c.name
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

  return res.status(405).json({ error: 'Method not allowed' });
};
