const reviewRoutes = require('./reviews');
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const passwordRoutes = require('./password');
const listingsRoutes = require('./listings');
const enquiriesRoutes = require('./enquiries');
const adminRoutes = require('./admin');

router.use('/auth', authRoutes);
router.use('/password', passwordRoutes);
router.use('/listings', listingsRoutes);
router.use('/enquiries', enquiriesRoutes);
router.use('/admin', adminRoutes);
router.use('/reviews', reviewRoutes);

module.exports = router;