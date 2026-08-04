const fs = require('fs');
const { Pool } = require('pg');

const env = fs.readFileSync('d:/Projects/wallet/apps/admin/.env.local', 'utf8');
const dbUrlLine = env.split('\n').find(l => l.startsWith('DATABASE_URL'));
const dbUrl = dbUrlLine.split('=')[1].trim().replace(/['"]+/g, '');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync('d:/Projects/wallet/supabase/migrations/20260804000000_create_game_participants.sql', 'utf8');

pool.query(sql)
  .then(() => {
    console.log('Migration applied!');
    process.exit(0);
  })
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
