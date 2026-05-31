const express = require('express');
const router = express.Router();

// Import the specific handler functions from the controller
const {
    createEnquiry,
    getEnquiries,
    updateEnquiry
} = require('../controllers/enquiryController');

// Import authentication middleware
const { protect } = require('../middleware/auth');

// Line 11: Public contact/enquiry creation endpoint
router.post('/', createEnquiry);

// Protected routes for viewing and updating enquiries
router.get('/', protect, getEnquiries);
router.patch('/:id', protect, updateEnquiry);

module.exports = router;