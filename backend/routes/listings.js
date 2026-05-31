const express = require('express');
const router = express.Router();
const { createListing, getListings, getListing, updateListing, deleteListing, getMyListings } = require('../controllers/listingsController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware'); // Make sure your multer configuration is imported!

// 1. Public search filter route
router.get('/', getListings);

// ── ADD THIS EXPLICIT POST ROUTE FOR CREATING LISTINGS WITH MULTER MEDIA ──
router.post('/', protect, upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'video', maxCount: 1 }
]), createListing);

// 2. Profile specifics route
router.get('/my', protect, getMyListings);

// 3. Dynamic item lookup routes (Keep these at the bottom)
router.get('/:id', getListing);
router.patch('/:id', protect, updateListing);
router.delete('/:id', protect, deleteListing);

module.exports = module.exports = router;