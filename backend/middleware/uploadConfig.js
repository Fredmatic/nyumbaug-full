const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── 1. LISTINGS (images only) ──
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'nyumbaug/listings',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }],
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// ── 2. VIDEOS (listings) ──
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
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only video files are allowed'), false);
  },
});

// ── 3. MESSAGES (images + video + audio/voice) ──
const messageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const mime = file.mimetype || '';
    const name = file.originalname || '';

    if (mime.startsWith('audio') || name.includes('.webm') || name.includes('.ogg')) {
      return {
        folder: 'nyumbaug/voice-notes',
        resource_type: 'video', // Cloudinary uses 'video' for audio too
        allowed_formats: ['webm', 'ogg', 'mp3', 'wav'],
      };
    }
    if (mime.startsWith('video')) {
      return {
        folder: 'nyumbaug/message-videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'webm', 'mov'],
      };
    }
    return {
      folder: 'nyumbaug/messages',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    };
  },
});
const messageUpload = multer({
  storage: messageStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── 4. MIXED (listings with both image + video) ──
const dynamicStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.mimetype.startsWith('video/')) {
      return {
        folder: 'nyumbaug/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi', 'mkv'],
      };
    }
    return {
      folder: 'nyumbaug/listings',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }],
    };
  },
});
const uploadMixedMedia = multer({
  storage: dynamicStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// ── DELETE FROM CLOUDINARY ──
const deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

module.exports = { upload, uploadVideo, uploadMixedMedia, messageUpload, deleteImage, cloudinary };