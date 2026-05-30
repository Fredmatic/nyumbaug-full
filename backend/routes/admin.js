const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const pool = require('../config/db');

router.get('/users', protect, authorize('admin'), async (req, res) => {
    const result = await pool.query('SELECT id, name, email, phone, role, is_active, is_verified, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, users: result.rows });
});

router.patch('/users/:id/role', protect, authorize('admin'), async (req, res) => {
    const { role } = req.body;
    if (!['tenant', 'landlord', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });
    const result = await pool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, role', [role, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: result.rows[0] });
});

router.patch('/users/:id/toggle', protect, authorize('admin'), async (req, res) => {
    const { is_active } = req.body;
    const result = await pool.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_active', [is_active, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: result.rows[0] });
});

router.patch('/listings/:id/approve', protect, authorize('admin'), async (req, res) => {
    const result = await pool.query("UPDATE listings SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, listing: result.rows[0] });
});

router.get('/listings', protect, authorize('admin'), async (req, res) => {
    const { status = 'pending' } = req.query;
    const result = await pool.query('SELECT l.*, u.name AS landlord_name, u.phone AS landlord_phone FROM listings l JOIN users u ON l.landlord_id = u.id WHERE l.status = $1 ORDER BY l.created_at DESC', [status]);
    res.json({ success: true, listings: result.rows });
});

router.get('/stats', protect, authorize('admin'), async (req, res) => {
    const [users, listingsCount, enquiries] = await Promise.all([
        pool.query('SELECT role, COUNT(*) FROM users GROUP BY role'),
        pool.query('SELECT status, COUNT(*) FROM listings GROUP BY status'),
        pool.query("SELECT COUNT(*) FROM enquiries WHERE created_at > NOW() - INTERVAL '7 days'"),
    ]);
    res.json({ success: true, stats: { users: users.rows, listings: listingsCount.rows, enquiries_this_week: parseInt(enquiries.rows[0].count) } });
});
// ---------------- PLATFORM REVIEW MODERATION (AUTO-COLUMN MATCH) ----------------
router.get('/all-reviews', protect, authorize('admin'), async (req, res) => {
    try {
        // 1. Try with 'comment' column first
        const tryComment = await pool.query(`
            SELECT r.id, r.rating, r.comment, r.created_at, u.name AS tenant_name, l.title AS property_title
            FROM reviews r
            LEFT JOIN users u ON r.tenant_id = u.id
            LEFT JOIN listings l ON r.listing_id = l.id
            ORDER BY r.created_at DESC
        `).catch(() => null); // Catch silently if column doesn't exist

        if (tryComment) {
            return res.json({ success: true, reviews: tryComment.rows });
        }

        // 2. Fallback: Try with 'review_text' or 'message' instead of 'comment'
        const tryReviewText = await pool.query(`
            SELECT r.id, r.rating, COALESCE(r.review_text, r.message, 'No text content') AS comment, r.created_at,
                   u.name AS tenant_name, l.title AS property_title
            FROM reviews r
            LEFT JOIN users u ON r.tenant_id = u.id
            LEFT JOIN listings l ON r.listing_id = l.id
            ORDER BY r.created_at DESC
        `).catch(() => null);

        if (tryReviewText) {
            return res.json({ success: true, reviews: tryReviewText.rows });
        }

        // 3. Fallback for 'listing_reviews' table layout
        const tryListingReviews = await pool.query(`
            SELECT r.id, r.rating, COALESCE(r.comment, r.review_text, 'No text content') AS comment, r.created_at,
                   u.name AS tenant_name, l.title AS property_title
            FROM listing_reviews r
            LEFT JOIN users u ON r.user_id = u.id OR r.tenant_id = u.id
            LEFT JOIN listings l ON r.listing_id = l.id
            ORDER BY r.created_at DESC
        `).catch(() => null);

        if (tryListingReviews) {
            return res.json({ success: true, reviews: tryListingReviews.rows });
        }

        // If no review tables are populated yet, return an empty array gracefully
        res.json({ success: true, reviews: [] });

    } catch (err) {
        console.error("Reviews fallback failed:", err.message);
        res.json({ success: true, reviews: [] });
    }
});
// ---------------- ADMIN SYSTEM-WIDE ENQUIRIES ----------------
router.get('/enquiries', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, u.name AS sender_name, l.title AS property_title 
            FROM enquiries e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN listings l ON e.listing_id = l.id
            ORDER BY e.created_at DESC
        `);
        res.json({ success: true, enquiries: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error fetching inquiries.' });
    }
});

module.exports = router;