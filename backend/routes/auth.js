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

router.patch('/auth/update-profile', (req, res) => {
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
module.exports = router;