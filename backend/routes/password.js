const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// ── SEND EMAIL HELPER ──
async function sendResetEmail(to, name, resetURL) {
  // Dev mode — just print to console
  if (!process.env.EMAIL_USER) {
    console.log('\n🔑 PASSWORD RESET LINK (dev mode):');
    console.log(resetURL + '\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: 'Reset Your NyumbaUG Password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#0a3622;padding:24px;text-align:center;">
          <h1 style="color:#d4a843;margin:0;">NyumbaUG</h1>
        </div>
        <div style="padding:32px;background:#fff;">
          <h2 style="color:#0a3622;">Reset Your Password</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your NyumbaUG password. Click the button below:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetURL}"
               style="background:#d4a843;color:#0a3622;padding:14px 32px;
                      text-decoration:none;border-radius:50px;font-weight:700;">
              Reset My Password
            </a>
          </div>
          <p style="font-size:0.85rem;color:#777;">This link expires in <strong>1 hour</strong>.</p>
          <p style="font-size:0.82rem;color:#777;">Or copy this link:<br/>${resetURL}</p>
          <p style="font-size:0.82rem;color:#aaa;">If you didn't request this, ignore this email — your account is safe.</p>
        </div>
        <div style="background:#f4f4f4;padding:16px;text-align:center;font-size:0.78rem;color:#888;">
          © 2025 NyumbaUG — Kampala, Uganda 🇺🇬
        </div>
      </div>
    `
  });
}

// ── FORGOT PASSWORD ──
router.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );

    // Always return success to prevent email enumeration
    if (!result.rows.length) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        token VARCHAR(100) NOT NULL,
        expires TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Delete old tokens for this user
    await pool.query('DELETE FROM password_reset WHERE user_id = $1', [user.id]);

    // Save new token
    await pool.query(
      'INSERT INTO password_reset (user_id, token, expires) VALUES ($1, $2, $3)',
      [user.id, token, expires]
    );

    const resetURL = `${process.env.CLIENT_URL || 'http://127.0.0.1:5501'}/pages/reset-password.html?token=${token}`;

    await sendResetEmail(user.email, user.name, resetURL);

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email.' });
  }
});

// ── RESET PASSWORD ──
router.post('/auth/reset-password', async (req, res) => {
  const { token, password: newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Token and password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  try {
    const result = await pool.query(
      `SELECT user_id FROM password_reset
       WHERE token = $1 AND used = FALSE AND expires > NOW()`,
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    const { user_id } = result.rows[0];
    const hash = await bcrypt.hash(newPassword, 12);

    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, user_id]);
    await pool.query('UPDATE password_reset SET used = TRUE WHERE token = $1', [token]);

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

module.exports = router;