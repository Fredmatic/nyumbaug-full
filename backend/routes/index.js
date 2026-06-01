const express = require('express');
const router = express.Router();

const authRoutes     = require('./auth');
const listingRoutes  = require('./listings');
const enquiryRoutes  = require('./enquiries');
const adminModule    = require('./admin');
const reviewRoutes   = require('./reviews');
const paymentRoutes  = require('./payments');

const adminRoutes  = adminModule.default || adminModule;
const notifRoutes  = adminModule.notifRouter;

router.use('/auth',          authRoutes);
router.use('/listings',      listingRoutes);
router.use('/enquiries',     enquiryRoutes);
router.use('/admin',         adminRoutes);
router.use('/reviews',       reviewRoutes);
router.use('/payments',      paymentRoutes);
if (notifRoutes) {
  router.use('/notifications', notifRoutes);
}

module.exports = router;
