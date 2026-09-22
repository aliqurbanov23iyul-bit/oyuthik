/**
 * GET    /api/admin/news  — list news
 * POST   /api/admin/news  — create news
 * PATCH  /api/admin/news  — edit news
 * DELETE /api/admin/news  — delete news
 */
const { db }               = require('../_db');
const { requirePermission, logActivity, getClientIp } = require('../_auth');

module.exports = async (req, res) => {
  const ip = getClientIp(req);

  if (req.method === 'GET') {
    const user = await requirePermission(req, res, 'create_news');
    if (!user) return;

    try {
      const sql = db();
      const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
      const news = isSuperOrAdmin
        ? await sql`
            SELECT n.*, u.full_name author_name
            FROM news n
            LEFT JOIN users u ON u.id = n.author_id
            ORDER BY n.created_at DESC LIMIT 200
          `
        : await sql`
            SELECT n.*, u.full_name author_name
            FROM news n
            LEFT JOIN users u ON u.id = n.author_id
            WHERE n.author_id = ${user.id}
            ORDER BY n.created_at DESC LIMIT 200
          `;
      return res.status(200).json({ news });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'POST') {
    const user = await requirePermission(req, res, 'create_news');
    if (!user) return;

    const { title, summary, category, content, coverUrl } = req.body || {};
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ error: 'Başlıq tələb olunur.' });
    }

    try {
      const sql = db();
      const rows = await sql`
        INSERT INTO news(title, summary, content, category, cover_url, author_id)
        VALUES(
          ${title.trim()},
          ${summary  || ''},
          ${content  || ''},
          ${category || 'Xəbər'},
          ${coverUrl || null},
          ${user.id}
        )
        RETURNING id
      `;
      await logActivity(user, `Yeni xəbər yaratdı: "${title.trim()}"`, {
        targetType: 'news', targetId: rows[0].id, targetName: title.trim(), ip
      });
      return res.status(201).json({ ok: true, id: rows[0].id });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'PATCH') {
    const user = await requirePermission(req, res, 'edit_news');
    if (!user) return;

    const { id, title, summary, content, category, coverUrl, published } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id tələb olunur.' });

    try {
      const sql = db();
      // CHAIR yalnız öz xəbərlərini redaktə edə bilər
      if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        const existing = await sql`SELECT author_id FROM news WHERE id = ${parseInt(id)} LIMIT 1`;
        if (!existing[0] || existing[0].author_id !== user.id) {
          return res.status(403).json({ error: 'Bu xəbəri redaktə etmək üçün icazəniz yoxdur.' });
        }
      }
      await sql`
        UPDATE news
        SET title     = COALESCE(${title     || null}, title),
            summary   = COALESCE(${summary   || null}, summary),
            content   = COALESCE(${content   || null}, content),
            category  = COALESCE(${category  || null}, category),
            cover_url = COALESCE(${coverUrl  || null}, cover_url),
            published = COALESCE(${published !== undefined ? published : null}, published)
        WHERE id = ${parseInt(id)}
      `;
      await logActivity(user, `Xəbər redaktə etdi (id:${id})`, {
        targetType: 'news', targetId: parseInt(id), ip
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  if (req.method === 'DELETE') {
    const user = await requirePermission(req, res, 'delete_news');
    if (!user) return;

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id tələb olunur.' });

    try {
      const sql = db();
      if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        const existing = await sql`SELECT author_id FROM news WHERE id = ${parseInt(id)} LIMIT 1`;
        if (!existing[0] || existing[0].author_id !== user.id) {
          return res.status(403).json({ error: 'Bu xəbəri silmək üçün icazəniz yoxdur.' });
        }
      }
      await sql`DELETE FROM news WHERE id = ${parseInt(id)}`;
      await logActivity(user, `Xəbər sildi (id:${id})`, {
        targetType: 'news', targetId: parseInt(id), ip
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server xətası.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
