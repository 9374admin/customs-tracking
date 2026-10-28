const express = require('express');
const { db, STEP_NAMES, ensureSteps, logOperation } = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const STEP_LABELS = {
  licenca_aprovacao: 'Licença/Aprovação', du: 'DU', talex: 'Talex', transporte: 'Transporte',
  nota: 'NOTA', legalizacao: 'Legalização', delivery: 'Delivery', inspecao: 'Inspeção',
  detencao: 'Detenção', sobrestadia: 'Sobrestadia', porto: 'Porto', terminal: 'Terminal', entregue: 'Entregue'
};

async function getProcessWithSteps(id) {
  const proc = await db.get(`SELECT p.*, u.display_name as created_by_name FROM processes p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?`, [id]);
  if (!proc) return null;
  await ensureSteps(id);
  const steps = await db.all(`SELECT ps.*, u.display_name as operated_by_name, u.account_code as operated_by_code FROM process_steps ps LEFT JOIN users u ON ps.operated_by = u.id WHERE ps.process_id = ? ORDER BY ps.id`, [id]);
  proc.steps = steps;
  return proc;
}

router.get('/', auth, async (req, res) => {
  try {
    const { search, status, empresa, page = 1, limit = 50 } = req.query;
    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (p.empresa LIKE ? OR p.bl_number LIKE ? OR p.container_number LIKE ? OR CAST(p.seq_no AS TEXT) LIKE ? OR p.du_number LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (empresa) { where += ' AND p.empresa = ?'; params.push(empresa); }
    const countRow = await db.get(`SELECT COUNT(*) as c FROM processes p WHERE ${where}`, params);
    let sql = `SELECT p.id, p.seq_no, p.empresa, p.bl_number, p.container_number, p.prevista_date, p.fee_status, p.fee_amount, p.du_number, p.notes, p.created_at, p.updated_at FROM processes p WHERE ${where} ORDER BY p.updated_at DESC`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const rows = await db.all(sql, params);
    const result = [];
    for (const r of rows) {
      await ensureSteps(r.id);
      const steps = await db.all(`SELECT ps.step_name, ps.status, ps.operated_at, ps.operated_by, u.account_code as operated_code FROM process_steps ps LEFT JOIN users u ON ps.operated_by = u.id WHERE ps.process_id = ?`, [r.id]);
      r.steps = steps;
      result.push(r);
    }
    res.json({ data: result, total: Number(countRow.c), page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/empresas', auth, async (req, res) => {
  const rows = await db.all(`SELECT DISTINCT empresa FROM processes WHERE empresa IS NOT NULL AND empresa != '' ORDER BY empresa`);
  res.json(rows.map(r => r.empresa));
});

router.get('/:id', auth, async (req, res) => {
  const proc = await getProcessWithSteps(parseInt(req.params.id));
  if (!proc) return res.status(404).json({ error: 'Processo não encontrado' });
  res.json(proc);
});

router.post('/', auth, async (req, res) => {
  try {
    const { empresa, bl_number, container_number, prevista_date, fee_status, fee_amount, du_number, notes } = req.body;
    const maxSeq = await db.get('SELECT MAX(seq_no) as m FROM processes');
    const seqNo = (maxSeq.m || 0) + 1;
    const info = await db.run(
      `INSERT INTO processes (seq_no, empresa, bl_number, container_number, prevista_date, fee_status, fee_amount, du_number, notes, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [seqNo, empresa || '', bl_number || '', container_number || '', prevista_date || '', fee_status || '', fee_amount || '', du_number || '', notes || '', req.user.id, req.user.id]
    );
    await ensureSteps(info.lastInsertRowid);
    await logOperation(req.user.id, 'create', 'process', info.lastInsertRowid, `Criou processo ${seqNo} - ${empresa || ''}`);
    const proc = await getProcessWithSteps(info.lastInsertRowid);
    req.app.get('io')?.emit('process:created', proc);
    res.json(proc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = await db.get('SELECT * FROM processes WHERE id = ?', [id]);
    if (!old) return res.status(404).json({ error: 'Processo não encontrado' });
    const { empresa, bl_number, container_number, prevista_date, fee_status, fee_amount, du_number, notes } = req.body;
    const updates = {};
    if (empresa !== undefined) updates.empresa = empresa;
    if (bl_number !== undefined) updates.bl_number = bl_number;
    if (container_number !== undefined) updates.container_number = container_number;
    if (prevista_date !== undefined) updates.prevista_date = prevista_date;
    if (fee_status !== undefined) updates.fee_status = fee_status;
    if (fee_amount !== undefined) updates.fee_amount = fee_amount;
    if (du_number !== undefined) updates.du_number = du_number;
    if (notes !== undefined) updates.notes = notes;
    const setClauses = Object.keys(updates).map(k => `${k} = ?`);
    const vals = Object.values(updates);
    if (setClauses.length > 0) {
      setClauses.push("updated_at = datetime('now')");
      setClauses.push('updated_by = ?');
      vals.push(req.user.id);
      vals.push(id);
      await db.run(`UPDATE processes SET ${setClauses.join(', ')} WHERE id = ?`, vals);
      for (const [k, v] of Object.entries(updates)) {
        if (old[k] !== v) {
          await logOperation(req.user.id, 'update', 'process', id, `Campo ${k}`, String(old[k]), String(v));
        }
      }
    }
    const proc = await getProcessWithSteps(id);
    req.app.get('io')?.emit('process:updated', proc);
    res.json(proc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/steps/:stepName', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const stepName = req.params.stepName;
    if (!STEP_NAMES.includes(stepName)) return res.status(400).json({ error: 'Etapa inválida' });
    const { status, note } = req.body;
    const old = await db.get('SELECT * FROM process_steps WHERE process_id = ? AND step_name = ?', [id, stepName]);
    await ensureSteps(id);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await db.run(
      `INSERT INTO process_steps (process_id, step_name, status, operated_by, operated_at, note) VALUES (?,?,?,?,?,?) ON CONFLICT(process_id, step_name) DO UPDATE SET status=excluded.status, operated_by=excluded.operated_by, operated_at=excluded.operated_at, note=excluded.note`,
      [id, stepName, status, req.user.id, now, note || '']
    );
    await db.run(`UPDATE processes SET updated_at = datetime('now'), updated_by = ? WHERE id = ?`, [req.user.id, id]);
    const label = STEP_LABELS[stepName] || stepName;
    await logOperation(req.user.id, 'step_update', 'process_step', id, `${label}: ${old?.status || 'selecionar'} → ${status}`, old?.status, status);
    const step = await db.get(`SELECT ps.*, u.display_name as operated_by_name, u.account_code as operated_by_code FROM process_steps ps LEFT JOIN users u ON ps.operated_by = u.id WHERE ps.process_id = ? AND ps.step_name = ?`, [id, stepName]);
    req.app.get('io')?.emit('step:updated', { processId: id, step });
    if (status === 'concluido') {
      const users = await db.all('SELECT id FROM users WHERE is_active = 1');
      const title = `Etapa concluída: ${label}`;
      const content = `Processo #${id} - ${label} marcado como concluído por ${req.user.displayName}`;
      for (const u of users) {
        if (u.id !== req.user.id) {
          await db.run(`INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, 'step', ?, ?, ?)`, [u.id, title, content, id]);
        }
      }
      req.app.get('io')?.emit('notification:new', { title, content, relatedId: id });
    }
    res.json(step);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const proc = await db.get('SELECT * FROM processes WHERE id = ?', [id]);
    if (!proc) return res.status(404).json({ error: 'Processo não encontrado' });
    await db.run('DELETE FROM processes WHERE id = ?', [id]);
    await logOperation(req.user.id, 'delete', 'process', id, `Eliminou processo ${proc.seq_no} - ${proc.empresa || ''}`);
    req.app.get('io')?.emit('process:deleted', { id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
