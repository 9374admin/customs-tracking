const { Pool } = require('pg');
const fs = require('fs');

const OLD_DB_URL = process.argv[2];

async function main() {
  const pool = new Pool({
    connectionString: OLD_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    max: 3,
    idleTimeoutMillis: 30000
  });

  try {
    const tables = ['users', 'processes', 'process_steps', 'operation_logs', 'chat_messages', 'notifications', 'step_files'];
    const data = {};

    const tblRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Found tables:', tblRes.rows.map(r => r.table_name).join(', '));

    for (const t of tables) {
      try {
        const r = await pool.query(`SELECT * FROM "${t}"`);
        data[t] = r.rows;
        console.log(`${t}: ${r.rows.length} rows`);
      } catch (e) {
        data[t] = [];
        console.log(`${t}: 0 rows (${e.message.substring(0,50)})`);
      }
    }

    fs.writeFileSync('db-export.json', JSON.stringify(data, null, 2));
    console.log('Export saved to db-export.json');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });