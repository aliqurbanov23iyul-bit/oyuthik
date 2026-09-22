/**
 * OYU THİK — Migration Runner
 * Executes migration.sql on the Neon PostgreSQL database.
 * Run with: node migration-runner.js
 */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

(async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ XƏTA: DATABASE_URL təyin edilməyib!');
    console.error('İstifadə: $env:DATABASE_URL="postgresql://..."; node migration-runner.js');
    process.exit(1);
  }

  console.log('🔄 Neon PostgreSQL bazasına qoşulur...');
  const sql = neon(dbUrl);

  const migrationPath = path.join(__dirname, 'migration.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

  // Split SQL commands by semicolon (ignoring comments / empty lines / functions block)
  // For safety and compatibility with PL/pgSQL function block, let's run individual statements or whole script
  console.log('📦 Migration icra edilir...');

  try {
    // Neon serverless sql template can execute string via sql(query) or template
    // neon(...) allows neon(url)(query)
    await sql(sqlContent);
    console.log('✅ Migration uğurla tamamlandı! Bütün cədvəllər və indekslər yaradıldı.');
  } catch (err) {
    console.error('❌ Migration xətası:', err.message);
    process.exit(1);
  }
})();
