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
