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
    ADMIN: 'İdarəçi',
    CHAIR: 'Klub Sədri',
    VICE_CHAIR: 'Sədr Müavini',
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


/* Public site language support: AZ / EN / RU */
const SITE_LANGS = ['az','en','ru'];
const UI_TRANSLATIONS = {
  en: {
    'Haqqımızda':'About','Klublar':'Clubs','Xəbərlər':'News','Tədbirlər':'Events','Rəhbərlik':'Leadership','Giriş et':'Log in','Giriş et →':'Log in →',
    'Tələbə Həmkarlar İttifaqı Komitəsi':'Student Trade Union Committee','Bakı, Azərbaycan':'Baku, Azerbaijan',
    'Tələbə həyatını birlikdə daha güclü edirik.':'Together, we make student life stronger.',
    'OYU THİK tələbələrin sosial, mədəni və akademik həyatında aktiv iştirakını dəstəkləyən tələbə platformasıdır. Klubları kəşf et, tədbirlərə qatıl və universitet həyatının bir parçası ol.':'OYU THİK is a student platform supporting active participation in social, cultural and academic life. Discover clubs, join events and become part of university life.',
    'Klubları kəşf et':'Discover clubs','THİK haqqında':'About THİK','2021-dən tələbələrin yanında':'Supporting students since 2021',
    'Aktiv klub':'Active clubs','THİK üzvü':'THİK members','Tədbir':'Events','Xəbər və paylaşım':'News and posts','YENİLİKLƏR':'UPDATES','Son xəbərlər':'Latest news',
    'THİK və klubların son fəaliyyətləri.':'Latest activities from THİK and clubs.','Hamısına bax →':'View all →','TƏLƏBƏ HƏYATI':'STUDENT LIFE','Klublarımız':'Our clubs',
    'Maraq dairənə uyğun icmanı tap.':'Find a community that matches your interests.','Bütün klublar →':'All clubs →','OYU THİK ÜZVÜSƏN?':'ARE YOU AN OYU THİK MEMBER?',
    'Şəxsi kabinetinə daxil ol':'Log in to your account','Kabinetə giriş →':'Account login →','Keçidlər':'Links','Əlaqə':'Contact','Bütün hüquqlar qorunur.':'All rights reserved.',
    'İCMALAR':'COMMUNITIES','Maraq dairənə uyğun klubu kəşf et.':'Discover a club matching your interests.','Xəbərlər və fəaliyyətlər':'News and activities',
    'Qarşıdan gələn və keçirilmiş tədbirlər.':'Upcoming and past events.','İdarəetmə şurası':'Management board','OYU THİK rəhbərliyi və klub sədrləri.':'OYU THİK leadership and club chairs.',
    'Məqsədimiz':'Our goal','Missiyamız':'Our mission','İcmamız':'Our community','Kabinetə giriş':'Account login','Üzv kabineti':'Member account','Üzv kodu':'Member code','Daxil ol':'Log in','Ana səhifəyə qayıt':'Back to home',
    'Klub sədri':'Club chair','Sədr təyin edilməyib':'Chair not assigned','üzv':'members'
  },
  ru: {
    'Haqqımızda':'О нас','Klublar':'Клубы','Xəbərlər':'Новости','Tədbirlər':'Мероприятия','Rəhbərlik':'Руководство','Giriş et':'Войти','Giriş et →':'Войти →',
    'Tələbə Həmkarlar İttifaqı Komitəsi':'Студенческий профсоюзный комитет','Bakı, Azərbaycan':'Баку, Азербайджан',
    'Tələbə həyatını birlikdə daha güclü edirik.':'Вместе мы делаем студенческую жизнь ярче.',
    'OYU THİK tələbələrin sosial, mədəni və akademik həyatında aktiv iştirakını dəstəkləyən tələbə platformasıdır. Klubları kəşf et, tədbirlərə qatıl və universitet həyatının bir parçası ol.':'OYU THİK — студенческая платформа, поддерживающая активное участие в социальной, культурной и академической жизни. Открывайте клубы, участвуйте в мероприятиях и станьте частью университетской жизни.',
    'Klubları kəşf et':'Открыть клубы','THİK haqqında':'О THİK','2021-dən tələbələrin yanında':'Вместе со студентами с 2021 года',
    'Aktiv klub':'Активных клубов','THİK üzvü':'Участников THİK','Tədbir':'Мероприятий','Xəbər və paylaşım':'Новостей и публикаций','YENİLİKLƏR':'НОВОСТИ','Son xəbərlər':'Последние новости',
    'THİK və klubların son fəaliyyətləri.':'Последние события THİK и клубов.','Hamısına bax →':'Смотреть все →','TƏLƏBƏ HƏYATI':'СТУДЕНЧЕСКАЯ ЖИЗНЬ','Klublarımız':'Наши клубы',
    'Maraq dairənə uyğun icmanı tap.':'Найдите сообщество по своим интересам.','Bütün klublar →':'Все клубы →','OYU THİK ÜZVÜSƏN?':'ВЫ УЧАСТНИК OYU THİK?',
    'Şəxsi kabinetinə daxil ol':'Войти в личный кабинет','Kabinetə giriş →':'Войти в кабинет →','Keçidlər':'Ссылки','Əlaqə':'Контакты','Bütün hüquqlar qorunur.':'Все права защищены.',
    'İCMALAR':'СООБЩЕСТВА','Maraq dairənə uyğun klubu kəşf et.':'Найдите клуб по своим интересам.','Xəbərlər və fəaliyyətlər':'Новости и деятельность',
    'Qarşıdan gələn və keçirilmiş tədbirlər.':'Предстоящие и прошедшие мероприятия.','İdarəetmə şurası':'Совет управления','OYU THİK rəhbərliyi və klub sədrləri.':'Руководство OYU THİK и председатели клубов.',
    'Məqsədimiz':'Наша цель','Missiyamız':'Наша миссия','İcmamız':'Наше сообщество','Kabinetə giriş':'Вход в кабинет','Üzv kabineti':'Кабинет участника','Üzv kodu':'Код участника','Daxil ol':'Войти','Ana səhifəyə qayıt':'Вернуться на главную',
    'Klub sədri':'Председатель клуба','Sədr təyin edilməyib':'Председатель не назначен','üzv':'участников'
  }
};
Object.assign(UI_TRANSLATIONS.en,{
'İdarəetmə Girişi':'Admin Login','Sistemə Daxil Olun':'Sign in to the system','İdarəçi Kodu':'Admin Code','Admin Şifrəsi':'Admin Password','Üzv kabinetinə keçin →':'Go to member account →','← Ana səhifəyə qayıt':'← Back to home','İdarəetmə Paneli':'Admin Panel','Əsas':'Main','İdarəetmə':'Management','Təhlükəsizlik':'Security','İcmal':'Overview','Ümumi Üzvlər':'Total Members','Tez Əməliyyatlar':'Quick Actions','Son Əlavə Edilən Üzvlər':'Recently Added Members','Bütün Üzvlər →':'All Members →','Ad Soyad':'Full Name','Üzv Kodu':'Member Code','Klub':'Club','Rol':'Role','Vəzifə':'Position','Yüklənir...':'Loading...','Üzvlərin İdarə Edilməsi':'Member Management','Bütün klublar':'All clubs','Bütün rollar':'All roles','Baş Admin':'Super Admin','Admin':'Admin','Klub Sədri':'Club Chair','Üzv':'Member','Qrup / Fakültə':'Group / Faculty','Status':'Status','Əməliyyatlar':'Actions','Klubların Siyahısı və İdarəsi':'Club List and Management','Klub Adı':'Club Name','Açıqlama':'Description','Üzv Sayı':'Member Count','Xəbərlər və Məzmun':'News and Content','Başlıq':'Title','Kateqoriya':'Category','Müəllif':'Author','Tarix':'Date','Tədbirlərin İdarəsi':'Event Management','Tədbir Başlığı':'Event Title','Tarix və Saat':'Date and Time','Məkan':'Location','Əlavə Edən':'Created By','İstifadəçini seçin:':'Select user:','İstifadəçi seçin...':'Select user...','Hamısını Seç':'Select All','Hamısını Təmizlə':'Clear All','Cari Giriş Statusu':'Current Login Status','Hesab Aktivdir?':'Account Active?','Uğursuz Cəhdlər':'Failed Attempts','Son Giriş':'Last Login','Axtar':'Search','Əməliyyat':'Action','Hədəf':'Target','Əvvəlki':'Previous','Növbəti →':'Next →','Yeni Üzv Yarat':'Create New Member','Qrup Nömrəsi':'Group Number','Fakültə':'Faculty','Klubdakı Vəzifəsi':'Position in Club','İmtina':'Cancel','Yarat və Kod Al':'Create and Get Code','Üzv Uğurla Yaradıldı!':'Member Created Successfully!','Yadda Saxla':'Save','Yeni Klub':'New Club','Klub Adı *':'Club Name *','Klub Logosu':'Club Logo','Logo seç və ya dəyiş':'Select or change logo','Logonu sil':'Remove logo','Xəbər Əlavə Et':'Add News','Xəbər Başlığı *':'News Title *','Dərc edilsin':'Publish','Qaralama':'Draft','Xəbər Şəkli':'News Image','Xəbər üçün şəkil seç':'Select news image','Şəkli sil':'Remove image','Qısa Xülasə':'Short Summary','Ətraflı Məzmun':'Full Content','Tədbir Əlavə Et':'Add Event','Tədbir Başlığı *':'Event Title *','Tarix və Saat *':'Date and Time *','Tədbir Şəkli':'Event Image','Tədbir üçün şəkil seç':'Select event image','Aktiv':'Active','Deaktiv':'Inactive'
});
Object.assign(UI_TRANSLATIONS.ru,{
'İdarəetmə Girişi':'Вход администратора','Sistemə Daxil Olun':'Войти в систему','İdarəçi Kodu':'Код администратора','Admin Şifrəsi':'Пароль администратора','Üzv kabinetinə keçin →':'Перейти в кабинет участника →','← Ana səhifəyə qayıt':'← На главную','İdarəetmə Paneli':'Панель управления','Əsas':'Главная','İdarəetmə':'Управление','Təhlükəsizlik':'Безопасность','İcmal':'Обзор','Ümumi Üzvlər':'Всего участников','Tez Əməliyyatlar':'Быстрые действия','Son Əlavə Edilən Üzvlər':'Недавно добавленные участники','Bütün Üzvlər →':'Все участники →','Ad Soyad':'Имя и фамилия','Üzv Kodu':'Код участника','Klub':'Клуб','Rol':'Роль','Vəzifə':'Должность','Yüklənir...':'Загрузка...','Üzvlərin İdarə Edilməsi':'Управление участниками','Bütün klublar':'Все клубы','Bütün rollar':'Все роли','Baş Admin':'Главный администратор','Admin':'Администратор','Klub Sədri':'Председатель клуба','Üzv':'Участник','Qrup / Fakültə':'Группа / Факультет','Status':'Статус','Əməliyyatlar':'Действия','Klubların Siyahısı və İdarəsi':'Список клубов и управление','Klub Adı':'Название клуба','Açıqlama':'Описание','Üzv Sayı':'Количество участников','Xəbərlər və Məzmun':'Новости и контент','Başlıq':'Заголовок','Kateqoriya':'Категория','Müəllif':'Автор','Tarix':'Дата','Tədbirlərin İdarəsi':'Управление мероприятиями','Tədbir Başlığı':'Название мероприятия','Tarix və Saat':'Дата и время','Məkan':'Место','Əlavə Edən':'Добавил','İstifadəçini seçin:':'Выберите пользователя:','İstifadəçi seçin...':'Выберите пользователя...','Hamısını Seç':'Выбрать все','Hamısını Təmizlə':'Очистить все','Cari Giriş Statusu':'Текущий статус входа','Hesab Aktivdir?':'Аккаунт активен?','Uğursuz Cəhdlər':'Неудачные попытки','Son Giriş':'Последний вход','Axtar':'Поиск','Əməliyyat':'Действие','Hədəf':'Цель','Əvvəlki':'Предыдущая','Növbəti →':'Следующая →','Yeni Üzv Yarat':'Создать участника','Qrup Nömrəsi':'Номер группы','Fakültə':'Факультет','Klubdakı Vəzifəsi':'Должность в клубе','İmtina':'Отмена','Yarat və Kod Al':'Создать и получить код','Üzv Uğurla Yaradıldı!':'Участник успешно создан!','Yadda Saxla':'Сохранить','Yeni Klub':'Новый клуб','Klub Adı *':'Название клуба *','Klub Logosu':'Логотип клуба','Logo seç və ya dəyiş':'Выбрать или изменить логотип','Logonu sil':'Удалить логотип','Xəbər Əlavə Et':'Добавить новость','Xəbər Başlığı *':'Заголовок новости *','Dərc edilsin':'Опубликовать','Qaralama':'Черновик','Xəbər Şəkli':'Изображение новости','Xəbər üçün şəkil seç':'Выбрать изображение новости','Şəkli sil':'Удалить изображение','Qısa Xülasə':'Краткое описание','Ətraflı Məzmun':'Полный текст','Tədbir Əlavə Et':'Добавить мероприятие','Tədbir Başlığı *':'Название мероприятия *','Tarix və Saat *':'Дата и время *','Tədbir Şəkli':'Изображение мероприятия','Tədbir üçün şəkil seç':'Выбрать изображение мероприятия','Aktiv':'Активен','Deaktiv':'Неактивен'
});

function getSiteLang(){ const l=localStorage.getItem('oyu_lang')||'az'; return SITE_LANGS.includes(l)?l:'az'; }
function translateText(s,lang=getSiteLang()){ if(lang==='az') return s; return (UI_TRANSLATIONS[lang]&&UI_TRANSLATIONS[lang][s])||s; }
function setSiteLang(lang){ if(!SITE_LANGS.includes(lang)) return; localStorage.setItem('oyu_lang',lang); location.reload(); }
function addLanguageSwitcher(){
  const lang=getSiteLang(); document.documentElement.lang=lang;
  const host=document.querySelector('.navbar .nav') || document.querySelector('.topbar') || document.querySelector('.login-wrap') || document.querySelector('.admin-login-box') || document.querySelector('.admin-topbar') || document.querySelector('.topbar-inner') || document.querySelector('.dash-main') || document.body;
  if(!host || document.getElementById('siteLangSwitcher')) return;
  const el=document.createElement('div'); el.id='siteLangSwitcher'; el.className='site-lang-switcher';
  el.innerHTML=SITE_LANGS.map(l=>'<button type="button" class="'+(l===lang?'active':'')+'" data-lang="'+l+'">'+l.toUpperCase()+'</button>').join('');
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>setSiteLang(b.dataset.lang));
  host.appendChild(el);
}
function applyStaticTranslations(){
  const lang=getSiteLang(); if(lang==='az') return;
  const dict=UI_TRANSLATIONS[lang]||{};
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n=>{const raw=n.nodeValue,trim=raw.trim();if(dict[trim]) n.nodeValue=raw.replace(trim,dict[trim]);});
  document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{if(dict[el.placeholder])el.placeholder=dict[el.placeholder];});
}
function translateDynamicRoot(root=document.body){
  const lang=getSiteLang(); if(lang==='az'||!root)return;
  const dict=UI_TRANSLATIONS[lang]||{};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{const raw=n.nodeValue,trim=raw.trim();if(dict[trim])n.nodeValue=raw.replace(trim,dict[trim]);});
}
document.addEventListener('DOMContentLoaded',()=>{
  applyStaticTranslations(); addLanguageSwitcher();
  const obs=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)translateDynamicRoot(n)})));
  obs.observe(document.body,{childList:true,subtree:true});
});

/* Shared member navigation for every public page */
async function syncPublicMemberNav(){
  const hosts=[...document.querySelectorAll('.public-member-nav')];
  if(!hosts.length)return;
  try{
    const d=await api('/auth/me?type=member');
    const u=d&&d.user;if(!u)return;
    const name=u.fullName||'Üzv';
    const position=u.positionInClub||roleLabel(u.role);
    const canManage=['SUPER_ADMIN','ADMIN','CHAIR','VICE_CHAIR'].includes(u.role);
    hosts.forEach((host,idx)=>{
      host.innerHTML='<div class="member-menu-wrap"><button class="member-chip shared-member-chip" type="button"><i class="fa-solid fa-user"></i><span>'+esc(name)+'</span><i class="fa-solid fa-chevron-down"></i></button><div class="member-dropdown shared-member-dropdown"><div class="member-head"><div class="member-avatar">'+esc(name[0]||'?')+'</div><div><b>'+esc(name)+'</b><small>'+esc(position)+'</small></div></div><div class="member-info"><span><i class="fa-solid fa-building-columns"></i>'+esc(u.clubName||'Klub qeyd edilməyib')+'</span><span><i class="fa-solid fa-graduation-cap"></i>'+esc(u.faculty||'Fakültə qeyd edilməyib')+'</span><span><i class="fa-solid fa-users"></i>'+esc(u.groupNo||'Qrup qeyd edilməyib')+'</span></div>'+(canManage?'<a class="member-action" href="admin.html"><i class="fa-solid fa-sliders"></i> İdarə paneli</a>':'')+'<button class="member-action logout shared-member-logout"><i class="fa-solid fa-right-from-bracket"></i> Çıxış</button></div></div>';
      const chip=host.querySelector('.shared-member-chip'),drop=host.querySelector('.shared-member-dropdown');
      chip.onclick=e=>{e.stopPropagation();document.querySelectorAll('.shared-member-dropdown.open').forEach(x=>{if(x!==drop)x.classList.remove('open')});drop.classList.toggle('open')};
      host.querySelector('.shared-member-logout').onclick=async()=>{try{await api('/auth/logout?type=member',{method:'POST'})}catch(e){}location.reload()};
    });
  }catch(e){}
}
document.addEventListener('click',()=>document.querySelectorAll('.shared-member-dropdown.open').forEach(x=>x.classList.remove('open')));
document.addEventListener('DOMContentLoaded',syncPublicMemberNav);
