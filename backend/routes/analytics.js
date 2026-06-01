const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Your database connection pool

router.get('/landlord/:id', async (req, res) => {
    const landlordId = req.params.id;
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