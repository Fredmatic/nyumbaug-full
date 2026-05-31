const express = require('express');
const router = express.Router();

const {
    createListing,
    getListings,
    getListing,
    updateListing,
    deleteListing,
    getMyListings,
    addImages
} = require('../controllers/listingsController');

const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/uploadConfig');

// ── 1. FIXED/STATIC ROUTES FIRST ──
router.get('/', getListings);
// Placing this BEFORE /:id ensures Express handles the dashboard load request correctly
router.get('/user/me', protect, getMyListings);
router.get('/my', protect, getMyListings); // Adding /my as a fallback just in case your frontend calls /api/listings/my

// ── 2. PROTECTED ACTIONS ──
router.post('/', protect, upload.fields([{ name: 'images', maxCount: 10 }]), createListing);

// ── 3. DYNAMIC PARAMETER ROUTES LAST ──
router.get('/:id', getListing); // Express will now only check this if the request isn't 'user/me' or 'my'
router.patch('/:id', protect, updateListing);
router.delete('/:id', protect, deleteListing);
router.post('/:id/images', protect, upload.array('images', 10), addImages);

module.exports = router;