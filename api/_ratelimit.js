/**
 * DB-based rate limiter for Vercel serverless functions.
 * Uses the rate_limits table in Neon PostgreSQL.
 */
const { db } = require('./_db');

/**
 * Check and increment rate limit for a given IP + endpoint.
 * @param {string} ip        - Client IP address
 * @param {string} endpoint  - Endpoint identifier (e.g., 'member_login')
 * @param {number} maxAttempts  - Max allowed attempts in the window
 * @param {number} windowSecs   - Time window in seconds
 * @returns {Promise<{ok: boolean, remaining: number, retryAfterSecs: number}>}
 */
async function checkRateLimit(ip, endpoint, maxAttempts, windowSecs) {
  const sql = db();
  const now = new Date();

  try {
    // Upsert: əgər yoxdursa yarat, varsa cəhdi artır
    const rows = await sql`
      INSERT INTO rate_limits(ip, endpoint, attempts, window_start)
      VALUES(${ip}, ${endpoint}, 1, ${now})
      ON CONFLICT(ip, endpoint) DO UPDATE SET
        attempts     = CASE
          WHEN rate_limits.window_start < ${now} - (${windowSecs} || ' seconds')::INTERVAL
          THEN 1
          ELSE rate_limits.attempts + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < ${now} - (${windowSecs} || ' seconds')::INTERVAL
          THEN ${now}
          ELSE rate_limits.window_start
        END
      RETURNING attempts, window_start
    `;

    const { attempts, window_start } = rows[0];
    const windowExpires = new Date(new Date(window_start).getTime() + windowSecs * 1000);
    const retryAfterSecs = Math.ceil((windowExpires - now) / 1000);

    if (attempts > maxAttempts) {
      return { ok: false, remaining: 0, retryAfterSecs };
    }

    return { ok: true, remaining: maxAttempts - attempts, retryAfterSecs: 0 };
  } catch (e) {
    // Rate limit cədvəlinə yazıla bilmirsə, girişi bloklamırıq (fail-open)
    console.error('Rate limit check failed:', e.message);
    return { ok: true, remaining: maxAttempts, retryAfterSecs: 0 };
  }
}

/**
 * Reset rate limit counter for an IP + endpoint (e.g. after successful login).
 */
async function resetRateLimit(ip, endpoint) {
  const sql = db();
  try {
    await sql`
      DELETE FROM rate_limits WHERE ip = ${ip} AND endpoint = ${endpoint}
    `;
  } catch (_) { /* ignore */ }
}

/**
 * Express-style middleware wrapper.
 * @param {string} endpoint
 * @param {number} maxAttempts
 * @param {number} windowSecs
 */
function rateLimit(endpoint, maxAttempts, windowSecs) {
  return async (req, res) => {
    const ip = (
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();

    const result = await checkRateLimit(ip, endpoint, maxAttempts, windowSecs);
    if (!result.ok) {
      res.status(429).json({
        error: 'Çox sayda cəhd etdiniz. Zəhmət olmasa bir az gözləyin.',
        retryAfter: result.retryAfterSecs
      });
      return { blocked: true, ip };
    }
    return { blocked: false, ip };
  };
}

module.exports = { checkRateLimit, resetRateLimit, rateLimit };
