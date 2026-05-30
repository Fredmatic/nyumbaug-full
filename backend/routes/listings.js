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
const { protect } = require('../middleware/auth'); // assuming your auth middleware name

// 1. Public search filter route
router.get('/', getListings);

// 2. MOVE THIS ABOVE THE :id ROUTE 💡
// This ensures Express captures '/my' before treating it as a dynamic ID parameter!
router.get('/my', protect, getMyListings);

// 3. Dynamic item lookup routes (Keep these at the bottom)
router.get('/:id', getListing);
router.patch('/:id', protect, updateListing);
router.delete('/:id', protect, deleteListing);
router.post('/:id/images', protect, addImages);

module.exports = router;