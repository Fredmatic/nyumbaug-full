const pool = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/error');
const { deleteImage } = require('../middleware/uploadConfig');

// GET /api/listings — search & filter
const getListings = asyncHandler(async (req, res) => {
  const {
    search, type, neighbourhood, district,
    min_price, max_price, bedrooms, amenities,
    sort = 'created_at', order = 'DESC',
    page = 1, limit = 12,
    featured,
  } = req.query;

  const conditions = [`l.status = 'active'`];
  const values = [];
  let idx = 1;

  if (search) {
    conditions.push(`(l.title ILIKE $${idx} OR l.address ILIKE $${idx} OR l.neighbourhood ILIKE $${idx})`);
    values.push(`%${search}%`); idx++;
  }
  if (type) { conditions.push(`l.type = $${idx++}`); values.push(type); }
  if (neighbourhood) { conditions.push(`l.neighbourhood ILIKE $${idx++}`); values.push(`%${neighbourhood}%`); }
  if (district) { conditions.push(`l.district = $${idx++}`); values.push(district); }
  if (min_price) { conditions.push(`l.price >= $${idx++}`); values.push(parseInt(min_price)); }
  if (max_price) { conditions.push(`l.price <= $${idx++}`); values.push(parseInt(max_price)); }
  if (bedrooms) { conditions.push(`l.bedrooms >= $${idx++}`); values.push(parseInt(bedrooms)); }
  if (featured === 'true') { conditions.push(`l.is_featured = true`); }
  if (amenities) {
    const arr = amenities.split(',').map(a => a.trim());
    conditions.push(`l.amenities @> $${idx++}::text[]`);
    values.push(arr);
  }

  const allowedSorts = { price: 'l.price', created_at: 'l.created_at', views: 'l.views', bedrooms: 'l.bedrooms' };
  const sortCol = allowedSorts[sort] || 'l.created_at';
  const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const offset = (parseInt(page) - 1) * parseInt(limit);
  values.push(parseInt(limit), offset);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [listingsResult, countResult] = await Promise.all([
    pool.query(`
      SELECT
        l.id, l.title, l.type, l.price, l.bedrooms, l.bathrooms,
        l.area_sqm, l.neighbourhood, l.district, l.address,
        l.amenities, l.status, l.is_featured, l.views, l.available_from, l.created_at,
        u.name AS landlord_name, u.phone AS landlord_phone,
        (SELECT url FROM listing_images WHERE listing_id = l.id AND is_cover = true LIMIT 1) AS cover_image
      FROM listings l
      JOIN users u ON l.landlord_id = u.id
      ${whereClause}
      ORDER BY l.is_featured DESC, ${sortCol} ${sortDir}
      LIMIT $${idx++} OFFSET $${idx++}
    `, values),
    pool.query(`
      SELECT COUNT(*) FROM listings l ${whereClause}
    `, values.slice(0, -2)),
  ]);

  res.json({
    success: true,
    count: parseInt(countResult.rows[0].count),
    pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    page: parseInt(page),
    listings: listingsResult.rows,
  });
});

// GET /api/listings/:id — single listing with all images
const getListing = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(`
    SELECT
      l.*,
      u.id AS landlord_id, u.name AS landlord_name,
      u.phone AS landlord_phone, u.avatar_url AS landlord_avatar,
      u.is_verified AS landlord_verified
    FROM listings l
    JOIN users u ON l.landlord_id = u.id
    WHERE l.id = $1
  `, [id]);

  if (!result.rows.length) throw new AppError('Listing not found.', 404);

  const listing = result.rows[0];

  // Increment view count
  await pool.query('UPDATE listings SET views = views + 1 WHERE id = $1', [id]);

  // Get images
  const imagesResult = await pool.query(
    'SELECT id, url, is_cover FROM listing_images WHERE listing_id = $1 ORDER BY is_cover DESC',
    [id]
  );

  listing.images = imagesResult.rows;

  res.json({ success: true, listing });
});

// POST /api/listings — create listing (landlords only)
const createListing = asyncHandler(async (req, res) => {
  // 1. Destructure incoming body values (matching area_sqm to frontend area input)
  const {
    title, description, type, price, bedrooms, bathrooms,
    area, address, neighbourhood, district, amenities, available_from,
  } = req.body;

  // Safely grab the absolute area measurement value
  const areaValue = area || req.body.area_sqm;

  // 2. Extract dynamic file arrays from the structured req.files object
  const uploadedImages = req.files && req.files['images'] ? req.files['images'] : [];
  const uploadedVideo = req.files && req.files['video'] ? req.files['video'][0] : null;

  const videoUrl = uploadedVideo ? uploadedVideo.path : null;
  const videoPublicId = uploadedVideo ? uploadedVideo.filename : null;

  // 3. Insert core data along with video values directly into your main listings table
  // NOTE: If your listings table doesn't have video columns yet, run:
  // ALTER TABLE listings ADD COLUMN IF NOT EXISTS video_url TEXT, ADD COLUMN IF NOT EXISTS video_public_id TEXT;
  const result = await pool.query(`
    INSERT INTO listings
      (landlord_id, title, description, type, price, bedrooms, bathrooms,
       area_sqm, address, neighbourhood, district, amenities, available_from, 
       status, video_url, video_public_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15)
    RETURNING *
  `, [
    req.user.id, title, description, type, parseInt(price),
    parseInt(bedrooms), parseInt(bathrooms), areaValue ? parseInt(areaValue) : null,
    address, neighbourhood, district || 'Kampala',
    // Handle checking if amenities arrived as an array or a raw JSON string from frontend
    typeof amenities === 'string' && amenities.startsWith('[') ? JSON.parse(amenities) :
      (amenities ? (Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim())) : []),
    available_from || null,
    videoUrl,
    videoPublicId
  ]);

  const listing = result.rows[0];

  // 4. Safely unpack image items using the updated multi-field key grouping structure
  if (uploadedImages.length > 0) {
    const imageValues = uploadedImages.map((f, i) =>
      `('${listing.id}', '${f.path}', '${f.filename}', ${i === 0})`
    ).join(', ');

    await pool.query(`
      INSERT INTO listing_images (listing_id, url, public_id, is_cover) VALUES ${imageValues}
    `);
  }

  res.status(201).json({
    success: true,
    message: 'Listing submitted for review. It will go live within 24 hours.',
    listing,
  });
});

// PATCH /api/listings/:id — update listing
const updateListing = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
  if (!existing.rows.length) throw new AppError('Listing not found.', 404);

  const listing = existing.rows[0];
  if (listing.landlord_id !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this listing.', 403);
  }

  const allowed = ['title', 'description', 'type', 'price', 'bedrooms', 'bathrooms',
    'area_sqm', 'address', 'neighbourhood', 'district', 'amenities', 'available_from', 'status'];

  const fields = [];
  const values = [];
  let idx = 1;

  allowed.forEach(field => {
    if (req.body[field] !== undefined) {
      fields.push(`${field} = $${idx++}`);
      values.push(req.body[field]);
    }
  });

  if (!fields.length) throw new AppError('No valid fields to update.', 400);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE listings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  res.json({ success: true, listing: result.rows[0] });
});

// DELETE /api/listings/:id
const deleteListing = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
  if (!result.rows.length) throw new AppError('Listing not found.', 404);

  const listing = result.rows[0];
  if (listing.landlord_id !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized.', 403);
  }

  // Delete images from cloudinary
  const images = await pool.query('SELECT public_id FROM listing_images WHERE listing_id = $1', [id]);
  await Promise.all(images.rows.map(img => img.public_id && deleteImage(img.public_id)));

  await pool.query('DELETE FROM listings WHERE id = $1', [id]);

  res.json({ success: true, message: 'Listing deleted.' });
});

// POST /api/listings/:id/images — add images to existing listing
const addImages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const listing = await pool.query('SELECT landlord_id FROM listings WHERE id = $1', [id]);
  if (!listing.rows.length) throw new AppError('Listing not found.', 404);
  if (listing.rows[0].landlord_id !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized.', 403);
  }

  if (!req.files || !req.files.length) throw new AppError('No images uploaded.', 400);

  const hasExisting = await pool.query(
    'SELECT COUNT(*) FROM listing_images WHERE listing_id = $1', [id]
  );
  const existingCount = parseInt(hasExisting.rows[0].count);

  const imageValues = req.files.map((f, i) =>
    `('${id}', '${f.path}', '${f.filename}', ${existingCount === 0 && i === 0})`
  ).join(', ');

  await pool.query(`INSERT INTO listing_images (listing_id, url, public_id, is_cover) VALUES ${imageValues}`);

  res.json({ success: true, message: `${req.files.length} image(s) added.` });
});

// GET /api/listings/my — landlord's own listings
const getMyListings = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT l.*, 
      (SELECT url FROM listing_images WHERE listing_id = l.id AND is_cover = true LIMIT 1) AS cover_image,
      (SELECT COUNT(*) FROM enquiries WHERE listing_id = l.id) AS enquiry_count
    FROM listings l
    WHERE l.landlord_id = $1
    ORDER BY l.created_at DESC
  `, [req.user.id]);

  res.json({ success: true, listings: result.rows });
});

module.exports = { getListings, getListing, createListing, updateListing, deleteListing, addImages, getMyListings };
