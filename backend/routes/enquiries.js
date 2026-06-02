const express = require('express');
const router = express.Router();

const {
    createEnquiry,
    getEnquiries,
    updateEnquiry
} = require('../controllers/enquiryController');
const { protect } = require('../middleware/auth');
router.post('/', protect, createEnquiry);

// Protected routes for viewing and updating enquiries
router.get('/', protect, getEnquiries);
router.patch('/:id', protect, updateEnquiry);

module.exports = router;