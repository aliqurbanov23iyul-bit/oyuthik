/**
 * OYU THİK — Global Frontend Helpers
 * Cookie-based auth (no localStorage tokens).
 */

const API = '/api';

/**
 * Fetch wrapper — cookies are sent automatically (credentials: 'include').
 * No Authorization header needed.
 */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const r = await fetch(API + path, {
    ...opts,
    headers,
    credentials: 'include', // cookie-ləri göndər
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Sorğu uğursuz oldu');
  return d;
}

/**
 * Member logout — destroys member session cookie.
 */
async function logout() {
  try {
    await api('/auth/logout?type=member', { method: 'POST' });
  } catch (_) {}
  location.href = 'login.html';
}

/**
 * Admin logout — destroys admin session cookie.
 */
async function adminLogout() {
  try {
    await api('/auth/logout?type=admin', { method: 'POST' });
  } catch (_) {}
  location.href = 'admin.html';
}

/**
 * Require valid member session.
 * Redirects to login.html if not authenticated.
 * Returns user object or null.
 */
async function requireMemberSession() {
  try {
    const d = await api('/auth/me?type=member');
    return d.user || null;
  } catch (_) {
    location.href = 'login.html';
    return null;
  }
}

/**
 * Require valid admin session.
 * Returns user+permissions or null (caller handles redirect).
 */
async function requireAdminSession() {
  try {
    const d = await api('/auth/me?type=admin');
    return d.user || null;
  } catch (_) {
    return null;
  }
}

/**
 * XSS-safe string escaping.
 */
function esc(s = '') {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

/**
 * Format date in Azerbaijani locale.
 */
function fmtDate(d, opts = {}) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('az-AZ', {
    day: '2-digit', month: 'long', year: 'numeric', ...opts
  });
}

/**
 * Format datetime.
 */
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('az-AZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Role label in Azerbaijani.
 */
function roleLabel(role) {
  const labels = {
    SUPER_ADMIN: 'Baş Administrator',
    ADMIN: 'Administrator',
    CHAIR: 'Klub Sədri',
    MEMBER: 'Üzv',
  };
  return labels[role] || role;
}

/**
 * Toast notification (simple).
 */
function showToast(msg, type = 'success') {
  let el = document.getElementById('_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_toast';
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
      'padding:14px 20px', 'border-radius:12px', 'font-size:14px',
      'font-weight:700', 'max-width:340px', 'box-shadow:0 8px 30px rgba(0,0,0,.2)',
      'transition:opacity .3s', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type === 'error' ? '#fee2e2' : '#d1fae5';
  el.style.color = type === 'error' ? '#991b1b' : '#065f46';
  el.style.border = `1px solid ${type === 'error' ? '#fca5a5' : '#6ee7b7'}`;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3500);
}
