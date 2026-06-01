const express = require('express');
const router = express.Router();
const pool = require('../config/db');
// 1. Import your existing auth middleware
const { protect, authorize } = require('../middleware/auth');

// 2. Add 'protect' and 'authorize('landlord')' to the route
router.get('/landlord/:id', protect, authorize('landlord'), async (req, res) => {
    const landlordId = req.params.id;

    // SECURITY CHECK: Ensure the logged-in user is only accessing their own data
    if (req.user.id !== parseInt(landlordId)) {
        return res.status(403).json({ success: false, message: 'Unauthorized: You can only view your own analytics.' });
    }

    try {
        const query = `
            SELECT 
                l.title, 
                l.views_count,
                COUNT(e.id) as total_enquiries
            FROM listings l
            LEFT JOIN enquiries e ON l.id = e.listing_id
            WHERE l.landlord_id = $1
            GROUP BY l.id, l.title, l.views_count;
        `;
        const { rows } = await pool.query(query, [landlordId]);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Analytics fetch failed' });
    }
});

module.exports = router;