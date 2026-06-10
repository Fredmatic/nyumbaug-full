const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect } = require('../middleware/auth');

// Auto-create table on first use
async function ensureTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name VARCHAR(150) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      occupation VARCHAR(100),
      monthly_income INTEGER,
      id_number VARCHAR(60),
      move_in_date DATE NOT NULL,
      viewing_date DATE,
      viewing_time VARCHAR(20),
      message TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      rejection_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(listing_id, tenant_id)
    )
  `);
}

// POST /api/applications — tenant submits application
router.post('/', protect, async (req, res) => {
    try {
        await ensureTable();
        const {
            listing_id, full_name, phone, occupation,
            monthly_income, id_number, move_in_date,
            viewing_date, viewing_time, message
        } = req.body;

        if (!listing_id || !full_name || !phone || !move_in_date) {
            return res.status(400).json({ success: false, message: 'listing_id, full_name, phone and move_in_date are required.' });
        }

        // Check listing exists
        const listing = await pool.query('SELECT id, landlord_id, title FROM listings WHERE id = $1', [listing_id]);
        if (!listing.rows.length) return res.status(404).json({ success: false, message: 'Listing not found.' });

        // Prevent landlord applying to own listing
        if (listing.rows[0].landlord_id === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot apply to your own listing.' });
        }

        const result = await pool.query(`
      INSERT INTO applications
        (listing_id, tenant_id, full_name, phone, occupation, monthly_income,
         id_number, move_in_date, viewing_date, viewing_time, message)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (listing_id, tenant_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        occupation = EXCLUDED.occupation,
        monthly_income = EXCLUDED.monthly_income,
        id_number = EXCLUDED.id_number,
        move_in_date = EXCLUDED.move_in_date,
        viewing_date = EXCLUDED.viewing_date,
        viewing_time = EXCLUDED.viewing_time,
        message = EXCLUDED.message,
        status = 'pending',
        rejection_reason = NULL
      RETURNING *
    `, [listing_id, req.user.id, full_name, phone, occupation || null,
            monthly_income || null, id_number || null, move_in_date,
            viewing_date || null, viewing_time || null, message || null]);

        // Notify landlord
        await pool.query(`
      INSERT INTO notifications (user_id, type, message, listing_id)
      VALUES ($1, 'application', $2, $3)
    `, [listing.rows[0].landlord_id,
        `New application from ${full_name} for "${listing.rows[0].title}"`,
            listing_id]).catch(() => { });

        res.status(201).json({ success: true, application: result.rows[0] });
    } catch (err) {
        console.error('Apply error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/applications — landlord sees all applications for their listings
router.get('/', protect, async (req, res) => {
    try {
        await ensureTable();
        const { listing_id, status } = req.query;
        let q = `
      SELECT a.*, l.title AS listing_title, l.neighbourhood, l.price,
             u.name AS tenant_name, u.email AS tenant_email
      FROM applications a
      JOIN listings l ON a.listing_id = l.id
      JOIN users u ON a.tenant_id = u.id
      WHERE l.landlord_id = $1
    `;
        const params = [req.user.id];
        if (listing_id) { q += ` AND a.listing_id = $${params.length + 1}`; params.push(listing_id); }
        if (status) { q += ` AND a.status = $${params.length + 1}`; params.push(status); }
        q += ' ORDER BY a.created_at DESC';
        const result = await pool.query(q, params);
        res.json({ success: true, applications: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/applications/mine — tenant sees their own applications
router.get('/mine', protect, async (req, res) => {
    try {
        await ensureTable();
        const result = await pool.query(`
      SELECT a.*, l.title AS listing_title, l.neighbourhood, l.price,
             li.url AS listing_image
      FROM applications a
      JOIN listings l ON a.listing_id = l.id
      LEFT JOIN listing_images li ON li.listing_id = l.id AND li.is_cover = true
      WHERE a.tenant_id = $1
      ORDER BY a.created_at DESC
    `, [req.user.id]);
        res.json({ success: true, applications: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/applications/check/:listingId — tenant checks if they already applied
router.get('/check/:listingId', protect, async (req, res) => {
    try {
        await ensureTable();
        const result = await pool.query(
            'SELECT id, status FROM applications WHERE listing_id = $1 AND tenant_id = $2',
            [req.params.listingId, req.user.id]
        );
        res.json({ success: true, applied: result.rows.length > 0, application: result.rows[0] || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/applications/:id — landlord approves or rejects
router.patch('/:id', protect, async (req, res) => {
    try {
        const { status, rejection_reason } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be approved or rejected.' });
        }

        // Verify this application belongs to one of the landlord's listings
        const check = await pool.query(`
      SELECT a.id, a.tenant_id, l.title, l.id AS listing_id
      FROM applications a
      JOIN listings l ON a.listing_id = l.id
      WHERE a.id = $1 AND l.landlord_id = $2
    `, [req.params.id, req.user.id]);

        if (!check.rows.length) {
            return res.status(403).json({ success: false, message: 'Not authorised.' });
        }

        const result = await pool.query(`
      UPDATE applications SET status = $1, rejection_reason = $2
      WHERE id = $3 RETURNING *
    `, [status, rejection_reason || null, req.params.id]);

        // Notify tenant
        const app = check.rows[0];
        const notifMsg = status === 'approved'
            ? `🎉 Your application for "${app.title}" was approved!`
            : `Your application for "${app.title}" was not successful.${rejection_reason ? ' Reason: ' + rejection_reason : ''}`;

        await pool.query(`
      INSERT INTO notifications (user_id, type, message, listing_id)
      VALUES ($1, 'application_update', $2, $3)
    `, [app.tenant_id, notifMsg, app.listing_id]).catch(() => { });

        res.json({ success: true, application: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;