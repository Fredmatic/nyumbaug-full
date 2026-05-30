const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Store images in Cloudinary under nyumbaug/listings/
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'nyumbaug/listings',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }],
  },
});

// Image storage (10MB max)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Video storage — Cloudinary (100MB max)
const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'nyumbaug/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv'],
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
});

// Delete an image from Cloudinary by its public_id
const deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};
// ── ADD THIS NEW UNIFIED STORAGE ENGINE FOR MIXED UPLOADS ──
// Since CloudinaryStorage needs distinct parameter profiles for media types,
// we will use a dynamic configuration to handle both images and videos dynamically.

const dynamicStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.mimetype.startsWith('video/')) {
      return {
        folder: 'nyumbaug/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi', 'mkv']
      };
    }

    // Default to image handling configuration
    return {
      folder: 'nyumbaug/listings',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }]
    };
  }
});

// Create the combined middleware processor
const uploadMixedMedia = multer({
  storage: dynamicStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // Set upper limit to accommodate 100MB videos
});

// Update your module exports to include the new mixed media handler
module.exports = { upload, uploadVideo, uploadMixedMedia, deleteImage, cloudinary };

module.exports = { upload, uploadVideo, deleteImage, cloudinary };
