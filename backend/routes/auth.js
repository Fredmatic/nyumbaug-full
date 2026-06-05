
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ---------------- REGISTER ----------------
router.post('/register', async (req, res) => {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        if (existing.rows.length) {
            return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
        }

        const hash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (name, email, phone, password, role, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, true, NOW())
             RETURNING id, name, email, phone, role`,
            [
                name.trim(),
                email.toLowerCase().trim(),
                phone || null,
                hash,
                role === 'landlord' ? 'landlord' : 'tenant'
            ]
        );

        const user = result.rows[0];

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            token,
            user
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
    }
});

// ---------------- LOGIN ----------------
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    try {
        const result = await pool.query(
            'SELECT id, name, email, phone, role, password, is_active FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Your account has been Suspended.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        const { password: _, ...safeUser } = user;

        res.json({
            success: true,
            message: 'Login successful.',
            token,
            user: safeUser
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
    }
});

// ---------------- GET ME ----------------
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Not authorized.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await pool.query(
            'SELECT id, name, email, phone, role, avatar_url, is_active FROM users WHERE id = $1  AND is_active = true',
            [decoded.id]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Account Suspended.' });
        }

        res.json({ success: true, user: result.rows[0] });

    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid token.' });
    }
});

// ---------------- CHANGE PASSWORD ----------------
router.patch('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Not authorized.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Both passwords are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
        }

        const result = await pool.query('SELECT password FROM users WHERE id = $1', [decoded.id]);
        const user = result.rows[0];

        if (!(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, decoded.id]);

        res.json({ success: true, message: 'Password changed successfully.' });

    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid token.' });
    }
});

// ---------------- UPDATE PROFILE ----------------
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
}).single('avatar');

router.patch('/update-profile', (req, res) => {
    uploadMiddleware(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });

        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ success: false, message: 'Not authorized.' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const { name, phone } = req.body;

            let avatarUrl = null;

            // Upload avatar to Cloudinary if file provided
            if (req.file) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: 'nyumbaug/avatars', transformation: [{ width: 200, height: 200, crop: 'fill' }] },
                        (error, result) => error ? reject(error) : resolve(result)
                    );
                    stream.end(req.file.buffer);
                });
                avatarUrl = result.secure_url;
            }

            const fields = [];
            const values = [];
            let idx = 1;

            if (name) { fields.push(`name = $${idx++}`); values.push(name); }
            if (phone) { fields.push(`phone = $${idx++}`); values.push(phone); }
            if (avatarUrl) { fields.push(`avatar_url = $${idx++}`); values.push(avatarUrl); }
            fields.push(`updated_at = NOW()`);
            values.push(decoded.id);

            const result = await pool.query(
                `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, phone, role, avatar_url`,
                values
            );

            res.json({ success: true, user: result.rows[0] });

        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Failed to update profile.' });
        }
    });
});
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

        const mailer = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
        });

        await mailer.sendMail({
            from: `"NyumbaUG" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔑 Reset your NyumbaUG password',
            html: `...same html...`
        });
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
                    This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.
                </p>
                <p style="color:#888;font-size:0.82rem;margin-top:12px;">
                    Or copy this link:<br />
                    <a href="${resetUrl}" style="color:#2d8a5e;word-break:break-all;">${resetUrl}</a>
                </p>
            </div>
            <div style="background:#f4f6f3;padding:16px;text-align:center;">
                <p style="color:#888;font-size:0.8rem;margin:0;">© 2025 NyumbaUG · Kampala, Uganda 🇺🇬</p>
            </div>
        </div>
        `
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
module.exports = router;