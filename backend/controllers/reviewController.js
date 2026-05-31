const pool = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/error');

// @desc    Create a new listing review
// @route   POST /api/reviews
// @access  Private (Authenticated Tenants)
const createReview = asyncHandler(async (req, res) => {
    const { listing_id, rating, title, comment } = req.body;
    const tenant_id = req.user.id;

    if (!listing_id || !rating || !comment) {
        throw new AppError('Listing ID, rating score, and review commentary are required.', 400);
    }

    const score = parseInt(rating, 10);
    if (isNaN(score) || score < 1 || score > 5) {
        throw new AppError('Rating must be between 1 and 5.', 400);
    }

    // Formatting check to ensure safe UUID format matching
    const parsedListingId = listing_id.includes('-')
        ? listing_id
        : `00000000-0000-0000-0000-${listing_id.padStart(12, '0')}`;

    const listingCheck = await pool.query('SELECT id FROM listings WHERE id = $1', [parsedListingId]);
    if (!listingCheck.rows.length) {
        throw new AppError('The target property listing no longer exists.', 404);
    }

    try {
        const result = await pool.query(`
      INSERT INTO reviews (listing_id, tenant_id, rating, title, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [parsedListingId, tenant_id, score, title || null, comment]);

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully!',
            data: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            throw new AppError('You have already submitted a review for this property.', 400);
        }
        throw error;
    }
});

// @desc    Get all reviews for a specific property listing
// @route   GET /api/reviews/listing/:listing_id
// @access  Public
const getListingReviews = asyncHandler(async (req, res) => {
    const { listing_id } = req.params;

    const parsedListingId = listing_id.includes('-')
        ? listing_id
        : `00000000-0000-0000-0000-${listing_id.padStart(12, '0')}`;

    const result = await pool.query(`
    SELECT r.*, u.name as tenant_name, u.avatar_url as tenant_avatar
    FROM reviews r
    JOIN users u ON r.tenant_id = u.id
    WHERE r.listing_id = $1
    ORDER BY r.created_at DESC
  `, [parsedListingId]);

    res.status(200).json({
        success: true,
        count: result.rows.length,
        data: result.rows
    });
});

module.exports = { createReview, getListingReviews };