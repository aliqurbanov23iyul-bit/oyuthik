/**
 * GET /api/member/dashboard
 * Returns member dashboard data:
 * - Club announcements
 * - Upcoming events
 * - Recent news
 * Requires member session cookie.
 */
const { db }               = require('../_db');
const { requireMemberAuth } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireMemberAuth(req, res);
  if (!user) return;

  try {
    const sql = db();
    const now = new Date();

    // Paralel sorğular
    const [announcements, upcomingEvents, recentNews] = await Promise.all([
      // Klub elanları (öz klubu varsa həmin klubun, yoxsa hamısının)
      user.club_id
        ? sql`
            SELECT a.*, u.full_name creator_name
            FROM announcements a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE a.club_id = ${user.club_id}
            ORDER BY a.created_at DESC
            LIMIT 5
          `
        : sql`
            SELECT a.*, u.full_name creator_name, c.name club_name
            FROM announcements a
            LEFT JOIN users u ON u.id = a.created_by
            LEFT JOIN clubs c ON c.id = a.club_id
            ORDER BY a.created_at DESC
            LIMIT 5
          `,

      // Yaxın tədbirlər
      user.club_id
        ? sql`
            SELECT e.*, c.name club_name
            FROM events e
            LEFT JOIN clubs c ON c.id = e.club_id
            WHERE e.event_date >= ${now}
              AND (e.club_id = ${user.club_id} OR e.club_id IS NULL)
            ORDER BY e.event_date ASC
            LIMIT 5
          `
        : sql`
            SELECT e.*, c.name club_name
            FROM events e
            LEFT JOIN clubs c ON c.id = e.club_id
            WHERE e.event_date >= ${now}
            ORDER BY e.event_date ASC
            LIMIT 5
          `,

      // Son xəbərlər
      sql`
        SELECT id, title, summary, category, cover_url, created_at
        FROM news
        WHERE published = true
        ORDER BY created_at DESC
        LIMIT 5
      `
    ]);

    return res.status(200).json({
      announcements,
      upcomingEvents,
      recentNews,
    });
  } catch (e) {
    console.error('Member dashboard error:', e.message);
    return res.status(500).json({ error: 'Server xətası.' });
  }
};
