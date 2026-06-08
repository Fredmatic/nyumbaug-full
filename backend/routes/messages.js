const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect } = require('../middleware/auth');
const { messageUpload } = require('../middleware/uploadConfig');

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

    // Ensure all new columns + reactions table exist before querying
    await pool.query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS media_url TEXT,
        ADD COLUMN IF NOT EXISTS media_type VARCHAR(20)
    `).catch(() => { });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(message_id, user_id, emoji)
      )
    `);

    const result = await pool.query(`
      SELECT
        m.*,
        su.name AS sender_name,
        su.role AS sender_role,
        rm.body AS reply_to_body,
        rm.sender_id AS reply_to_sender_id,
        COALESCE(
          json_agg(
            json_build_object('emoji', mr.emoji, 'user_id', mr.user_id)
          ) FILTER (WHERE mr.id IS NOT NULL),
          '[]'
        ) AS reactions
      FROM messages m
      JOIN users su ON m.sender_id = su.id
      LEFT JOIN messages rm ON m.reply_to_id = rm.id
      LEFT JOIN message_reactions mr ON mr.message_id = m.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      GROUP BY m.id, su.name, su.role, rm.body, rm.sender_id
      ORDER BY m.created_at ASC
    `, [userId, partnerId]);

    const partner = await pool.query(
      'SELECT id, name, role, phone FROM users WHERE id = $1', [partnerId]
    );

    res.json({ success: true, messages: result.rows, partner: partner.rows[0] || null });
  } catch (err) {
    console.error('getMessages error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/messages — send a message
router.post('/', protect, messageUpload.single('media'), async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, body, listing_id, reply_to_id } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ success: false, message: 'receiver_id is required.' });
    }

    // Handle media upload
    let media_url = null;
    let media_type = null;
    if (req.file) {
      media_url = req.file.path;
      const mime = req.file.mimetype || req.file.originalname || '';
      if (mime.includes('audio') || mime.includes('webm') || mime.includes('ogg')) {
        media_type = 'audio';
      } else if (mime.includes('video') || mime.includes('mp4')) {
        media_type = 'video';
      } else {
        media_type = 'image';
      }
    }

    if (!body?.trim() && !media_url) {
      return res.status(400).json({ success: false, message: 'Message or media is required.' });
    }

    const receiver = await pool.query('SELECT id, name FROM users WHERE id = $1', [receiver_id]);
    if (!receiver.rows.length) {
      return res.status(404).json({ success: false, message: 'Recipient not found.' });
    }

    // Ensure columns exist
    await pool.query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS media_url TEXT,
        ADD COLUMN IF NOT EXISTS media_type VARCHAR(20),
        ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
    `).catch(() => { });

    const result = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, body, listing_id, is_read, media_url, media_type, reply_to_id)
      VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7) RETURNING *
    `, [senderId, receiver_id, body?.trim() || '', listing_id || null, media_url, media_type, reply_to_id || null]);

    // Notify recipient
    const notifMsg = media_url
      ? `${req.user.name} sent you a ${media_type}`
      : `New message from ${req.user.name}: "${(body || '').substring(0, 60)}"`;

    await pool.query(`
      INSERT INTO notifications (user_id, type, message, listing_id)
      VALUES ($1, 'message', $2, $3)
    `, [receiver_id, notifMsg, listing_id || null]).catch(() => { });

    res.status(201).json({ success: true, message: result.rows[0] });
  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/messages/:id — delete for everyone (sender only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Only the sender can delete
    const msg = await pool.query('SELECT sender_id FROM messages WHERE id = $1', [id]);
    if (!msg.rows.length) return res.status(404).json({ success: false, message: 'Message not found.' });
    if (msg.rows[0].sender_id !== userId) {
      return res.status(403).json({ success: false, message: 'Only the sender can delete this message.' });
    }

    await pool.query(
      'UPDATE messages SET deleted_at = NOW(), body = \'\', media_url = NULL WHERE id = $1',
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/messages/:id/react — add or toggle a reaction
router.post('/:id/react', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!emoji) return res.status(400).json({ success: false, message: 'emoji is required.' });

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(message_id, user_id, emoji)
      )
    `);

    // Toggle: if already reacted with same emoji, remove it; otherwise add
    const existing = await pool.query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [id, userId, emoji]
    );

    if (existing.rows.length) {
      await pool.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [id, userId, emoji]
      );
      res.json({ success: true, action: 'removed' });
    } else {
      await pool.query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
        [id, userId, emoji]
      );
      res.json({ success: true, action: 'added' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/messages/:id/react — remove a reaction
router.delete('/:id/react', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [id, userId, emoji]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;