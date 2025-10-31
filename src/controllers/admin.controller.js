const { listUsers, updateRole, deleteUser } = require('../models/User');

async function listAllUsers(req, res, next) {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (e) { next(e); }
}

async function changeUserRole(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;
    if (!['patient', 'doctor', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'نقش نامعتبر' });
    const user = await updateRole(id, role);
    res.json(user);
  } catch (e) { next(e); }
}

async function removeUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    await deleteUser(id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = {
  listAllUsers,
  changeUserRole,
  removeUser,
};

