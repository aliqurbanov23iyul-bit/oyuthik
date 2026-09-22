/**
 * OYU THİK — Auth Middleware
 *
 * TWO separate session systems:
 *   1. Member sessions  → cookie: thik_member_session
 *   2. Admin sessions   → cookie: thik_admin_session
 *
 * Sessions stored in Neon DB (not JWT / not localStorage).
 * Cookies are HttpOnly + Secure + SameSite=Strict.
 */
const crypto = require('crypto');
const { db }  = require('./_db');

// ──────────────────────────────────────────────────────────────
// Cookie helpers
// ──────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === 'production';

/** Parse cookie string into a key→value map */
function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const map = {};
  raw.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) map[k.trim()] = decodeURIComponent(v.join('='));
  });
  return map;
}

/** Build Set-Cookie header value */
function buildSetCookie(name, value, maxAgeSecs) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=/`,
    `Max-Age=${maxAgeSecs}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (IS_PROD) parts.push('Secure');
  return parts.join('; ');
}

/** Build cookie-clearing header value */
function buildClearCookie(name) {
  const parts = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (IS_PROD) parts.push('Secure');
  return parts.join('; ');
}

// ──────────────────────────────────────────────────────────────
// Session management
// ──────────────────────────────────────────────────────────────

const MEMBER_SESSION_COOKIE  = 'thik_member_session';
const ADMIN_SESSION_COOKIE   = 'thik_admin_session';
const MEMBER_SESSION_SECS    = 60 * 60 * 24 * 14;  // 14 gün
const ADMIN_SESSION_SECS     = 60 * 60 * 8;         // 8 saat

/** Cryptographically secure session ID */
function newSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new member session → returns cookie header value.
 */
async function createMemberSession(res, userId) {
  const sql = db();
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + MEMBER_SESSION_SECS * 1000);
  await sql`
    INSERT INTO member_sessions(id, user_id, expires_at)
    VALUES(${id}, ${userId}, ${expiresAt})
  `;
  res.setHeader('Set-Cookie', buildSetCookie(MEMBER_SESSION_COOKIE, id, MEMBER_SESSION_SECS));
  return id;
}

/**
 * Create a new admin session → returns cookie header value.
 */
async function createAdminSession(res, userId, ip, userAgent) {
  const sql = db();
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_SECS * 1000);
  await sql`
    INSERT INTO admin_sessions(id, user_id, expires_at, ip_address, user_agent)
    VALUES(${id}, ${userId}, ${expiresAt}, ${ip || null}, ${userAgent || null})
  `;
  res.setHeader('Set-Cookie', buildSetCookie(ADMIN_SESSION_COOKIE, id, ADMIN_SESSION_SECS));
  return id;
}

/**
 * Validate member session from cookie.
 * Returns full user row or null.
 */
async function getMemberSession(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[MEMBER_SESSION_COOKIE];
  if (!sessionId) return null;

  const sql = db();
  const rows = await sql`
    SELECT
      u.id, u.full_name, u.group_no, u.faculty,
      u.role, u.club_id, u.member_code, u.photo_url,
      u.position_in_club, u.joined_at, u.active,
      c.name AS club_name
    FROM member_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN clubs c ON c.id = u.club_id
    WHERE s.id = ${sessionId}
      AND s.expires_at > now()
      AND u.active = true
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Validate admin session from cookie.
 * Returns user row + permissions array or null.
 */
async function getAdminSession(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[ADMIN_SESSION_COOKIE];
  if (!sessionId) return null;

  const sql = db();
  const rows = await sql`
    SELECT
      u.id, u.full_name, u.group_no, u.faculty,
      u.role, u.club_id, u.member_code, u.active,
      u.position_in_club,
      c.name AS club_name,
      ac.active AS admin_active
    FROM admin_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN clubs c ON c.id = u.club_id
    LEFT JOIN admin_credentials ac ON ac.user_id = u.id
    WHERE s.id = ${sessionId}
      AND s.expires_at > now()
      AND u.active = true
      AND u.role IN ('SUPER_ADMIN','ADMIN','CHAIR','VICE_CHAIR')
      AND (u.role = 'SUPER_ADMIN' OR ac.active = true)
    LIMIT 1
  `;
  if (!rows[0]) return null;

  const user = rows[0];

  // SUPER_ADMIN-in bütün permissionları var
  if (user.role === 'SUPER_ADMIN') {
    const permRows = await sql`SELECT key FROM permissions ORDER BY id`;
    user.permissions = permRows.map(p => p.key);
  } else {
    const permRows = await sql`
      SELECT permission_key, club_scope_id
      FROM user_permissions
      WHERE user_id = ${user.id}
    `;
    user.permissions = permRows.map(p => p.permission_key);
    user.permissionScopes = permRows.reduce((acc, p) => {
      acc[p.permission_key] = p.club_scope_id;
      return acc;
    }, {});

    // Sadə rol modeli: rol minimum səlahiyyətləri özü müəyyən edir.
    // user_permissions yalnız əlavə/fərdi icazələr üçündür.
    const roleDefaults = {
      ADMIN: ['manage_club','manage_clubs','view_members','create_member','edit_member','delete_member','create_news','edit_news','delete_news','create_event','edit_event','delete_event','manage_leadership'],
      CHAIR: ['manage_club','view_members','create_member','edit_member','delete_member','create_news','edit_news','create_event','edit_event'],
      VICE_CHAIR: ['manage_club','view_members','create_member','edit_member','create_news','edit_news','create_event','edit_event']
    };
    for (const key of (roleDefaults[user.role] || [])) {
      if (!user.permissions.includes(key)) user.permissions.push(key);
      if ((user.role === 'CHAIR' || user.role === 'VICE_CHAIR') && user.permissionScopes[key] === undefined) {
        user.permissionScopes[key] = user.club_id;
      }
    }
  }

  return user;
}

/**
 * Destroy member session (logout).
 */
async function destroyMemberSession(req, res) {
  const cookies = parseCookies(req);
  const sessionId = cookies[MEMBER_SESSION_COOKIE];
  if (sessionId) {
    const sql = db();
    await sql`DELETE FROM member_sessions WHERE id = ${sessionId}`.catch(() => {});
  }
  res.setHeader('Set-Cookie', buildClearCookie(MEMBER_SESSION_COOKIE));
}

/**
 * Destroy admin session (logout).
 */
async function destroyAdminSession(req, res) {
  const cookies = parseCookies(req);
  const sessionId = cookies[ADMIN_SESSION_COOKIE];
  if (sessionId) {
    const sql = db();
    await sql`DELETE FROM admin_sessions WHERE id = ${sessionId}`.catch(() => {});
  }
  res.setHeader('Set-Cookie', buildClearCookie(ADMIN_SESSION_COOKIE));
}

// ──────────────────────────────────────────────────────────────
// Guard helpers (for use in API handlers)
// ──────────────────────────────────────────────────────────────

/**
 * Require valid member session.
 * Returns user or sends 401 and returns null.
 */
async function requireMemberAuth(req, res) {
  const user = await getMemberSession(req);
  if (!user) {
    res.status(401).json({ error: 'Giriş tələb olunur', redirect: '/login.html' });
    return null;
  }
  return user;
}

/**
 * Require valid admin session.
 * Returns user (+permissions) or sends 401/403 and returns null.
 */
async function requireAdminAuth(req, res) {
  const user = await getAdminSession(req);
  if (!user) {
    res.status(401).json({ error: 'Admin girişi tələb olunur', redirect: '/admin.html' });
    return null;
  }
  return user;
}

/**
 * Require specific permission key.
 * Optionally checks club scope (targetClubId).
 */
async function requirePermission(req, res, permissionKey, targetClubId = null) {
  const user = await requireAdminAuth(req, res);
  if (!user) return null;

  if (user.role === 'SUPER_ADMIN') return user;

  if (!user.permissions.includes(permissionKey)) {
    res.status(403).json({
      error: 'Bu əməliyyat üçün icazəniz yoxdur.',
      required: permissionKey
    });
    return null;
  }

  // Club scope yoxlaması: CHAIR yalnız öz klubuna aid əməliyyatları edə bilər
  if (targetClubId !== null && user.role !== 'ADMIN') {
    const scope = user.permissionScopes?.[permissionKey];
    if (scope !== null && scope !== undefined && scope !== targetClubId) {
      res.status(403).json({
        error: 'Bu klub üçün icazəniz yoxdur.',
        required: permissionKey
      });
      return null;
    }
  }

  return user;
}

// ──────────────────────────────────────────────────────────────
// Activity logging helper
// ──────────────────────────────────────────────────────────────

async function logActivity(actor, action, { targetType, targetId, targetName, ip } = {}) {
  try {
    const sql = db();
    await sql`
      INSERT INTO activity_logs(actor_id, actor_name, action, target_type, target_id, target_name, ip_address)
      VALUES(
        ${actor?.id    || null},
        ${actor?.full_name || 'Sistema'},
        ${action},
        ${targetType   || null},
        ${targetId     || null},
        ${targetName   || null},
        ${ip           || null}
      )
    `;
  } catch (e) {
    console.error('Activity log failed:', e.message);
  }
}

// ──────────────────────────────────────────────────────────────
// IP helper
// ──────────────────────────────────────────────────────────────

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  ).split(',')[0].trim();
}

module.exports = {
  parseCookies,
  createMemberSession,
  createAdminSession,
  getMemberSession,
  getAdminSession,
  destroyMemberSession,
  destroyAdminSession,
  requireMemberAuth,
  requireAdminAuth,
  requirePermission,
  logActivity,
  getClientIp,
};
