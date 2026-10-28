const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/messages', auth, async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    let sql = `SELECT m.*, s.display_name as sender_name, s.account_code as sender_code FROM chat_messages m JOIN users s ON m.sender_id = s.id WHERE m.is_group = 1`;
    const params = [];
    if (before) { sql += ` AND m.id < ?`; params.push(before); }
    sql += ` ORDER BY m.id DESC LIMIT ?`;
    params.push(parseInt(limit));
    const rows = await db.all(sql, params);
    res.json(rows.reverse());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/messages', auth, upload.single('file'), async (req, res) => {
  try {
    const { content, mentioned_users } = req.body;
    const file_url = req.file ? `/uploads/${req.file.filename}` : null;
    const file_name = req.file ? req.file.originalname : null;
    const file_size = req.file ? req.file.size : null;
    const info = await db.run(
      `INSERT INTO chat_messages (sender_id, is_group, content, file_url, file_name, file_size, mentioned_users) VALUES (?, 1, ?, ?, ?, ?, ?)`,
      [req.user.id, content || '', file_url, file_name, file_size, mentioned_users || '']
    );
    const msg = await db.get(`SELECT m.*, s.display_name as sender_name, s.account_code as sender_code FROM chat_messages m JOIN users s ON m.sender_id = s.id WHERE m.id = ?`, [info.lastInsertRowid]);
    req.app.get('io')?.emit('chat:message', msg);
    if (mentioned_users) {
      const ids = JSON.parse(mentioned_users);
      for (const uid of ids) {
        await db.run(`INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, 'mention', 'Você foi mencionado', ?, ?)`, [uid, `${req.user.displayName} mencionou você no chat`, msg.id]);
        req.app.get('io')?.to(`user:${uid}`).emit('notification:new', { title: 'Você foi mencionado', content: `${req.user.displayName} mencionou você no chat` });
      }
    }
    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/notifications', auth, async (req, res) => {
  const rows = await db.all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
  res.json(rows);
});

router.put('/notifications/:id/read', auth, async (req, res) => {
  await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.put('/notifications/read-all', auth, async (req, res) => {
  await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
