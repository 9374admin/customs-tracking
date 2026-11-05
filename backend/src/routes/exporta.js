const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, EXPORT_STEP_NAMES, ensureExportSteps, logOperation } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'export');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 80 * 1024 * 1024 } });

async function getExportWithSteps(id) {
  const proc = await db.get(`SELECT e.*, u.display_name as created_by_name FROM export_processes e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`, [id]);
  if (!proc) return null;
  await ensureExportSteps(id);
  const steps = await db.all(`SELECT es.*, u.display_name as operated_by_name, u.account_code as operated_by_code FROM export_steps es LEFT JOIN users u ON es.operated_by = u.id WHERE es.process_id = ? ORDER BY es.id`, [id]);
  proc.steps = steps;
  return proc;
}

router.get('/', auth, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (e.bl LIKE ? OR e.cntr_number LIKE ? OR e.destino LIKE ? OR e.navio LIKE ? OR e.cliente LIKE ? OR CAST(e.seq_no AS TEXT) LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    const countRow = await db.get(`SELECT COUNT(*) as c FROM export_processes e WHERE ${where}`, params);
    let sql = `SELECT e.id, e.seq_no, e.bl, e.cntr_number, e.data_vazio, e.destino, e.navio, e.navegador, e.cliente, e.booking_date, e.terminal, e.fatura, e.partida_date, e.chegado_date, e.notes, e.created_at, e.updated_at FROM export_processes e WHERE ${where} ORDER BY e.seq_no ASC`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const rows = await db.all(sql, params);
    const result = [];
    for (const r of rows) {
      await ensureExportSteps(r.id);
      const steps = await db.all(`SELECT es.step_name, es.status, es.operated_at, es.operated_by, u.display_name as operated_by_name, u.account_code as operated_by_code FROM export_steps es LEFT JOIN users u ON es.operated_by = u.id WHERE es.process_id = ?`, [r.id]);
      r.steps = steps;
      result.push(r);
    }
    res.json({ data: result, total: Number(countRow.c), page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  const proc = await getExportWithSteps(parseInt(req.params.id));
  if (!proc) return res.status(404).json({ error: 'Processo não encontrado' });
  res.json(proc);
});

router.post('/', auth, async (req, res) => {
  try {
    const { bl, cntr_number, data_vazio, destino, navio, navegador, cliente, booking_date, terminal, fatura, partida_date, chegado_date } = req.body;
    const maxSeq = await db.get('SELECT MAX(seq_no) as m FROM export_processes');
    const seqNo = (maxSeq && maxSeq.m != null) ? maxSeq.m + 1 : 1;
    const result = await db.run(
      `INSERT INTO export_processes (seq_no, bl, cntr_number, data_vazio, destino, navio, navegador, cliente, booking_date, terminal, fatura, partida_date, chegado_date, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [seqNo, bl||'', cntr_number||'', data_vazio||'', destino||'', navio||'', navegador||'', cliente||'', booking_date||'', terminal||'', fatura||'', partida_date||'', chegado_date||'', req.user.id, req.user.id]
    );
    const newId = result.lastInsertRowid;
    await ensureExportSteps(newId);
    await logOperation(req.user.id, 'create', 'export_process', newId, `Created export process ${seqNo}`);
    const proc = await getExportWithSteps(newId);
    const io = req.app.get('io');
    if (io) io.emit('export:created', proc);
    res.json(proc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const fields = ['bl', 'cntr_number', 'data_vazio', 'destino', 'navio', 'navegador', 'cliente', 'booking_date', 'terminal', 'fatura', 'partida_date', 'chegado_date', 'notes'];
    const updates = {};
    for (const f of fields) {
      if (req.body.hasOwnProperty(f)) updates[f] = req.body[f];
    }
    const setClauses = Object.keys(updates).map(k => `${k} = ?`);
    const values = Object.values(updates);
    if (setClauses.length > 0) {
      values.push(req.user.id, id);
      await db.run(`UPDATE export_processes SET ${setClauses.join(', ')}, updated_at = ${db.isPostgres ? 'NOW()' : 'datetime(\'now\')'}, updated_by = ? WHERE id = ?`, values);
      await logOperation(req.user.id, 'update', 'export_process', id, JSON.stringify(updates));
    }
    const proc = await getExportWithSteps(id);
    res.json(proc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/step/:step', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const step = req.params.step;
    const { status } = req.body;
    const existing = await db.get('SELECT * FROM export_steps WHERE process_id = ? AND step_name = ?', [id, step]);
    if (existing) {
      await db.run(`UPDATE export_steps SET status = ?, operated_by = ?, operated_at = ${db.isPostgres ? 'NOW()' : 'datetime(\'now\')'} WHERE process_id = ? AND step_name = ?`, [status, req.user.id, id, step]);
    } else {
      await db.run(`INSERT INTO export_steps (process_id, step_name, status, operated_by, operated_at) VALUES (?, ?, ?, ?, ${db.isPostgres ? 'NOW()' : 'datetime(\'now\')'})`, [id, step, status, req.user.id]);
    }
    await db.run(`UPDATE export_processes SET updated_at = ${db.isPostgres ? 'NOW()' : 'datetime(\'now\')'}, updated_by = ? WHERE id = ?`, [req.user.id, id]);
    await logOperation(req.user.id, 'step_update', 'export_process', id, `${step} -> ${status}`);
    const proc = await getExportWithSteps(id);
    res.json(proc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.run('DELETE FROM export_steps WHERE process_id = ?', [id]);
    await db.run('DELETE FROM export_files WHERE process_id = ?', [id]);
    await db.run('DELETE FROM export_processes WHERE id = ?', [id]);
    await logOperation(req.user.id, 'delete', 'export_process', id, 'Deleted export process');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
    for (const id of ids) {
      await db.run('DELETE FROM export_steps WHERE process_id = ?', [id]);
      await db.run('DELETE FROM export_files WHERE process_id = ?', [id]);
      await db.run('DELETE FROM export_processes WHERE id = ?', [id]);
    }
    await logOperation(req.user.id, 'batch_delete', 'export_process', null, `Deleted ${ids.length} export processes`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/files/:step', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const step = req.params.step;
    const files = await db.all('SELECT * FROM export_files WHERE process_id = ? AND step_name = ? ORDER BY uploaded_at DESC', [id, step]);
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/files/:step', auth, upload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const step = req.params.step;
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const fileUrl = `/uploads/export/${req.file.filename}`;
    const result = await db.run(
      'INSERT INTO export_files (process_id, step_name, file_url, file_name, file_size, uploaded_by) VALUES (?,?,?,?,?,?)',
      [id, step, fileUrl, req.file.originalname, req.file.size, req.user.id]
    );
    await logOperation(req.user.id, 'file_upload', 'export_process', id, `${step}: ${req.file.originalname}`);
    res.json({ id: result.lastInsertRowid, file_url: fileUrl, file_name: req.file.originalname, file_size: req.file.size });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/files/:fileId', auth, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const file = await db.get('SELECT * FROM export_files WHERE id = ?', [fileId]);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const filePath = path.join(__dirname, '..', '..', 'uploads', 'export', path.basename(file.file_url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.run('DELETE FROM export_files WHERE id = ?', [fileId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;