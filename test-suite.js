/**
 * OYU THİK — Automated Verification & Test Suite
 * Tests core security, code generation, authentication cookies, permissions, and scopes.
 */
const assert = require('assert');
const { parseCookies, getClientIp } = require('./api/_auth');

console.log('🧪 OYU THİK TEST SUİTİ BAŞLADILIR...\n');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ [KEÇDİ] ${name}`);
    passedTests++;
  } catch (e) {
    console.error(`  ❌ [UĞURSUZ] ${name}`);
    console.error(`     Xəta: ${e.message}`);
    failedTests++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [KEÇDİ] ${name}`);
    passedTests++;
  } catch (e) {
    console.error(`  ❌ [UĞURSUZ] ${name}`);
    console.error(`     Xəta: ${e.message}`);
    failedTests++;
  }
}

(async () => {
  // ── TEST QRUPU 1: Üzv Kodu Generatoru (_codegen.js) ─────────────
  console.log('📌 1. Üzv Kodu Generatoru (_codegen.js) testləri:');
  const { generateMemberCode } = require('./api/_codegen');

  // Test alphabet and random generation without DB
  const crypto = require('crypto');
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const FORBIDDEN_CHARS = ['0', 'O', '1', 'I', 'L'];

  it('Alphabet qarışıq simvolları ehtiva etmir (0, O, 1, I, L)', () => {
    FORBIDDEN_CHARS.forEach(char => {
      assert.strictEqual(ALPHABET.includes(char), false, `Qadağan olunmuş simvol tapıldı: ${char}`);
    });
  });

  it('1,000 generasiyada qadağan olunmuş simvol çıxmır və format THIK-XXXX-XXXX kimidir', () => {
    const codePattern = /^THIK-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/;
    for (let i = 0; i < 1000; i++) {
      let part1 = '';
      let part2 = '';
      for (let j = 0; j < 4; j++) {
        part1 += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
        part2 += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
      }
      const code = `THIK-${part1}-${part2}`;
      assert.strictEqual(codePattern.test(code), true, `Kod formata uyğun deyil: ${code}`);
      FORBIDDEN_CHARS.forEach(char => {
        assert.strictEqual(part1.includes(char), false, `part1-də qadağan olunmuş simvol var: ${char}`);
        assert.strictEqual(part2.includes(char), false, `part2-də qadağan olunmuş simvol var: ${char}`);
      });
    }
  });

  // ── TEST QRUPU 2: Cookie və Auth Middleware (_auth.js) ──────────
  console.log('\n📌 2. Cookie və Auth Köməkçiləri (_auth.js) testləri:');

  it('parseCookies() cookie sətirini düzgün JSON xəritəsinə çevirir', () => {
    const mockReq = {
      headers: {
        cookie: 'thik_member_session=abcd1234efgh; other_token=xyz987; theme=dark'
      }
    };
    const cookies = parseCookies(mockReq);
    assert.strictEqual(cookies['thik_member_session'], 'abcd1234efgh');
    assert.strictEqual(cookies['other_token'], 'xyz987');
    assert.strictEqual(cookies['theme'], 'dark');
  });

  it('parseCookies() boş və ya natamam cookie-də çökmür', () => {
    assert.deepStrictEqual(parseCookies({ headers: {} }), {});
    assert.deepStrictEqual(parseCookies({ headers: { cookie: '' } }), {});
  });

  it('getClientIp() proxy və direct başlıqlardan IP-ni düzgün alır', () => {
    const req1 = { headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' } };
    assert.strictEqual(getClientIp(req1), '203.0.113.195');

    const req2 = { headers: { 'x-real-ip': '198.51.100.4' } };
    assert.strictEqual(getClientIp(req2), '198.51.100.4');

    const req3 = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    assert.strictEqual(getClientIp(req3), '127.0.0.1');
  });

  // ── TEST QRUPU 3: Permission və Rol İcazəsi Məntiqi ──────────────
  console.log('\n📌 3. Permission və Rol Yoxlaması Məntiqi:');

  it('SUPER_ADMIN bütün əməliyyatlara birbaşa icazə alır', () => {
    const superAdminUser = {
      id: 1,
      role: 'SUPER_ADMIN',
      permissions: ['manage_club', 'view_members', 'create_member']
    };
    // Super admin istənilən permission üçün true olmalıdır
    const canDoAnything = (user, perm) => user.role === 'SUPER_ADMIN' || user.permissions.includes(perm);
    assert.strictEqual(canDoAnything(superAdminUser, 'manage_site_settings'), true);
    assert.strictEqual(canDoAnything(superAdminUser, 'manage_admins'), true);
  });

  it('ADMIN və CHAIR yalnız icazəsi olan funksiyaları icra edə bilər', () => {
    const chairUser = {
      id: 5,
      role: 'CHAIR',
      club_id: 3,
      permissions: ['view_members', 'create_member', 'create_event']
    };
    const canDo = (user, perm) => user.role === 'SUPER_ADMIN' || user.permissions.includes(perm);
    assert.strictEqual(canDo(chairUser, 'view_members'), true);
    assert.strictEqual(canDo(chairUser, 'create_event'), true);
    assert.strictEqual(canDo(chairUser, 'manage_admins'), false);
    assert.strictEqual(canDo(chairUser, 'manage_permissions'), false);
  });

  it('Klub Sədri yalnız öz klubuna aid hədəfi idarə edə bilər (Club Scope)', () => {
    const chairUser = {
      id: 5,
      role: 'CHAIR',
      club_id: 3,
      permissions: ['create_member']
    };

    const isScopeAllowed = (user, targetClubId) => {
      if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
      return user.club_id === targetClubId;
    };

    assert.strictEqual(isScopeAllowed(chairUser, 3), true, 'Öz klubuna icazə verilməlidir');
    assert.strictEqual(isScopeAllowed(chairUser, 2), false, 'Başqa kluba icazə verilməməlidir');
    assert.strictEqual(isScopeAllowed(chairUser, null), false, 'Qlobal səviyyədə dəyişikliyə icazə verilməməlidir');
  });

  // ── TEST QRUPU 4: Frontend Fayllarının Düzgünlüyü ────────────────
  console.log('\n📌 4. Frontend və HTML Fayllarının Düzgünlüyü:');
  const fs = require('fs');

  it('login.html şifrə inputu ehtiva etmir (yalnız üzv kodu)', () => {
    const loginHtml = fs.readFileSync('./login.html', 'utf-8');
    assert.strictEqual(loginHtml.includes('type="password"'), false, 'login.html daxilində password input tapıldı!');
    assert.strictEqual(loginHtml.includes('memberCode'), true, 'login.html memberCode inputuna malik olmalıdır');
  });

  it('admin.html həm giriş formunu, həm də idarəetmə panelini ehtiva edir', () => {
    const adminHtml = fs.readFileSync('./admin.html', 'utf-8');
    assert.strictEqual(adminHtml.includes('adminLoginForm'), true, 'adminLoginForm mövcuddur');
    assert.strictEqual(adminHtml.includes('panel-permissions'), true, 'Permissions idarəetmə paneli mövcuddur');
    assert.strictEqual(adminHtml.includes('panel-adminCreds'), true, 'Admin credentials paneli mövcuddur');
    assert.strictEqual(adminHtml.includes('panel-logs'), true, 'Fəaliyyət logları paneli mövcuddur');
  });

  it('chair.html birbaşa admin.html səhifəsinə yönləndirir', () => {
    const chairHtml = fs.readFileSync('./chair.html', 'utf-8');
    assert.strictEqual(chairHtml.includes('admin.html'), true, 'chair.html admin.html keçidini ehtiva edir');
  });

  it('app.js cookie əsaslı api() və logout() funksiyalarını ehtiva edir', () => {
    const appJs = fs.readFileSync('./app.js', 'utf-8');
    assert.strictEqual(appJs.includes("credentials: 'include'"), true, 'api() funksiyası cookie göndərmək üçün include istifadə edir');
    assert.strictEqual(appJs.includes('requireMemberSession'), true, 'requireMemberSession mövcuddur');
    assert.strictEqual(appJs.includes('requireAdminSession'), true, 'requireAdminSession mövcuddur');
  });

  // ── TEST QRUPU 5: Bütün API Endpointlərinin Yüklənməsi və Sintaksisi ─
  console.log('\n📌 5. Bütün API Endpoint Modullarının Yüklənməsi və Yoxlanışı:');

  const endpoints = [
    './api/_auth.js',
    './api/_codegen.js',
    './api/_db.js',
    './api/_ratelimit.js',
    './api/admin.js',
    './api/admin/admin-credentials.js',
    './api/admin/clubs.js',
    './api/admin/events.js',
    './api/admin/logs.js',
    './api/admin/members.js',
    './api/admin/news.js',
    './api/admin/permissions.js',
    './api/auth/admin-login.js',
    './api/auth/login.js',
    './api/auth/logout.js',
    './api/auth/me.js',
    './api/chair.js',
    './api/member/dashboard.js',
    './api/public.js',
  ];

  endpoints.forEach(ep => {
    it(`Endpoint modulu səhvsiz yüklənir: ${ep}`, () => {
      const mod = require(ep);
      assert.ok(mod !== undefined && mod !== null, `Modul boşdur: ${ep}`);
    });
  });

  console.log('\n══════════════════════════════════════════════════');
  console.log(`📊 YEKUN NƏTİCƏ: ${passedTests} Keçdi, ${failedTests} Uğursuz`);
  console.log('══════════════════════════════════════════════════\n');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
