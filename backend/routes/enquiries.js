const express = require('express');
const router = express.Router();
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const enquiry = require('../controllers/enquiryController');

router.post('/enquiries', optionalAuth, enquiry.createEnquiry);
router.get('/enquiries', protect, authorize('landlord', 'admin'), enquiry.getEnquiries);
router.patch('/enquiries/:id', protect, authorize('landlord', 'admin'), enquiry.updateEnquiry);

router.post('/messages', protect, enquiry.sendMessage);
router.get('/messages', protect, enquiry.getMessages);
router.get('/messages/unread-count', protect, enquiry.getUnreadCount);

router.post('/saved/:listing_id', protect, enquiry.saveListing);
router.delete('/saved/:listing_id', protect, enquiry.unsaveListing);
router.get('/saved', protect, enquiry.getSavedListings);
// ADD after the existing enquiries routes:
router.get('/admin/enquiries', protect, authorize('admin'), enquiry.getAllEnquiries);

module.exports = router;