const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 100, user_id, action } = req.query;
    let where = '1=1';
    const params = [];
    if (user_id) { where += ' AND l.user_id = ?'; params.push(user_id); }
    if (action) { where += ' AND l.action = ?'; params.push(action); }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const rows = await db.all(`
      SELECT l.*, u.display_name as user_name, u.account_code as user_code
      FROM operation_logs l LEFT JOIN users u ON l.user_id = u.id
      WHERE ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    const countRow = await db.get(`SELECT COUNT(*) as c FROM operation_logs l WHERE ${where}`, params);
    res.json({ data: rows, total: Number(countRow.c), page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
