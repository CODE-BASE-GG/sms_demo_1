const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { writeLog } = require('../utils/audit');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const ROLES = {
  Teacher: { table: 'Teacher', pk: 'TeacherID' },
  Admin: { table: 'Admin', pk: 'AdminID' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanRole(role) {
  if (!role) return null;
  const match = Object.keys(ROLES).find(
    (key) => key.toLowerCase() === String(role).toLowerCase(),
  );
  return match || null;
}

function publicUser(row, role) {
  return {
    id: row[ROLES[role].pk],
    name: row.Name,
    email: row.Email,
    role,
  };
}

router.get(
  '/bootstrap-status',
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM `Admin`');
    res.json({ adminExists: Number(row.total) > 0 });
  }),
);

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role ? cleanRole(req.body.role) : 'Teacher';

    if (!name) throw httpError(400, 'Name is required.');
    if (name.length > 100) throw httpError(400, 'Name must be 100 characters or fewer.');
    if (!EMAIL_RE.test(email)) throw httpError(400, 'Enter a valid email address.');
    if (email.length > 100) throw httpError(400, 'Email must be 100 characters or fewer.');
    if (!role) throw httpError(400, 'Choose either the Teacher or Admin role.');
    if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters.');
    if (password.length > 72) throw httpError(400, 'Password must be 72 characters or fewer.');

    if (role === 'Admin') {
      const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM `Admin`');
      if (Number(row.total) > 0) {
        throw httpError(
          403,
          'Administrator accounts are created by an existing administrator. Please register as a teacher or ask an admin for access.',
        );
      }
    }

    const { table, pk } = ROLES[role];

    const [existing] = await pool.query(
      `SELECT \`${pk}\` FROM \`${table}\` WHERE \`Email\` = ? LIMIT 1`,
      [email],
    );

    if (existing.length > 0) {
      throw httpError(409, 'An account with this email already exists.');
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO \`${table}\` (\`Name\`, \`Email\`, \`Password\`) VALUES (?, ?, ?)`,
      [name, email, hash],
    );

    const user = { id: result.insertId, name, email, role };

    await writeLog({
      actor: user,
      reason: `${name} registered a new ${role} account`,
      actionType: 'CREATE',
      affectedTable: table,
      affectedRecordId: result.insertId,
      status: 'Approved',
    });

    res.status(201).json({
      token: signToken(user),
      user,
    });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const requestedRole = cleanRole(req.body.role);

    if (!EMAIL_RE.test(email) || !password) {
      throw httpError(400, 'Enter your email and password.');
    }

    const rolesToTry = requestedRole ? [requestedRole] : ['Teacher', 'Admin'];
    let account = null;
    let matchedRole = null;

    for (const role of rolesToTry) {
      const { table, pk } = ROLES[role];
      const [rows] = await pool.query(
        `SELECT \`${pk}\`, \`Name\`, \`Email\`, \`Password\` FROM \`${table}\` WHERE \`Email\` = ? LIMIT 1`,
        [email],
      );

      if (rows.length > 0) {
        account = rows[0];
        matchedRole = role;
        break;
      }
    }

    if (!account) {
      throw httpError(401, 'Invalid email or password.');
    }

    const valid = await bcrypt.compare(password, account.Password);
    if (!valid) {
      throw httpError(401, 'Invalid email or password.');
    }

    const user = publicUser(account, matchedRole);

    res.json({
      token: signToken(user),
      user,
    });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const role = cleanRole(req.user.role);
    if (!role) throw httpError(401, 'Your session is invalid. Please log in again.');

    const { table, pk } = ROLES[role];
    const [rows] = await pool.query(
      `SELECT \`${pk}\`, \`Name\`, \`Email\` FROM \`${table}\` WHERE \`${pk}\` = ? LIMIT 1`,
      [req.user.id],
    );

    if (rows.length === 0) {
      throw httpError(401, 'Your account no longer exists.');
    }

    res.json({ user: publicUser(rows[0], role) });
  }),
);

module.exports = router;
