const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Verify JWT and attach user to request
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT id, name, email, phone, role, avatar_url, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// Restrict to specific roles
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Requires role: ${roles.join(' or ')}.`
    });
  }
  next();
};

// Optional auth — attaches user if token present but doesn't block
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = $1 AND is_active = true',
        [decoded.id]
      );
      if (result.rows.length) req.user = result.rows[0];
    }
  } catch (_) { }
  next();
};
const authorizeRole = (requiredRole) => {
  return (req, res, next) => {
    // Assuming user role is attached to req.user after authentication
    if (req.user && req.user.role === requiredRole) {
      next(); // User is a landlord, proceed
    } else {
      res.status(403).json({ success: false, message: 'Access Denied: Landlord only.' });
    }
  };
};

const crypto = require('crypto');
const nodemailer = require('nodemailer');

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── POST /api/auth/forgot-password ──
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);

    // Always return success even if email not found (security best practice)
    if (!result.rows.length) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const user = result.rows[0];

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );

    const resetUrl = `https://nyumbaug-full.vercel.app/pages/reset-password.html?token=${token}`;

    await mailer.sendMail({
      from: `"NyumbaUG" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔑 Reset your NyumbaUG password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0e3d2c;padding:24px;text-align:center;">
            <h1 style="color:#d4a91e;margin:0;font-size:1.8rem;">NyumbaUG</h1>
          </div>
          <div style="padding:32px;background:#ffffff;">
            <h2 style="color:#0e3d2c;">Hello ${user.name},</h2>
            <p style="color:#444;line-height:1.7;">
              We received a request to reset your password. Click the button below to set a new password.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}" 
                 style="background:#0e3d2c;color:#d4a91e;padding:14px 32px;border-radius:8px;
                        text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">
                Reset My Password
              </a>
            </div>
            <p style="color:#888;font-size:0.85rem;">
              This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email — your password won't change.
            </p>
            <p style="color:#888;font-size:0.82rem;margin-top:12px;">
              Or copy this link: <br/>
              <a href="${resetUrl}" style="color:#2d8a5e;word-break:break-all;">${resetUrl}</a>
            </p>
          </div>
          <div style="background:#f4f6f3;padding:16px;text-align:center;">
            <p style="color:#888;font-size:0.8rem;margin:0;">© 2025 NyumbaUG · Kampala, Uganda 🇺🇬</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true, message: 'Reset link sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again.' });
  }
});

// ── POST /api/auth/reset-password ──
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // Find user with valid non-expired token
    const result = await pool.query(
      'SELECT id, name FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    const user = result.rows[0];
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);

    // Update password and clear token
    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hash, user.id]
    );

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

module.exports = { protect, authorize, optionalAuth };
