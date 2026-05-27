const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const pool = require('../config/db');

router.get('/admin/users', protect, authorize('admin'), async (req, res) => {
    const result = await pool.query('SELECT id, name, email, phone, role, is_active, is_verified, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, users: result.rows });
});

router.patch('/admin/users/:id/role', protect, authorize('admin'), async (req, res) => {
    const { role } = req.body;
    if (!['tenant', 'landlord', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });
    const result = await pool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, role', [role, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: result.rows[0] });
});

router.patch('/admin/users/:id/toggle', protect, authorize('admin'), async (req, res) => {
    const { is_active } = req.body;
    const result = await pool.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_active', [is_active, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: result.rows[0] });
});

router.patch('/admin/listings/:id/approve', protect, authorize('admin'), async (req, res) => {
    const result = await pool.query("UPDATE listings SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, listing: result.rows[0] });
});

router.get('/admin/listings', protect, authorize('admin'), async (req, res) => {
    const { status = 'pending' } = req.query;
    const result = await pool.query('SELECT l.*, u.name AS landlord_name, u.phone AS landlord_phone FROM listings l JOIN users u ON l.landlord_id = u.id WHERE l.status = $1 ORDER BY l.created_at DESC', [status]);
    res.json({ success: true, listings: result.rows });
});

router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
    const [users, listingsCount, enquiries] = await Promise.all([
        pool.query('SELECT role, COUNT(*) FROM users GROUP BY role'),
        pool.query('SELECT status, COUNT(*) FROM listings GROUP BY status'),
        pool.query("SELECT COUNT(*) FROM enquiries WHERE created_at > NOW() - INTERVAL '7 days'"),
    ]);
    res.json({ success: true, stats: { users: users.rows, listings: listingsCount.rows, enquiries_this_week: parseInt(enquiries.rows[0].count) } });
});

module.exports = router;