const express = require('express');
const router = express.Router();

const {
    createListing,
    getListings,
    getListing,
    updateListing,
    deleteListing,
    getMyListings,
    addImages,
    likeListing,
} = require('../controllers/listingsController');

const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/uploadConfig');
const { requireSubscription, checkListingLimit } = require('../middleware/subscription');

// ── STATIC ROUTES FIRST ──
router.get('/', getListings);
router.get('/user/me', protect, getMyListings);
router.get('/my', protect, getMyListings);

// ── PROTECTED ACTIONS ──
router.post('/', protect, requireSubscription, checkListingLimit, upload.fields([{ name: 'images', maxCount: 10 }]), createListing);

// ── DYNAMIC ROUTES LAST ──
router.get('/:id', getListing);
router.patch('/:id', protect, updateListing);
router.delete('/:id', protect, deleteListing);
router.post('/:id/images', protect, upload.array('images', 10), addImages);
router.post('/:id/like', protect, likeListing);

module.exports = router;
