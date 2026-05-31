const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const listingRoutes = require('./listings');
const enquiryRoutes = require('./enquiries');
const adminRoutes = require('./admin');
const reviewRoutes = require('./reviews'); // Imported clean on line 10!

router.use('/auth', authRoutes);
router.use('/listings', listingRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/admin', adminRoutes);

// 🚀 MOUNT IT HERE:
router.use('/reviews', reviewRoutes);

module.exports = router;