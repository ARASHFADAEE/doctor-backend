const { getById, updateUser } = require('../models/User');

async function getMe(req, res, next) {
  try {
    const user = req.user;
    return res.json({ id: user.id, phone: user.phone, name: user.name, national_id: user.national_id, age: user.age, role: user.role });
  } catch (e) { next(e); }
}

async function updateMe(req, res, next) {
  try {
    const { name, age } = req.body;
    const user = await updateUser(req.user.id, { name, age });
    return res.json({ id: user.id, phone: user.phone, name: user.name, national_id: user.national_id, age: user.age, role: user.role });
  } catch (e) { next(e); }
}

module.exports = {
  getMe,
  updateMe,
};

