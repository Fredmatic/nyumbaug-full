const express = require('express');
const router = express.Router();

// Import controller functions
const {
    createListing,
    getListings,
    getListing,
    updateListing,
    deleteListing,
    getMyListings,
    addImages
} = require('../controllers/listingsController');

// ── FIXED IMPORT STRATEGY ──
const { protect } = require('../middleware/auth');
const { upload, uploadMixedMedia } = require('../middleware/uploadConfig'); // ✨ Added curly braces to destructure safely!

// Public routes
router.get('/', getListings);
router.get('/:id', getListing);

// Protected routes
router.get('/user/me', protect, getMyListings);

// Use upload.fields safely now that it is properly destructured
router.post('/', protect, upload.fields([{ name: 'images', maxCount: 10 }]), createListing);

router.patch('/:id', protect, updateListing);
router.delete('/:id', deleteListing);

// If you want landowners to add mixed media profiles later:
router.post('/:id/images', protect, uploadMixedMedia.array('images', 10), addImages);

module.exports = router;