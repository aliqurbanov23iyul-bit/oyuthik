const platforms = {instagram: ['instagram.com', /^[A-Za-z0-9._]{1,30}$/], tiktok: ['tiktok.com', /^[A-Za-z0-9._]{2,24}$/], telegram: ['t.me', /^[A-Za-z0-9_]{5,32}$/]};
function socialUsername(platform, value) {
  const config = platforms[platform];
  if (!config || typeof value !== 'string') throw new Error('Yanlış sosial şəbəkə.');
  let username = value.trim();
  if (!username) return '';
  if (/^https?:\/\//i.test(username)) {
    const url = new URL(username);
    if (url.protocol !== 'https:' || ![config[0], 'www.' + config[0]].includes(url.hostname) || url.username || url.password) throw new Error('Yanlış profil bağlantısı.');
    username = url.pathname.replace(/^\/+|\/+$/g, '');
  }
  username = username.replace(/^@/, '');
  if (!config[1].test(username)) throw new Error('İstifadəçi adı düzgün deyil.');
  return username;
}
function socialUrl(platform, value) {
  const username = socialUsername(platform, value);
  return username ? 'https://' + platforms[platform][0] + '/' + (platform === 'tiktok' ? '@' : '') + username : null;
}
module.exports = {socialUsername, socialUrl};
