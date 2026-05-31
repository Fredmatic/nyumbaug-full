const pool = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/error');
const { deleteImage } = require('../middleware/uploadConfig');

// =========================================================================
// 1. GET /api/listings — search & filter
// =========================================================================
const getListings = asyncHandler(async (req, res) => {
  try {
    // 1. Extract query params from frontend search bars
    const { district, neighbourhood, type, minPrice, maxPrice } = req.query;

    let queryText = 'SELECT * FROM listings WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // 2. Case-Insensitive District Filter
    if (district && district.trim() !== '') {
      queryText += ` AND district ILIKE $${paramIndex}`;
      queryParams.push(`%${district.trim()}%`);
      paramIndex++;
    }

    // 3. Case-Insensitive Neighbourhood Filter
    if (neighbourhood && neighbourhood.trim() !== '') {
      queryText += ` AND neighbourhood ILIKE $${paramIndex}`;
      queryParams.push(`%${neighbourhood.trim()}%`);
      paramIndex++;
    }

    // 4. Property Type Filter (e.g., Apartment, House)
    if (type && type.trim() !== '' && type !== 'all') {
      queryText += ` AND type = $${paramIndex}`;
      queryParams.push(type.trim());
      paramIndex++;
    }

    // 5. Minimum Price Filter
    if (minPrice && !isNaN(minPrice) && minPrice !== '') {
      queryText += ` AND price >= $${paramIndex}`;
      queryParams.push(parseInt(minPrice));
      paramIndex++;
    }

    // 6. Maximum Price Filter
    if (maxPrice && !isNaN(maxPrice) && maxPrice !== '') {
      queryText += ` AND price <= $${paramIndex}`;
      queryParams.push(parseInt(maxPrice));
      paramIndex++;
    }

    // Always sort by newest first
    queryText += ' ORDER BY created_at DESC';

    const result = await pool.query(queryText, queryParams);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error("Search Filter Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// 2. GET /api/listings/:id — single listing with all images
// =========================================================================
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

const createListing = asyncHandler(async (req, res) => {
  // 1. Extract safely, accommodating frontend naming mismatches
  const titleRaw = req.body.title;
  const descriptionRaw = req.body.description;
  const typeRaw = req.body.type;
  const priceRaw = req.body.price;
  const bedroomsRaw = req.body.bedrooms;
  const bathroomsRaw = req.body.bathrooms;
  const areaRaw = req.body.area;
  const addressRaw = req.body.address;
  const districtRaw = req.body.district;
  const availableRaw = req.body.available_from;
  const amenitiesRaw = req.body.amenities;

  // Handle both UK and US spelling variations smoothly!
  const neighborhoodValue = req.body.neighbourhood || req.body.neighborhood || 'Kampala';

  // 2. Sanitize and fall back properly if text is missing or blank
  let computedTitle = titleRaw && titleRaw.trim() !== "" ? titleRaw.trim() : "";
  if (!computedTitle) {
    const formattedType = typeRaw ? typeRaw.trim() : 'Property';
    const bedsText = bedroomsRaw ? `${bedroomsRaw} Bed` : '';
    computedTitle = `${bedsText} ${formattedType} for Rent in ${neighborhoodValue}`.trim();
  }

  // 3. Robust Number Parsing to eliminate "UGX 0" errors
  const parsedPrice = parseInt(priceRaw, 10) ? parseInt(priceRaw, 10) : 0;
  const parsedBedrooms = parseInt(bedroomsRaw, 10) ? parseInt(bedroomsRaw, 10) : 0;
  const parsedBathrooms = parseInt(bathroomsRaw, 10) ? parseInt(bathroomsRaw, 10) : 0;
  const parsedArea = areaRaw && areaRaw !== "" ? parseInt(areaRaw, 10) : null;

  // Media files extraction checks
  const uploadedImages = req.files && req.files['images'] ? req.files['images'] : [];
  const uploadedVideo = req.files && req.files['video'] ? req.files['video'][0] : null;
  const videoUrl = uploadedVideo ? uploadedVideo.path : null;
  const videoPublicId = uploadedVideo ? uploadedVideo.filename : null;

  // DB integer to standard format tracking string
  const rawId = String(req.user.id || '0');
  const parsedLandlordId = rawId.includes('-') ? rawId : `00000000-0000-0000-0000-${rawId.padStart(12, '0')}`;

  // 4. Secure DB injection using finalized clean parameters
  const result = await pool.query(`
    // ── INJECT THIS CLEANUP BLOCK ABOVE YOUR DATABASE QUERY ──
let finalType = 'apartment'; // default fallback
if (typeRaw) {
  const checkType = typeRaw.trim().toLowerCase();
  
  if (checkType.includes('apartment')) {
    finalType = 'apartment';
  } else if (checkType.includes('house') || checkType.includes('bungalow') || checkType.includes('mansion')) {
    finalType = 'house';
  } else if (checkType.includes('studio') || checkType.includes('room')) {
    finalType = 'studio';
  } else if (checkType.includes('townhouse')) {
    finalType = 'townhouse';
  } else {
    finalType = 'apartment'; 
  }
}
    INSERT INTO listings
      (landlord_id, title, description, type, price, bedrooms, bathrooms,
       area_sqm, address, neighbourhood, district, amenities, available_from, 
       status, video_url, video_public_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $15)
    RETURNING *
  `, [
    parsedLandlordId,                        // $1
    computedTitle,                           // $2
    descriptionRaw || 'No description.',     // $3
    finalType,                  // $4
    parsedPrice,                             // $5
    parsedBedrooms,                          // $6
    parsedBathrooms,                         // $7
    parsedArea,                              // $8
    addressRaw || 'Kampala',                 // $9
    neighborhoodValue,                       // $10
    districtRaw || 'Kampala',                // $11
    typeof amenitiesRaw === 'string' && amenitiesRaw.startsWith('[') ? JSON.parse(amenitiesRaw) :
      (amenitiesRaw ? (Array.isArray(amenitiesRaw) ? amenitiesRaw : amenitiesRaw.split(',').map(a => a.trim())) : []), // $12
    availableRaw || null,                    // $13
    videoUrl,                                // $14
    videoPublicId                            // $15
  ]);

  const listing = result.rows[0];

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
    message: 'Listing completed successfully!',
    listing,
  });
});
// =========================================================================
// 4. PATCH /api/listings/:id — update listing
// =========================================================================
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

// =========================================================================
// 5. DELETE /api/listings/:id
// =========================================================================
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

// =========================================================================
// 6. POST /api/listings/:id/images — add images to existing listing
// =========================================================================
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

// =========================================================================
// 7. GET /api/listings/my — landlord's own listings
// =========================================================================
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