const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadMixedMedia } = require('../middleware/uploadConfig');
const { upload } = require('../middleware/uploadConfig'); // Needed for the standalone addimages route
const listings = require('../controllers/listingsController');

// ── PUBLIC ROUTES ──
router.get('/listings', listings.getListings);
router.get('/listings/:id', listings.getListing);

// ── PROTECTED LANDLORD/ADMIN ROUTES ──
router.get('/listings/my', protect, authorize('landlord', 'admin'), listings.getMyListings);

// Create a brand new listing with mixed photos and video walkthroughs
router.post(
    '/listings',
    protect,
    authorize('landlord', 'admin'),
    uploadMixedMedia.fields([
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 }
    ]),
    listings.createListing
);

router.patch('/listings/:id', protect, authorize('landlord', 'admin'), listings.updateListing);
router.delete('/listings/:id', protect, authorize('landlord', 'admin'), listings.deleteListing);

// Upload extra images to a listing that already exists
router.post('/listings/:id/images', protect, authorize('landlord', 'admin'), upload.array('images', 8), listings.addImages);

module.exports = router;