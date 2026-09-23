/**
 * GET /api/admin
 * Admin dashboard overview — requires admin session.
 * SUPER_ADMIN sees all. Others see scoped data.
 */
const { db }              = require('./_db');
const { requireAdminAuth } = require('./_auth');

module.exports = async (req, res) => {
  const user = await requireAdminAuth(req, res);
  if (!user) return;

  try {
    const sql = db();

    // Discord-style role settings live here to avoid adding another Vercel function.
    if (req.query && req.query.resource === 'roles') {
      if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Rolları yalnız Baş Admin idarə edə bilər.' });
      if (req.method === 'GET') {
        const roles = await sql`
          SELECT r.role_key,r.display_name,r.color,r.sort_order,r.protected,count(u.id)::int member_count
          FROM role_settings r LEFT JOIN users u ON u.role=r.role_key
          GROUP BY r.role_key,r.display_name,r.color,r.sort_order,r.protected
          ORDER BY r.sort_order DESC,r.role_key
        `;
        return res.json({ roles });
      }
      if (req.method === 'PATCH') {
        const {roleKey,displayName,color,sortOrder}=req.body||{};
        const allowed=['SUPER_ADMIN','ADMIN','CHAIR','VICE_CHAIR','MEMBER'];
        if(!allowed.includes(roleKey)) return res.status(400).json({error:'Yanlış rol.'});
        const name=String(displayName||'').trim();
        if(name.length<2||name.length>80) return res.status(400).json({error:'Rol adı 2-80 simvol olmalıdır.'});
        const safeColor=/^#[0-9a-fA-F]{6}$/.test(color||'')?color:'#174fae';
        await sql`UPDATE role_settings SET display_name=${name},color=${safeColor},sort_order=${Number.isFinite(Number(sortOrder))?Number(sortOrder):0},updated_at=now() WHERE role_key=${roleKey}`;
        return res.json({ok:true});
      }
      return res.status(405).json({error:'Method not allowed'});
    }

    if (req.query && req.query.resource === 'gallery') {
      if (!['SUPER_ADMIN','ADMIN','CHAIR','VICE_CHAIR'].includes(user.role)) return res.status(403).json({ error: 'İcazə yoxdur.' });
      if (req.method === 'GET') {
        const items = await sql`SELECT * FROM gallery ORDER BY sort_order DESC, created_at DESC`;
        return res.json({ items });
      }
      if (req.method === 'POST') {
        const {title,imageUrl,category,sortOrder}=req.body||{};
        if (!imageUrl) return res.status(400).json({error:'Şəkil tələb olunur.'});
        const rows=await sql`INSERT INTO gallery(title,image_url,category,sort_order,created_by) VALUES (${String(title||'').trim()},${String(imageUrl)},${String(category||'Universitet həyatı')},${Number(sortOrder)||0},${user.id}) RETURNING *`;
        return res.status(201).json({ok:true,item:rows[0]});
      }
      if (req.method === 'PATCH') {
        const {id,title,category,sortOrder}=req.body||{};
        await sql`UPDATE gallery SET title=${String(title||'').trim()},category=${String(category||'Universitet həyatı')},sort_order=${Number(sortOrder)||0} WHERE id=${Number(id)}`;
        return res.json({ok:true});
      }
      if (req.method === 'DELETE') {
        const id=Number((req.body||{}).id);
        await sql`DELETE FROM gallery WHERE id=${id}`;
        return res.json({ok:true});
      }
      return res.status(405).json({error:'Method not allowed'});
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
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
