const express = require('express');
const router = express.Router();
const {
    getListings,
    getListing,
    createListing,
    updateListing,
    deleteListing,
    addImages,
    getMyListings
} = require('../controllers/listingsController');

// ── MATCHING SIDEBAR NAMING CONVENTIONS ──
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/uploadConfig');

// 1. Public search filter route
router.get('/', getListings);

// 2. Landlord specific route
router.get('/my', protect, getMyListings);

// 3. Create property listing route
router.post('/', protect, upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'video', maxCount: 1 }
]), createListing);

// 4. Listing manipulation routes
router.get('/:id', getListing);
router.patch('/:id', protect, updateListing);
router.delete('/:id', protect, deleteListing);

// 5. Image additions route
router.post('/:id/images', protect, upload.array('images', 10), addImages);

module.exports = router;