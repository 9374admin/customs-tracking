const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
let driver;

function convertSql(sql) {
  let result = sql;
  let hasInsertOrIgnore = false;

  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(result)) {
    hasInsertOrIgnore = true;
    result = result.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  }

  let i = 1;
  result = result.replace(/\?/g, () => `$${i++}`);
  result = result.replace(/datetime\('now'\)/gi, 'NOW()');
  result = result.replace(/date\('now'\)/gi, 'CURRENT_DATE');
  result = result.replace(/date\(([^)]+)\)/gi, '($1)::date');
  result = result.replace(/strftime\('([^']+)',\s*([^)]+)\)/gi, "to_char($2, '$1')");

  if (hasInsertOrIgnore && !result.toUpperCase().includes('ON CONFLICT')) {
    result = result + ' ON CONFLICT DO NOTHING';
  }

  return result;
}

function normalizeRow(row) {
  if (!row) return row;
  for (const key of Object.keys(row)) {
    if (typeof row[key] === 'bigint') {
      row[key] = Number(row[key]);
    }
  }
  return row;
}

if (DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  driver = {
    isPostgres: true,
    async get(sql, params = []) {
      const r = await pool.query(convertSql(sql), params);
      return normalizeRow(r.rows[0]);
    },
    async all(sql, params = []) {
      const r = await pool.query(convertSql(sql), params);
      return r.rows.map(normalizeRow);
    },
    async run(sql, params = []) {
      let pgSql = convertSql(sql);
      const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
        pgSql = pgSql + ' RETURNING id';
      }
      const r = await pool.query(pgSql, params);
      return { lastInsertRowid: r.rows[0]?.id ?? null, changes: r.rowCount };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async tableInfo(tableName) {
      const r = await pool.query(
        `SELECT column_name as name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [tableName]
      );
      return r.rows;
    },
    async close() { await pool.end(); }
  };
} else {
  const { DatabaseSync } = require('node:sqlite');
  const DB_PATH = path.join(__dirname, '..', 'data.db');
  const sqliteDb = new DatabaseSync(DB_PATH);
  sqliteDb.exec('PRAGMA journal_mode = WAL');
  sqliteDb.exec('PRAGMA foreign_keys = ON');

  driver = {
    isPostgres: false,
    async get(sql, params = []) {
      return sqliteDb.prepare(sql).get(...params);
    },
    async all(sql, params = []) {
      return sqliteDb.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      const info = sqliteDb.prepare(sql).run(...params);
      return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
    },
    async exec(sql) {
      sqliteDb.exec(sql);
    },
    async tableInfo(tableName) {
      return sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all();
    },
    async close() { sqliteDb.close(); }
  };
}

module.exports = driver;