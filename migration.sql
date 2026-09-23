-- ============================================================
-- OYU THİK — Auth & Permission System Migration
-- Run this ONCE against your Neon PostgreSQL database
-- ============================================================

-- 1. Mövcud users cədvəlinə yeni sütunlar əlavə et
ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_in_club VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Rol constraint-i genişləndir (SUPER_ADMIN əlavə et)
--    Əvvəlcə köhnə constraint-i sil
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
--    Yenisini əlavə et
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN','ADMIN','CHAIR','VICE_CHAIR','MEMBER'));

-- 3. Permissions cədvəli (mövcud icazə açarları)
CREATE TABLE IF NOT EXISTS permissions (
  id      SERIAL PRIMARY KEY,
  key     VARCHAR(60)  UNIQUE NOT NULL,
  label   VARCHAR(120) NOT NULL,
  category VARCHAR(60) DEFAULT 'general'
);

-- 4. User ↔ Permission əlaqəsi
--    club_scope_id: NULL = global, dəyər varsa = yalnız həmin kluba aid
CREATE TABLE IF NOT EXISTS user_permissions (
  id             SERIAL PRIMARY KEY,
  user_id        INT REFERENCES users(id) ON DELETE CASCADE,
  permission_key VARCHAR(60) NOT NULL,
  club_scope_id  INT REFERENCES clubs(id) ON DELETE CASCADE,
  UNIQUE(user_id, permission_key)
);

-- 5. Admin credentials (üzv kabinetindən ayrı şifrə)
CREATE TABLE IF NOT EXISTS admin_credentials (
  id              SERIAL PRIMARY KEY,
  user_id         INT  REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  password_hash   TEXT NOT NULL,
  active          BOOLEAN      DEFAULT true,
  last_login      TIMESTAMPTZ,
  failed_attempts INT          DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT now(),
  updated_at      TIMESTAMPTZ  DEFAULT now()
);

-- Mövcud admin/sədr şifrələrini admin_credentials cədvəlinə köçür
INSERT INTO admin_credentials(user_id, password_hash, active)
SELECT id, password_hash, true FROM users
WHERE role IN ('ADMIN', 'SUPER_ADMIN', 'CHAIR') AND password_hash IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 6. Admin sessions (HttpOnly cookie ilə idarə edilir)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id         VARCHAR(64)  PRIMARY KEY,
  user_id    INT          REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  DEFAULT now(),
  expires_at TIMESTAMPTZ  NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- 7. Member sessions (yalnız üzv kodu ilə giriş)
CREATE TABLE IF NOT EXISTS member_sessions (
  id         VARCHAR(64)  PRIMARY KEY,
  user_id    INT          REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  DEFAULT now(),
  expires_at TIMESTAMPTZ  NOT NULL
);

-- 8. Rate limiting cədvəli
CREATE TABLE IF NOT EXISTS rate_limits (
  id           SERIAL       PRIMARY KEY,
  ip           VARCHAR(45)  NOT NULL,
  endpoint     VARCHAR(60)  NOT NULL,
  attempts     INT          DEFAULT 1,
  window_start TIMESTAMPTZ  DEFAULT now(),
  UNIQUE(ip, endpoint)
);

-- 9. Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id          SERIAL       PRIMARY KEY,
  actor_id    INT          REFERENCES users(id) ON DELETE SET NULL,
  actor_name  VARCHAR(160),
  action      VARCHAR(300) NOT NULL,
  target_type VARCHAR(60),
  target_id   INT,
  target_name VARCHAR(200),
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ  DEFAULT now()
);

-- 10. Performans üçün indekslər
CREATE INDEX IF NOT EXISTS idx_member_sessions_user    ON member_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_member_sessions_expires ON member_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user     ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires  ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user   ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor     ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created   ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_ep       ON rate_limits(ip, endpoint);

-- 11. Permissions seed data
INSERT INTO permissions(key, label, category) VALUES
  ('manage_club',          'Klubunu idarə et',     'club'),
  ('view_members',         'Üzvləri gör',          'members'),
  ('create_member',        'Üzv əlavə et',         'members'),
  ('edit_member',          'Üzv redaktə et',       'members'),
  ('delete_member',        'Üzv sil',              'members'),
  ('create_news',          'Xəbər əlavə et',       'content'),
  ('edit_news',            'Xəbər redaktə et',     'content'),
  ('delete_news',          'Xəbər sil',            'content'),
  ('create_event',         'Tədbir əlavə et',      'events'),
  ('edit_event',           'Tədbir redaktə et',    'events'),
  ('delete_event',         'Tədbir sil',           'events'),
  ('manage_gallery',       'Qalereya',             'gallery'),
  ('manage_leadership',    'Rəhbərlik',            'site'),
  ('manage_clubs',         'Bütün klublar',        'site'),
  ('manage_admins',        'Adminlər',             'admin'),
  ('manage_permissions',   'Permission idarəsi',   'admin'),
  ('manage_site_settings', 'Sayt ayarları',        'admin'),
  ('view_activity_logs',   'Logları gör',          'admin')
ON CONFLICT(key) DO NOTHING;

-- 12. Köhnə süresi keçmiş session-ları avtomatik silmək üçün funksiya
--    (Neon cron və ya manual çağırış üçün)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM admin_sessions  WHERE expires_at < now();
  DELETE FROM member_sessions WHERE expires_at < now();
  DELETE FROM rate_limits
    WHERE window_start < now() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Bitti. Migration uğurlu tamamlandı.


-- Club social media + flexible club management positions
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS whatsapp_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS telegram_url TEXT;


-- Event cover image support
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Vice chair role support
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('SUPER_ADMIN','ADMIN','CHAIR','VICE_CHAIR','MEMBER'));


-- Discord-style role presentation settings.
-- Stable role_key remains the authorization identity; display_name/color are editable.
CREATE TABLE IF NOT EXISTS role_settings(
  role_key VARCHAR(30) PRIMARY KEY,
  display_name VARCHAR(80) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#174fae',
  sort_order INT NOT NULL DEFAULT 0,
  protected BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO role_settings(role_key,display_name,color,sort_order,protected) VALUES
 ('SUPER_ADMIN','Baş Admin','#dc2626',100,true),
 ('ADMIN','Admin','#7c3aed',80,true),
 ('CHAIR','Klub Sədri','#174fae',60,true),
 ('VICE_CHAIR','Sədr Müavini','#0f9f78',40,true),
 ('MEMBER','Üzv','#64748b',20,true)
ON CONFLICT(role_key) DO NOTHING;
