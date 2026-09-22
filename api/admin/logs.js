/**
 * GET /api/admin/logs
 * Returns paginated activity logs.
 * Requires view_activity_logs permission.
 *
 * Query params:
 *   page      (default: 1)
 *   limit     (default: 50, max: 100)
 *   actorId   (filter by actor)
 *   action    (search in action text)
 */
const { db }               = require('../_db');
const { requirePermission } = require('../_auth');

module.exports = async (req, res) => {
  const user = await requirePermission(req, res, 'view_activity_logs');
  if (!user) return;

  try {
    const sql = db();

    if (req.method === 'DELETE') {
      if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Logları yalnız Baş Admin silə bilər.' });
      const id = req.body?.id ? parseInt(req.body.id) : null;
      if (id) {
        await sql`DELETE FROM activity_logs WHERE id = ${id}`;
        return res.status(200).json({ ok: true, deleted: 1 });
      }
      const result = await sql`DELETE FROM activity_logs`;
      return res.status(200).json({ ok: true, cleared: true, deleted: result.count || null });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const page    = Math.max(1, parseInt(req.query?.page  || '1'));
    const limit   = Math.min(100, Math.max(1, parseInt(req.query?.limit || '50')));
    const offset  = (page - 1) * limit;
    const actorId = req.query?.actorId ? parseInt(req.query.actorId) : null;
    const search  = req.query?.action  || null;

    let logs, total;

    if (actorId && search) {
      [logs, total] = await Promise.all([
        sql`
          SELECT l.*, u.full_name actor_full_name
          FROM activity_logs l
          LEFT JOIN users u ON u.id = l.actor_id
          WHERE l.actor_id = ${actorId}
            AND lower(l.action) LIKE ${`%${search.toLowerCase()}%`}
          ORDER BY l.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT count(*)::int n FROM activity_logs
          WHERE actor_id = ${actorId}
            AND lower(action) LIKE ${`%${search.toLowerCase()}%`}
        `
      ]);
    } else if (actorId) {
      [logs, total] = await Promise.all([
        sql`
          SELECT l.*, u.full_name actor_full_name
          FROM activity_logs l
          LEFT JOIN users u ON u.id = l.actor_id
          WHERE l.actor_id = ${actorId}
          ORDER BY l.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT count(*)::int n FROM activity_logs WHERE actor_id = ${actorId}`
      ]);
    } else if (search) {
      [logs, total] = await Promise.all([
        sql`
          SELECT l.*, u.full_name actor_full_name
          FROM activity_logs l
          LEFT JOIN users u ON u.id = l.actor_id
          WHERE lower(l.action) LIKE ${`%${search.toLowerCase()}%`}
          ORDER BY l.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT count(*)::int n FROM activity_logs
          WHERE lower(action) LIKE ${`%${search.toLowerCase()}%`}
        `
      ]);
    } else {
      [logs, total] = await Promise.all([
        sql`
          SELECT l.*, u.full_name actor_full_name
          FROM activity_logs l
          LEFT JOIN users u ON u.id = l.actor_id
          ORDER BY l.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT count(*)::int n FROM activity_logs`
      ]);
    }

    return res.status(200).json({
      logs,
      pagination: {
        page,
        limit,
        total: total[0].n,
        totalPages: Math.ceil(total[0].n / limit),
      }
    });
  } catch (e) {
    console.error('Logs error:', e.message);
    return res.status(500).json({ error: 'Server xətası.' });
  }
};
