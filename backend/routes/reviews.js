const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ── AUTH HELPER ──
async function getUser(req) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return null;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(
            'SELECT id, name, role, is_active FROM users WHERE id = $1 AND is_active = true',
            [decoded.id]
        );
        return result.rows[0] || null;
    } catch { return null; }
}

// ── GET REVIEWS FOR A LISTING ──
// GET /api/reviews/listing/:listing_id
router.get('/reviews/listing/:listing_id', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        r.id, r.rating, r.title, r.body, r.created_at,
        u.name AS tenant_name,
        u.avatar_url AS tenant_avatar
      FROM reviews r
      JOIN users u ON r.tenant_id = u.id
      WHERE r.listing_id = $1 AND r.status = 'active'
      ORDER BY r.created_at DESC
    `, [req.params.listing_id]);

        // Calculate average rating
        const avgResult = await pool.query(
            'SELECT ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*) AS total FROM reviews WHERE listing_id = $1 AND status = $2',
            [req.params.listing_id, 'active']
        );

        res.json({
            success: true,
            reviews: result.rows,
            average: parseFloat(avgResult.rows[0].avg) || 0,
            total: parseInt(avgResult.rows[0].total) || 0,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to load reviews.' });
    }
});

// ── GET REVIEWS FOR A LANDLORD ──
// GET /api/reviews/landlord/:landlord_id
router.get('/reviews/landlord/:landlord_id', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        r.id, r.rating, r.title, r.body, r.created_at,
        u.name AS tenant_name,
        u.avatar_url AS tenant_avatar,
        l.title AS listing_title,
        l.neighbourhood
      FROM reviews r
      JOIN users u ON r.tenant_id = u.id
      JOIN listings l ON r.listing_id = l.id
      WHERE l.landlord_id = $1 AND r.status = 'active'
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [req.params.landlord_id]);

        const avgResult = await pool.query(`
      SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg, COUNT(*) AS total
      FROM reviews r
      JOIN listings l ON r.listing_id = l.id
      WHERE l.landlord_id = $1 AND r.status = 'active'
    `, [req.params.landlord_id]);

        res.json({
            success: true,
            reviews: result.rows,
            average: parseFloat(avgResult.rows[0].avg) || 0,
            total: parseInt(avgResult.rows[0].total) || 0,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load reviews.' });
    }
});

// ── SUBMIT A REVIEW ──
// POST /api/reviews
router.post('/reviews', async (req, res) => {
    const user = await getUser(req);

    if (!user) {
        return res.status(401).json({ success: false, message: 'Please log in to leave a review.' });
    }

    if (user.role !== 'tenant') {
        return res.status(403).json({ success: false, message: 'Only tenants can leave reviews.' });
    }

    const { listing_id, rating, title, body } = req.body;

    if (!listing_id || !rating || !body) {
        return res.status(400).json({ success: false, message: 'listing_id, rating and review text are required.' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    if (body.trim().length < 10) {
        return res.status(400).json({ success: false, message: 'Review must be at least 10 characters.' });
    }

    try {
        // Check listing exists and is active
        const listing = await pool.query(
            "SELECT id FROM listings WHERE id = $1 AND status = 'active'",
            [listing_id]
        );
        if (!listing.rows.length) {
            return res.status(404).json({ success: false, message: 'Listing not found.' });
        }

        // Check tenant sent an enquiry for this listing
        const enquiry = await pool.query(
            'SELECT id FROM enquiries WHERE listing_id = $1 AND tenant_id = $2',
            [listing_id, user.id]
        );
        if (!enquiry.rows.length) {
            return res.status(403).json({
                success: false,
                message: 'You can only review properties you have enquired about.'
            });
        }

        // Insert review (upsert — one review per tenant per listing)
        const result = await pool.query(`
      INSERT INTO reviews (listing_id, tenant_id, rating, title, body)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (listing_id, tenant_id)
      DO UPDATE SET rating = $3, title = $4, body = $5, updated_at = NOW()
      RETURNING *
    `, [listing_id, user.id, parseInt(rating), title?.trim() || null, body.trim()]);

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully!',
            review: result.rows[0],
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to submit review.' });
    }
});

// ── DELETE A REVIEW ──
// DELETE /api/reviews/:id
router.delete('/reviews/:id', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Not authorized.' });

    try {
        const query = user.role === 'admin'
            ? 'DELETE FROM reviews WHERE id = $1 RETURNING id'
            : 'DELETE FROM reviews WHERE id = $1 AND tenant_id = $2 RETURNING id';

        const params = user.role === 'admin'
            ? [req.params.id]
            : [req.params.id, user.id];

        const result = await pool.query(query, params);

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Review not found.' });
        }

        res.json({ success: true, message: 'Review deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete review.' });
    }
});

// ── ADMIN: FLAG/HIDE A REVIEW ──
// PATCH /api/reviews/:id/status
router.patch('/reviews/:id/status', async (req, res) => {
    const user = await getUser(req);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin only.' });
    }

    const { status } = req.body;
    if (!['active', 'hidden', 'flagged'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    try {
        const result = await pool.query(
            'UPDATE reviews SET status = $1 WHERE id = $2 RETURNING id, status',
            [status, req.params.id]
        );
        res.json({ success: true, review: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update review.' });
    }
});

module.exports = router;