const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/error');

// Generate JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, phone, password, role } = req.body;

  // Only allow tenant or landlord roles from public registration
  const userRole = role === 'landlord' ? 'landlord' : 'tenant';

  const hash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO users (name, email, phone, password, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, phone, role, created_at`,
    [name, email, phone, hash, userRole]
  );

  const user = result.rows[0];
  const token = signToken(user.id);

  res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    token,
    user,
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide email and password.', 400);
  }

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase().trim()]
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Invalid email or password.', 401);
  }

  const token = signToken(user.id);

  // Don't send password
  const { password: _, ...safeUser } = user;

  res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    token,
    user: safeUser,
  });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, email, phone, role, avatar_url, is_verified, created_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  res.json({ success: true, user: result.rows[0] });
});

// PATCH /api/auth/update-profile
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const avatarUrl = req.file?.path;

  const fields = [];
  const values = [];
  let idx = 1;

  if (name)      { fields.push(`name = $${idx++}`);       values.push(name); }
  if (phone)     { fields.push(`phone = $${idx++}`);      values.push(phone); }
  if (avatarUrl) { fields.push(`avatar_url = $${idx++}`); values.push(avatarUrl); }

  if (!fields.length) {
    throw new AppError('No fields to update.', 400);
  }

  fields.push(`updated_at = NOW()`);
  values.push(req.user.id);

  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, phone, role, avatar_url`,
    values
  );

  res.json({ success: true, user: result.rows[0] });
});

// PATCH /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw new AppError('Current password is incorrect.', 400);
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

  res.json({ success: true, message: 'Password changed successfully.' });
});

module.exports = { register, login, getMe, updateProfile, changePassword };
