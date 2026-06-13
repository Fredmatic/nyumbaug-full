const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const listingRoutes = require('./listings');
const enquiryRoutes = require('./enquiries');
const adminModule = require('./admin');
const reviewRoutes = require('./reviews');
const paymentRoutes = require('./payments');
const messageRoutes = require('./messages');

const adminRoutes = adminModule.default || adminModule;
const notifRoutes = adminModule.notifRouter;

const analyticsRoutes = require('./analytics');
router.use('/analytics', analyticsRoutes);
const applicationRoutes = require('./applications');
const subscriptionRoutes = require('./subscriptions');
router.use('/applications', applicationRoutes);
router.use('/subscriptions', subscriptionRoutes);

router.use('/auth', authRoutes);
router.use('/listings', listingRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/admin', adminRoutes);
router.use('/reviews', reviewRoutes);
router.use('/payments', paymentRoutes);
router.use('/messages', messageRoutes);
router.use('/subscriptions', subscriptionRoutes);
if (notifRoutes) {
  router.use('/notifications', notifRoutes);
}

module.exports = router;
