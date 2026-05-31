const pool = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/error');
const nodemailer = require('nodemailer');

// ── EMAIL HELPER ──
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER) {
    console.log(`[Email skipped — not configured] To: ${to} | Subject: ${subject}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
};

// ── ENQUIRIES ──

// POST /api/enquiries — tenant sends enquiry about a listing
const createEnquiry = asyncHandler(async (req, res) => {
  const { listing_id, name, email, phone, message } = req.body;

  if (!name || !phone || !message) {
    throw new AppError('name, phone, and message are required.', 400);
  }

  // Handle safe database formatting for the tenant_id field if a guest submits a form
  const fallbackTenantId = req.user?.id ? String(req.user.id) : null;
  const parsedTenantId = fallbackTenantId && fallbackTenantId.includes('-')
    ? fallbackTenantId
    : (fallbackTenantId ? `00000000-0000-0000-0000-${fallbackTenantId.padStart(12, '0')}` : '00000000-0000-0000-0000-000000000000');

  const result = await pool.query(`
    INSERT INTO enquiries (listing_id, tenant_id, name, email, phone, message)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [listing_id || null, parsedTenantId, name, email, phone, message]);

  // Only email landlord if this is a listing enquiry
  if (listing_id) {
    const listingResult = await pool.query(`
      SELECT l.title, l.neighbourhood, u.email AS landlord_email, u.name AS landlord_name
      FROM listings l JOIN users u ON l.landlord_id = u.id
      WHERE l.id = $1 AND l.status = 'active'
    `, [listing_id]);

    if (listingResult.rows.length) {
      const listing = listingResult.rows[0];
      await sendEmail({
        to: listing.landlord_email,
        subject: `New Enquiry: ${listing.title}`,
        html: `
          <h2>New Enquiry on NyumbaUG</h2>
          <p>Hi ${listing.landlord_name},</p>
          <p>Someone is interested in: <strong>${listing.title}</strong> (${listing.neighbourhood})</p>
          <hr/>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          ${email ? `<p><strong>Email:</strong> ${email}</p>` : ''}
          <p><strong>Message:</strong></p>
          <blockquote style="border-left:4px solid #1a5c38;padding-left:12px;color:#444;">${message}</blockquote>
        `,
      });
    }
  }

  // Email admin for contact form messages
  if (!listing_id && process.env.ADMIN_EMAIL) {
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `📬 Contact Form: ${name}`,
      html: `
        <h2>New Contact Form Message — NyumbaUG</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        ${email ? `<p><strong>Email:</strong> ${email}</p>` : ''}
        <p><strong>Message:</strong></p>
        <blockquote style="border-left:4px solid #1a5c38;padding-left:12px;color:#444;">${message}</blockquote>
      `,
    });
  }

  res.status(201).json({
    success: true,
    message: listing_id ? 'Enquiry sent! The landlord will contact you soon.' : 'Message sent! We\'ll reply within 24 hours.',
    enquiry: result.rows[0],
  });
});

// GET /api/enquiries — landlord gets enquiries for their listings
const getEnquiries = asyncHandler(async (req, res) => {
  const { status, listing_id } = req.query;
  const isAdmin = req.user.role === 'admin';

  let query = `
    SELECT e.*, 
      l.title AS listing_title, 
      l.neighbourhood
    FROM enquiries e
    LEFT JOIN listings l ON e.listing_id = l.id
    WHERE 1=1
  `;
  const values = [];
  let idx = 1;

  if (!isAdmin) {
    query += ` AND l.landlord_id = $${idx++}`;
    values.push(req.user.id);
  }

  if (status) { query += ` AND e.status = $${idx++}`; values.push(status); }
  if (listing_id) { query += ` AND e.listing_id = $${idx++}`; values.push(listing_id); }

  query += ' ORDER BY e.created_at DESC';

  const result = await pool.query(query, values);
  res.json({ success: true, enquiries: result.rows });
});

// PATCH /api/enquiries/:id — mark as read, replied, closed
const updateEnquiry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ['new', 'read', 'replied', 'closed'];
  if (!allowed.includes(status)) throw new AppError('Invalid status.', 400);

  const result = await pool.query(`
    UPDATE enquiries e SET status = $1
    FROM listings l
    WHERE e.id = $2 AND e.listing_id = l.id AND l.landlord_id = $3
    RETURNING e.*
  `, [status, id, req.user.id]);

  if (!result.rows.length) throw new AppError('Enquiry not found or not authorized.', 404);

  res.json({ success: true, enquiry: result.rows[0] });
});

// ── DIRECT MESSAGES ──
const sendMessage = asyncHandler(async (req, res) => {
  const { receiver_id, listing_id, body } = req.body;

  if (!receiver_id || !body) throw new AppError('receiver_id and body are required.', 400);
  if (receiver_id === req.user.id) throw new AppError('Cannot message yourself.', 400);

  const receiver = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [receiver_id]);
  if (!receiver.rows.length) throw new AppError('Recipient not found.', 404);

  const result = await pool.query(`
    INSERT INTO messages (sender_id, receiver_id, listing_id, body)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [req.user.id, receiver_id, listing_id || null, body]);

  res.status(201).json({ success: true, message: result.rows[0] });
});

const getMessages = asyncHandler(async (req, res) => {
  const { with: otherUserId } = req.query;

  if (otherUserId) {
    const result = await pool.query(`
      SELECT m.*, 
        s.name AS sender_name, s.avatar_url AS sender_avatar,
        r.name AS receiver_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [req.user.id, otherUserId]);

    await pool.query(`
      UPDATE messages SET is_read = true
      WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
    `, [req.user.id, otherUserId]);

    return res.json({ success: true, messages: result.rows });
  }

  const result = await pool.query(`
    SELECT DISTINCT ON (partner_id)
      partner_id, partner_name, partner_avatar, last_message, last_at, unread_count
    FROM (
      SELECT
        CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id,
        CASE WHEN m.sender_id = $1 THEN r.name ELSE s.name END AS partner_name,
        CASE WHEN m.sender_id = $1 THEN r.avatar_url ELSE s.avatar_url END AS partner_avatar,
        m.body AS last_message,
        m.created_at AS last_at,
        (SELECT COUNT(*) FROM messages
         WHERE receiver_id = $1
           AND sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
           AND is_read = false) AS unread_count
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY m.created_at DESC
    ) t
    ORDER BY partner_id, last_at DESC
  `, [req.user.id]);

  res.json({ success: true, threads: result.rows });
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = false',
    [req.user.id]
  );
  res.json({ success: true, count: parseInt(result.rows[0].count) });
});

// ── SAVED LISTINGS ──
const saveListing = asyncHandler(async (req, res) => {
  const { listing_id } = req.params;
  await pool.query(
    'INSERT INTO saved_listings (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.id, listing_id]
  );
  res.json({ success: true, message: 'Listing saved to favourites.' });
});

const unsaveListing = asyncHandler(async (req, res) => {
  await pool.query(
    'DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2',
    [req.user.id, req.params.listing_id]
  );
  res.json({ success: true, message: 'Removed from favourites.' });
});

const getSavedListings = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT l.id, l.title, l.type, l.price, l.bedrooms, l.neighbourhood, l.status,
      (SELECT url FROM listing_images WHERE listing_id = l.id AND is_cover = true LIMIT 1) AS cover_image,
      sl.created_at AS saved_at
    FROM saved_listings sl
    JOIN listings l ON sl.listing_id = l.id
    WHERE sl.user_id = $1
    ORDER BY sl.created_at DESC
  `, [req.user.id]);

  res.json({ success: true, listings: result.rows });
});

const getAllEnquiries = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT e.*, l.title AS listing_title, l.neighbourhood
    FROM enquiries e
    LEFT JOIN listings l ON e.listing_id = l.id
    WHERE 1=1
  `;
  const values = [];
  if (status) {
    query += ` AND e.status = $1`;
    values.push(status);
  }
  query += ' ORDER BY e.created_at DESC';
  const result = await pool.query(query, values);
  res.json({ success: true, enquiries: result.rows });
});

module.exports = {
  createEnquiry,
  getEnquiries,
  updateEnquiry,
  getAllEnquiries,
  sendMessage,
  getMessages,
  getUnreadCount,
  saveListing,
  unsaveListing,
  getSavedListings,
};