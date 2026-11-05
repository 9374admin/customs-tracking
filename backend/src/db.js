const bcrypt = require('bcryptjs');
const driver = require('./db-driver');

const STEP_NAMES = [
  'talex', 'transporte', 'licenca_aprovacao', 'cnca', 'legalizacao', 'delivery',
  'du', 'nota_cnca', 'recibo', 'inspecao', 'detencao',
  'sobrestadia', 'porto', 'terminal', 'entregue'
];

const EXPORT_STEP_NAMES = [
  'ctt', 'draft', 'vgm', 'draft_final',
  'estado_ctt', 'estado_selo', 'entrada_terminal', 'frete', 'fecho'
];

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    account_code TEXT UNIQUE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seq_no INTEGER,
    empresa TEXT,
    bl_number TEXT,
    container_number TEXT,
    prevista_date TEXT,
    fee_status TEXT DEFAULT '',
    fecho TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by INTEGER REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS step_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS process_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'selecionar',
    operated_by INTEGER REFERENCES users(id),
    operated_at TEXT,
    note TEXT DEFAULT '',
    UNIQUE(process_id, step_name)
  );
  CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    detail TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER REFERENCES users(id),
    is_group INTEGER NOT NULL DEFAULT 1,
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    mentioned_users TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    related_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS export_processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seq_no INTEGER,
    bl TEXT DEFAULT '',
    booking_text TEXT DEFAULT '',
    cntr_number TEXT DEFAULT '',
    data_vazio TEXT DEFAULT '',
    destino TEXT DEFAULT '',
    navio TEXT DEFAULT '',
    navegador TEXT DEFAULT '',
    cliente TEXT DEFAULT '',
    booking_date TEXT DEFAULT '',
    terminal TEXT DEFAULT '',
    fatura TEXT DEFAULT '',
    partida_date TEXT DEFAULT '',
    chegado_date TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by INTEGER REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS export_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL REFERENCES export_processes(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'selecionar',
    operated_by INTEGER REFERENCES users(id),
    operated_at TEXT,
    note TEXT DEFAULT '',
    UNIQUE(process_id, step_name)
  );
  CREATE TABLE IF NOT EXISTS export_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL REFERENCES export_processes(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    account_code TEXT UNIQUE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS processes (
    id SERIAL PRIMARY KEY,
    seq_no INTEGER,
    empresa TEXT,
    bl_number TEXT,
    container_number TEXT,
    prevista_date TEXT,
    fee_status TEXT DEFAULT '',
    fecho TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS step_files (
    id SERIAL PRIMARY KEY,
    process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TEXT NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS process_steps (
    id SERIAL PRIMARY KEY,
    process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'selecionar',
    operated_by INTEGER REFERENCES users(id),
    operated_at TEXT,
    note TEXT DEFAULT '',
    UNIQUE(process_id, step_name)
  );
  CREATE TABLE IF NOT EXISTS operation_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    detail TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER REFERENCES users(id),
    is_group INTEGER NOT NULL DEFAULT 1,
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    mentioned_users TEXT,
    created_at TEXT NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    related_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS export_processes (
    id SERIAL PRIMARY KEY,
    seq_no INTEGER,
    bl TEXT DEFAULT '',
    booking_text TEXT DEFAULT '',
    cntr_number TEXT DEFAULT '',
    data_vazio TEXT DEFAULT '',
    destino TEXT DEFAULT '',
    navio TEXT DEFAULT '',
    navegador TEXT DEFAULT '',
    cliente TEXT DEFAULT '',
    booking_date TEXT DEFAULT '',
    terminal TEXT DEFAULT '',
    fatura TEXT DEFAULT '',
    partida_date TEXT DEFAULT '',
    chegado_date TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS export_steps (
    id SERIAL PRIMARY KEY,
    process_id INTEGER NOT NULL REFERENCES export_processes(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'selecionar',
    operated_by INTEGER REFERENCES users(id),
    operated_at TEXT,
    note TEXT DEFAULT '',
    UNIQUE(process_id, step_name)
  );
  CREATE TABLE IF NOT EXISTS export_files (
    id SERIAL PRIMARY KEY,
    process_id INTEGER NOT NULL REFERENCES export_processes(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TEXT NOT NULL DEFAULT NOW()
  );
`;

async function initDB() {
  const schema = driver.isPostgres ? PG_SCHEMA : SQLITE_SCHEMA;
  const statements = schema.trim().split(';').filter(s => s.trim());
  for (const stmt of statements) {
    await driver.exec(stmt + ';');
  }

  const adminExists = await driver.get('SELECT COUNT(*) as c FROM users WHERE role = ?', ['admin']);
  if (Number(adminExists.c) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await driver.run(
      'INSERT INTO users (username, password_hash, display_name, role, account_code) VALUES (?,?,?,?,?)',
      ['admin', hash, 'Administrador', 'admin', 'ADM001']
    );
  }

  const cols = await driver.tableInfo('processes');
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('fee_status')) {
    await driver.exec('ALTER TABLE processes ADD COLUMN fee_status TEXT DEFAULT \'\'');
  }
  if (!colNames.includes('du_number')) {
    await driver.exec('ALTER TABLE processes ADD COLUMN du_number TEXT DEFAULT \'\'');
  }
  if (!colNames.includes('fee_amount')) {
    await driver.exec('ALTER TABLE processes ADD COLUMN fee_amount TEXT DEFAULT \'\'');
  }
  if (!colNames.includes('fecho')) {
    await driver.exec('ALTER TABLE processes ADD COLUMN fecho TEXT DEFAULT \'\'');
  }

  const exportCols = await driver.tableInfo('export_processes');
  const exportColNames = exportCols.map(c => c.name);
  if (!exportColNames.includes('partida_date')) {
    await driver.exec('ALTER TABLE export_processes ADD COLUMN partida_date TEXT DEFAULT \'\'');
  }
  if (!exportColNames.includes('chegado_date')) {
    await driver.exec('ALTER TABLE export_processes ADD COLUMN chegado_date TEXT DEFAULT \'\'');
  }
  if (!exportColNames.includes('booking_text')) {
    await driver.exec('ALTER TABLE export_processes ADD COLUMN booking_text TEXT DEFAULT \'\'');
  }
}

async function ensureSteps(processId) {
  for (const name of STEP_NAMES) {
    if (driver.isPostgres) {
      await driver.run(
        'INSERT INTO process_steps (process_id, step_name, status) VALUES (?, ?, \'selecionar\') ON CONFLICT DO NOTHING',
        [processId, name]
      );
    } else {
      await driver.run(
        'INSERT OR IGNORE INTO process_steps (process_id, step_name, status) VALUES (?, ?, \'selecionar\')',
        [processId, name]
      );
    }
  }
}

async function ensureExportSteps(processId) {
  for (const name of EXPORT_STEP_NAMES) {
    if (driver.isPostgres) {
      await driver.run(
        'INSERT INTO export_steps (process_id, step_name, status) VALUES (?, ?, \'selecionar\') ON CONFLICT DO NOTHING',
        [processId, name]
      );
    } else {
      await driver.run(
        'INSERT OR IGNORE INTO export_steps (process_id, step_name, status) VALUES (?, ?, \'selecionar\')',
        [processId, name]
      );
    }
  }
}

async function logOperation(userId, action, entityType, entityId, detail, oldValue, newValue) {
  await driver.run(
    'INSERT INTO operation_logs (user_id, action, entity_type, entity_id, detail, old_value, new_value) VALUES (?,?,?,?,?,?,?)',
    [userId, action, entityType, entityId || null, detail || null, oldValue || null, newValue || null]
  );
}

module.exports = { db: driver, initDB, STEP_NAMES, EXPORT_STEP_NAMES, ensureSteps, ensureExportSteps, logOperation };
