const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Destructure from controller file safely
const {
    createReview,
    getListingReviews,
    deleteReview
} = require('../controllers/reviewController');

// Define specific application endpoint paths
router.post('/', protect, createReview);
router.get('/listing/:listingId', getListingReviews);
router.delete('/:id', protect, deleteReview);

module.exports = router;