const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const passwordRoutes = require('./password');
const listingsRoutes = require('./listings');
const enquiriesRoutes = require('./enquiries');
const adminRoutes = require('./admin');

router.use('/', authRoutes);
router.use('/', passwordRoutes);
router.use('/', listingsRoutes);
router.use('/', enquiriesRoutes);
router.use('/', adminRoutes);

module.exports = router;