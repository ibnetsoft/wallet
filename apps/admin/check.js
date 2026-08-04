const fs = require('fs');
const { Pool } = require('pg');

const env = fs.readFileSync('d:/Projects/wallet/apps/admin/.env.local', 'utf8');
const dbUrlLine = env.split('\n').find(l => l.startsWith('DATABASE_URL'));
const dbUrl = dbUrlLine.split('=')[1].trim().replace(/['"]+/g, '');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT * FROM public.system_settings')
  .then(res => {
    console.log(res.rows);
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
