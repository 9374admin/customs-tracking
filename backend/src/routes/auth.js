const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { auth, requireRole, signToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
    if (!user) return res.status(401).json({ error: 'Utilizador não encontrado' });
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Palavra-passe incorreta' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, account_code: user.account_code }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', auth, async (req, res) => {
  const user = await db.get('SELECT id, username, display_name, role, account_code FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

router.get('/', auth, requireRole('admin'), async (req, res) => {
  const users = await db.all('SELECT id, username, display_name, role, account_code, is_active, created_at FROM users ORDER BY id');
  res.json(users);
});

router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, display_name, role, account_code } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const info = await db.run(
      'INSERT INTO users (username, password_hash, display_name, role, account_code) VALUES (?,?,?,?,?)',
      [username, hash, display_name, role || 'operator', account_code]
    );
    res.json({ id: info.lastInsertRowid, username, display_name, role, account_code });
  } catch (e) {
    res.status(400).json({ error: 'Utilizador ou código de conta já existe' });
  }
});

router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { display_name, role, account_code, is_active, password } = req.body;
    const fields = [];
    const vals = [];
    if (display_name !== undefined) { fields.push('display_name = ?'); vals.push(display_name); }
    if (role !== undefined) { fields.push('role = ?'); vals.push(role); }
    if (account_code !== undefined) { fields.push('account_code = ?'); vals.push(account_code); }
    if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
    if (password) { fields.push('password_hash = ?'); vals.push(bcrypt.hashSync(password, 10)); }
    if (fields.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Não pode eliminar a si mesmo' });
  if (req.query.hard === 'true') {
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  } else {
    await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
  }
  res.json({ ok: true });
});

module.exports = router;
