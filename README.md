# OYU THİK v1
Public sayt + üzv kabineti + klub sədri paneli + admin paneli + Neon backend.

## Vercel / Neon quraşdırma
1. Neon SQL Editor-də `schema.sql` faylını işə sal.
2. Vercel Environment Variables: `DATABASE_URL` və uzun random `JWT_SECRET` əlavə et.
3. İlk admin yaratmaq üçün lokal terminalda env-ləri verib `node seed-admin.js` çalışdır. İstəsən `ADMIN_CODE` və `ADMIN_PASSWORD` da təyin et.
4. GitHub-a push et və Vercel deploy et.

## Rollar
- ADMIN: bütün üzvləri, klubları və məzmunu idarə edir.
- CHAIR: yalnız öz klubunun üzvlərini görür; öz klubu üçün məzmun yarada bilər.
- MEMBER: şəxsi kabinet və açıq məlumatlar.

## Səhifələr
index.html, about.html, clubs.html, news.html, events.html, leadership.html, login.html, dashboard.html, chair.html, admin.html
