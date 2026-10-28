const jwt = require('jsonwebtoken');
const SECRET = 'customs-tracking-secret-2024-change-in-prod';

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role, displayName: user.display_name, accountCode: user.account_code }, SECRET, { expiresIn: '7d' });
}

module.exports = { auth, requireRole, signToken, SECRET };