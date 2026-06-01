const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect } = require('../middleware/auth');

// ── GET /api/messages/unread-count  (MUST be before /:partnerId)
router.get('/unread-count', protect, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ success: true, count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.json({ success: true, count: 0 });
  }
});

// ── GET /api/messages — all conversation threads
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT DISTINCT ON (partner_id)
        partner_id, partner_name, partner_role,
        last_message, last_at, listing_id, listing_title, unread_count
      FROM (
        SELECT
          CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id,
          CASE WHEN m.sender_id = $1 THEN ru.name ELSE su.name END AS partner_name,
          CASE WHEN m.sender_id = $1 THEN ru.role ELSE su.role END AS partner_role,
          m.body AS last_message,
          m.created_at AS last_at,
          m.listing_id,
          l.title AS listing_title,
          SUM(CASE WHEN m.receiver_id = $1 AND m.is_read = FALSE THEN 1 ELSE 0 END)
            OVER (PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END) AS unread_count
        FROM messages m
        JOIN users su ON m.sender_id = su.id
        JOIN users ru ON m.receiver_id = ru.id
        LEFT JOIN listings l ON m.listing_id = l.id
        WHERE m.sender_id = $1 OR m.receiver_id = $1
        ORDER BY m.created_at DESC
      ) threads
      ORDER BY partner_id, last_at DESC
    `, [userId]);

    res.json({ success: true, threads: result.rows });
  } catch (err) {
    console.error('getThreads error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/messages/:partnerId — full conversation with one user
router.get('/:partnerId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { partnerId } = req.params;

    // Mark received messages as read
    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE',
      [partnerId, userId]
    );

    const result = await pool.query(`
      SELECT m.*, su.name AS sender_name, su.role AS sender_role
      FROM messages m
      JOIN users su ON m.sender_id = su.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [userId, partnerId]);

    const partner = await pool.query(
      'SELECT id, name, role, phone FROM users WHERE id = $1', [partnerId]
    );

    res.json({ success: true, messages: result.rows, partner: partner.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/messages — send a message
router.post('/', protect, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, body, listing_id } = req.body;

    if (!receiver_id || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'receiver_id and body are required.' });
    }

    const receiver = await pool.query('SELECT id, name FROM users WHERE id = $1', [receiver_id]);
    if (!receiver.rows.length) {
      return res.status(404).json({ success: false, message: 'Recipient not found.' });
    }

    const result = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, body, listing_id, is_read)
      VALUES ($1, $2, $3, $4, FALSE) RETURNING *
    `, [senderId, receiver_id, body.trim(), listing_id || null]);

    // Notify recipient
    await pool.query(`
      INSERT INTO notifications (user_id, type, message, listing_id)
      VALUES ($1, 'message', $2, $3)
    `, [
      receiver_id,
      `New message from ${req.user.name}: "${body.trim().substring(0, 60)}${body.length > 60 ? '…' : ''}"`,
      listing_id || null
    ]).catch(() => {});

    res.status(201).json({ success: true, message: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
