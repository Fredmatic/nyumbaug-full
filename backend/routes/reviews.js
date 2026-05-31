const express = require('express');
const router = express.Router();
const { createReview, getListingReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

// Public endpoint to see reviews
router.get('/listing/:listing_id', getListingReviews);

// Protected endpoint to post a review
router.post('/', protect, createReview);

module.exports = router;