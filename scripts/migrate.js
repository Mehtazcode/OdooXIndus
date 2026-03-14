// scripts/migrate.js
// Run: node scripts/migrate.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('🔌 Connected to PostgreSQL');
    const files = ['001_schema.sql', '002_seed.sql'];
    for (const file of files) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', file), 'utf8');
      console.log(`▶  Running ${file}…`);
      await client.query(sql);
      console.log(`✓  ${file} done`);
    }
    console.log('\n✅ All migrations completed successfully!');
    console.log('\n📋 Default login:');
    console.log('   Email:    admin@coreinventory.local');
    console.log('   Password: Admin@123\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
