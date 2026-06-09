const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

router.get('/landlord/:id', protect, authorize('landlord', 'admin'), async (req, res) => {
    const landlordId = req.params.id;

    // Security: user can only see their own data (admin can see any)
    if (req.user.role !== 'admin' && req.user.id !== landlordId) {
        return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    try {
        const query = `
      SELECT
        l.id,
        l.title,
        l.status,
        l.type,
        l.price,
        l.bedrooms,
        l.neighbourhood,
        COALESCE(l.views_count, 0) AS views_count,
        COUNT(e.id) AS total_enquiries,
        l.created_at
      FROM listings l
      LEFT JOIN enquiries e ON l.id = e.listing_id
      WHERE l.landlord_id = $1
        AND l.status != 'inactive'
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `;
        const { rows } = await pool.query(query, [landlordId]);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Analytics error:', err.message);
        res.status(500).json({ success: false, message: 'Analytics fetch failed' });
    }
});

module.exports = router;