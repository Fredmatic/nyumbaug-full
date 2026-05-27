const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const listings = require('../controllers/listingsController');

router.get('/listings', listings.getListings);
router.get('/listings/my', protect, authorize('landlord', 'admin'), listings.getMyListings);
router.get('/listings/:id', listings.getListing);
router.post('/listings', protect, authorize('landlord', 'admin'), upload.array('images', 8), listings.createListing);
router.patch('/listings/:id', protect, authorize('landlord', 'admin'), listings.updateListing);
router.delete('/listings/:id', protect, authorize('landlord', 'admin'), listings.deleteListing);
router.post('/listings/:id/images', protect, authorize('landlord', 'admin'), upload.array('images', 8), listings.addImages);

module.exports = router;