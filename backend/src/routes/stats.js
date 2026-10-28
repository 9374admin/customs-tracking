const express = require('express');
const { db, STEP_NAMES } = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const STEP_LABELS = {
  licenca_aprovacao: 'Licença/Aprovação', du: 'DU', talex: 'Talex', transporte: 'Transporte',
  nota: 'NOTA', legalizacao: 'Legalização', delivery: 'Delivery', inspecao: 'Inspeção',
  detencao: 'Detenção', sobrestadia: 'Sobrestadia', porto: 'Porto', terminal: 'Terminal', entregue: 'Entregue'
};

router.get('/', auth, async (req, res) => {
  try {
    const totalRow = await db.get('SELECT COUNT(*) as c FROM processes');
    const totalProcesses = Number(totalRow.c);
    const stepStats = [];
    for (const name of STEP_NAMES) {
      const stats = await db.get(`
        SELECT
          SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as concluido,
          SUM(CASE WHEN status = 'em_curso' THEN 1 ELSE 0 END) as em_curso,
          SUM(CASE WHEN status = 'selecionar' THEN 1 ELSE 0 END) as selecionar
        FROM process_steps WHERE step_name = ?
      `, [name]);
      stepStats.push({
        step: name,
        label: STEP_LABELS[name],
        concluido: Number(stats.concluido) || 0,
        em_curso: Number(stats.em_curso) || 0,
        selecionar: Number(stats.selecionar) || 0
      });
    }
    const recentProcesses = await db.all(`
      SELECT p.id, p.seq_no, p.empresa, p.bl_number, p.updated_at, u.display_name as updated_by_name
      FROM processes p LEFT JOIN users u ON p.updated_by = u.id
      ORDER BY p.updated_at DESC LIMIT 10
    `);
    const todayRow = await db.get(`SELECT COUNT(*) as c FROM processes WHERE date(updated_at) = date('now')`);
    const empresaStats = await db.all(`
      SELECT empresa, COUNT(*) as count FROM processes WHERE empresa != '' GROUP BY empresa ORDER BY count DESC LIMIT 10
    `);
    res.json({ totalProcesses, stepStats, recentProcesses, todayCount: Number(todayRow.c), empresaStats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
