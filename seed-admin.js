/**
 * OYU THİK — Super Admin Seed Script
 *
 * Creates the initial SUPER_ADMIN account with:
 * - Member code: THIK-SUPER-ADMIN (or custom via ADMIN_CODE env)
 * - Admin password: custom via ADMIN_PASSWORD env or auto-generated secure password
 * - Role: SUPER_ADMIN
 * - Writes to both `users` and `admin_credentials` tables
 *
 * Usage:
 *   $env:DATABASE_URL="postgres://..."; node seed-admin.js
 */
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('❌ XƏTA: DATABASE_URL təyin edilməyib!');
    console.error('İstifadə: $env:DATABASE_URL="postgresql://..."; node seed-admin.js');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const adminName = process.env.ADMIN_NAME || 'OYU THİK Baş Administrator';
  const adminCode = (process.env.ADMIN_CODE || 'THIK-SUPER-ADMIN').toUpperCase().trim();
  const adminPass = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');

  console.log('🔄 SUPER_ADMIN hesabı hazırlanır...');

  const hash = await bcrypt.hash(adminPass, 12);

  // 1. users cədvəlinə əlavə et və ya yenilə
  const userRows = await sql`
    INSERT INTO users(full_name, role, member_code, active, position_in_club)
    VALUES(${adminName}, 'SUPER_ADMIN', ${adminCode}, true, 'Baş Administrator')
    ON CONFLICT(member_code) DO UPDATE SET
      full_name = ${adminName},
      role = 'SUPER_ADMIN',
      active = true,
      position_in_club = 'Baş Administrator'
    RETURNING id, full_name, member_code, role
  `;

  const userId = userRows[0].id;

  // 2. admin_credentials cədvəlinə şifrə hash-ini yaz
  await sql`
    INSERT INTO admin_credentials(user_id, password_hash, active, failed_attempts, locked_until)
    VALUES(${userId}, ${hash}, true, 0, null)
    ON CONFLICT(user_id) DO UPDATE SET
      password_hash = ${hash},
      active = true,
      failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  `;

  // 3. Bütün mövcud permissions-ları təmin et
  const perms = await sql`SELECT key FROM permissions`;
  for (const p of perms) {
    await sql`
      INSERT INTO user_permissions(user_id, permission_key, club_scope_id)
      VALUES(${userId}, ${p.key}, null)
      ON CONFLICT(user_id, permission_key) DO NOTHING
    `;
  }

  console.log('\n==================================================');
  console.log('✅ SUPER_ADMIN HESABI UĞURLA YARADILDI!');
  console.log('==================================================');
  console.log(`👤 Ad Soyad:     ${userRows[0].full_name}`);
  console.log(`🏷️ Rol:          ${userRows[0].role}`);
  console.log(`🔑 Giriş Kodu:   ${userRows[0].member_code}`);
  console.log(`🔒 Admin Şifrə:  ${adminPass}`);
  console.log('==================================================');
  console.log('👉 Admin Girişi: /admin.html səhifəsində bu kod və şifrə ilə daxil olun.');
  console.log('⚠️  Şifrəni təhlükəsiz yerdə qeyd edin!\n');

})().catch(err => {
  console.error('❌ Xəta baş verdi:', err.message);
  process.exit(1);
});
