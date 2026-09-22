/**
 * GET /api/admin
 * Admin dashboard overview — requires admin session.
 * SUPER_ADMIN sees all. Others see scoped data.
 */
const { db }              = require('./_db');
const { requireAdminAuth } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAdminAuth(req, res);
  if (!user) return;

  try {
    const sql = db();
    const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);

    let usersQuery, clubsQuery;

    if (isSuperOrAdmin) {
      // SUPER_ADMIN / ADMIN bütün məlumatları görür
      [usersQuery, clubsQuery] = await Promise.all([
        sql`
          SELECT u.id, u.full_name, u.group_no, u.faculty, u.role,
                 u.member_code, u.active, u.joined_at,
                 c.name club_name, c.id club_id
          FROM users u
          LEFT JOIN clubs c ON c.id = u.club_id
          ORDER BY u.created_at DESC
          LIMIT 500
        `,
        sql`
          SELECT c.*, count(u.id)::int member_count
          FROM clubs c
          LEFT JOIN users u ON u.club_id = c.id AND u.active = true
          GROUP BY c.id
          ORDER BY c.name
        `
      ]);
    } else {
      // CHAIR yalnız öz klubunu görür
      [usersQuery, clubsQuery] = await Promise.all([
        sql`
          SELECT u.id, u.full_name, u.group_no, u.faculty, u.role,
                 u.member_code, u.active, u.joined_at,
                 c.name club_name, c.id club_id
          FROM users u
          LEFT JOIN clubs c ON c.id = u.club_id
          WHERE u.club_id = ${user.club_id}
          ORDER BY u.created_at DESC
        `,
        sql`
          SELECT c.*, count(u.id)::int member_count
          FROM clubs c
          LEFT JOIN users u ON u.club_id = c.id AND u.active = true
          WHERE c.id = ${user.club_id}
          GROUP BY c.id
        `
      ]);
    }

    const [newsCount, eventCount, memberCount] = await Promise.all([
      sql`SELECT count(*)::int n FROM news`,
      sql`SELECT count(*)::int n FROM events`,
      sql`SELECT count(*)::int n FROM users WHERE active = true`,
    ]);

    return res.status(200).json({
      users:       usersQuery,
      clubs:       clubsQuery,
      newsCount:   newsCount[0].n,
      eventCount:  eventCount[0].n,
      memberCount: memberCount[0].n,
    });
  } catch (e) {
    console.error('Admin dashboard error:', e.message);
    return res.status(500).json({ error: 'Server xətası.' });
  }
};
