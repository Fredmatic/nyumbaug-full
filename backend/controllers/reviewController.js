const pool = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/error');

// @desc    Create a new property review
// @route   POST /api/reviews
// @access  Private (Tenants only)
const createReview = asyncHandler(async (req, res) => {
    // Support both snake_case and camelCase parameters to prevent any frontend crashes
    const listing_id = req.body.listing_id || req.body.listingId;
    const rating = req.body.rating;
    const title = req.body.title || '';
    const comment = req.body.comment || req.body.body || req.body.review;

    // Guard rails validation
    if (!listing_id || !rating || !comment) {
        throw new AppError('Listing ID, rating score, and review commentary are required.', 400);
    }

    // Double check if listing exists
    const listingCheck = await pool.query('SELECT id FROM listings WHERE id = $1', [listing_id]);
    if (!listingCheck.rows.length) {
        throw new AppError('The target property listing no longer exists.', 404);
    }

    // Insert review into database
    const result = await pool.query(`
    INSERT INTO reviews (listing_id, tenant_id, rating, title, body)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [listing_id, req.user.id, rating, title, comment]);

    res.status(201).json({
        success: true,
        message: 'Review posted successfully!',
        review: result.rows[0]
    });
});

// @desc    Get all reviews for a single listing
// @route   GET /api/reviews/listing/:listingId
// @access  Public
const getListingReviews = asyncHandler(async (req, res) => {
    const { listingId } = req.params;

    const reviewsResult = await pool.query(`
    SELECT r.*, u.name AS tenant_name, u.avatar_url AS tenant_avatar
    FROM reviews r
    JOIN users u ON r.tenant_id = u.id
    WHERE r.listing_id = $1
    ORDER BY r.created_at DESC
  `, [listingId]);

    // Calculate review metric summaries
    const count = reviewsResult.rows.length;
    const average = count > 0
        ? parseFloat((reviewsResult.rows.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
        : 0;

    res.json({
        success: true,
        total: count,
        average,
        reviews: reviewsResult.rows
    });
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (Admin or Owner)
const deleteReview = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const reviewCheck = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
    if (!reviewCheck.rows.length) {
        throw new AppError('Review not found.', 404);
    }

    // Check roles (only admin or the authoring tenant can drop it)
    if (req.user.role !== 'admin' && reviewCheck.rows[0].tenant_id !== req.user.id) {
        throw new AppError('Not authorized to remove this review.', 403);
    }

    await pool.query('DELETE FROM reviews WHERE id = $1', [id]);

    res.json({
        success: true,
        message: 'Review successfully removed.'
    });
});

// ── THE CRITICAL EXPORTS BLOCK ──
// Ensure these match your routes exactly!
module.exports = {
    createReview,
    getListingReviews,
    deleteReview
};