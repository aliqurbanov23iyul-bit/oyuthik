/**
 * Cryptographically secure member code generator.
 * Format: THIK-XXXX-XXXX
 * Excludes confusing chars: 0, O, 1, I, L
 */
const crypto = require('crypto');
const { db }  = require('./_db');

// Qarışıq simvollar çıxarılmış alfabet
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ALPHABET_LEN = ALPHABET.length;

/**
 * 4 simvoldan ibarət random segment yaradır.
 * crypto.randomInt istifadə edir (CSPRNG).
 */
function randomSegment(len = 4) {
  let result = '';
  for (let i = 0; i < len; i++) {
    result += ALPHABET[crypto.randomInt(0, ALPHABET_LEN)];
  }
  return result;
}

/**
 * THIK-XXXX-XXXX formatında unikal üzv kodu yaradır.
 * Collision olduqda avtomatik yenidən cəhd edir (max 10 dəfə).
 */
async function generateMemberCode(retries = 10) {
  const sql = db();
  for (let attempt = 0; attempt < retries; attempt++) {
    const code = `THIK-${randomSegment()}-${randomSegment()}`;
    const rows = await sql`
      SELECT id FROM users WHERE member_code = ${code} LIMIT 1
    `;
    if (rows.length === 0) return code;
  }
  throw new Error('Unikal üzv kodu yaradıla bilmədi. Yenidən cəhd edin.');
}

module.exports = { generateMemberCode };
