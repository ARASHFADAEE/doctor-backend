const jwt = require('jsonwebtoken');
const { getById } = require('../models/User');

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

async function attachUser(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'توکن ارائه نشده' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ success: false, message: 'توکن نامعتبر' });
  req.tokenPayload = payload;
  if (payload.type === 'full') {
    const user = await getById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: 'کاربر یافت نشد' });
    req.user = user;
  } else if (payload.type === 'temp') {
    req.tempUserPhone = payload.phone;
  }
  next();
}

function requireFullAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'نیاز به ورود' });
  next();
}

function requireTempAuth(req, res, next) {
  if (!req.tempUserPhone) return res.status(401).json({ success: false, message: 'توکن موقت معتبر نیست' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز' });
    }
    next();
  };
}

module.exports = {
  attachUser,
  requireFullAuth,
  requireTempAuth,
  requireRole,
};

