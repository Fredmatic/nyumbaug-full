const pool = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/error');
const { deleteImage } = require('../middleware/uploadConfig');

// =========================================================================
// 1. GET /api/listings — get all listings, ordered by payment + reviews
// =========================================================================
const getListings = asyncHandler(async (req, res) => {
  try {
    const { district, neighbourhood, type, minPrice, maxPrice } = req.query;

    let queryText = `
      SELECT l.*,
        u.is_verified_landlord,
        li.url AS cover_image,
        COALESCE(rv.review_count, 0) AS review_count,
        COALESCE(rv.avg_rating, 0) AS avg_rating,
        COALESCE(s.has_active_subscription, 0) AS has_active_subscription
      FROM listings l
      LEFT JOIN users u ON l.landlord_id = u.id
      LEFT JOIN LATERAL (
        SELECT url FROM listing_images
        WHERE listing_id = l.id AND is_cover = true
        LIMIT 1
      ) li ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS review_count,
          AVG(rating) AS avg_rating
        FROM reviews
        WHERE listing_id = l.id
      ) rv ON true
      LEFT JOIN LATERAL (
        SELECT CASE WHEN expires_at > NOW() THEN 1 ELSE 0 END AS has_active_subscription
        FROM subscriptions
        WHERE user_id::uuid = l.landlord_id::uuid
        ORDER BY expires_at DESC
        LIMIT 1
      ) s ON true
      WHERE l.status != 'inactive'
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (district && district.trim() !== '') {
      queryText += ` AND district ILIKE $${paramIndex}`;
      queryParams.push(`%${district.trim()}%`);
      paramIndex++;
    }

    if (neighbourhood && neighbourhood.trim() !== '') {
      queryText += ` AND neighbourhood ILIKE $${paramIndex}`;
      queryParams.push(`%${neighbourhood.trim()}%`);
      paramIndex++;
    }

    if (type && type.trim() !== '' && type !== 'all') {
      queryText += ` AND type = $${paramIndex}`;
      queryParams.push(type.trim());
      paramIndex++;
    }

    if (minPrice && !isNaN(minPrice) && minPrice !== '') {
      queryText += ` AND price >= $${paramIndex}`;
      queryParams.push(parseInt(minPrice));
      paramIndex++;
    }

    if (maxPrice && !isNaN(maxPrice) && maxPrice !== '') {
      queryText += ` AND price <= $${paramIndex}`;
      queryParams.push(parseInt(maxPrice));
      paramIndex++;
    }

    // Order: paid/active subscription first, then by review count, then by date
    queryText += `
      ORDER BY 
        has_active_subscription DESC,
        review_count DESC,
        avg_rating DESC,
        l.created_at DESC
    `;

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
// 2. GET /api/listings/:id
// =========================================================================
const getListing = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const parsedId = id.includes('-')
    ? id
    : `00000000-0000-0000-0000-${id.padStart(12, '0')}`;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(parsedId)) {
    throw new AppError('Invalid property ID format.', 400);
  }

  // Locate this section in your getListing function
  const result = await pool.query(`
    SELECT 
      l.*, 
      u.name AS landlord_name, 
      u.email AS landlord_email, 
      u.phone AS landlord_phone,
      COALESCE(
        json_agg(
          json_build_object('url', li.url)
        ) FILTER (WHERE li.url IS NOT NULL), 
        '[]'
      ) AS images
    FROM listings l
    LEFT JOIN users u ON l.landlord_id = u.id
    LEFT JOIN listing_images li ON l.id = li.listing_id
    WHERE l.id::text = $1  -- <--- Ensure this cast is here
    GROUP BY l.id, u.id
  `, [parsedId]); // Ensure parsedId is the correct string value

  if (!result.rows.length) {
    throw new AppError('Property listing not found.', 404);
  }

  res.status(200).json({
    success: true,
    data: result.rows[0]
  });
});

// =========================================================================
// 3. POST /api/listings — landlord creates listing
// =========================================================================
const createListing = asyncHandler(async (req, res) => {
  // Only landlords can create listings
  if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
    throw new AppError('Only landlords can create listings.', 403);
  }

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

  const neighborhoodValue = req.body.neighbourhood || req.body.neighborhood || 'Kampala';

  let finalType = 'apartment';
  if (typeRaw) {
    const checkType = typeRaw.trim().toLowerCase();
    if (checkType.includes('apartment')) finalType = 'apartment';
    else if (checkType.includes('house') || checkType.includes('bungalow') || checkType.includes('mansion')) finalType = 'house';
    else if (checkType.includes('studio') || checkType.includes('room')) finalType = 'studio';
    else if (checkType.includes('townhouse')) finalType = 'townhouse';
  }

  let computedTitle = titleRaw && titleRaw.trim() !== "" ? titleRaw.trim() : "";
  if (!computedTitle) {
    const formattedType = finalType.charAt(0).toUpperCase() + finalType.slice(1);
    const bedsText = bedroomsRaw ? `${bedroomsRaw} Bed` : '';
    computedTitle = `${bedsText} ${formattedType} for Rent in ${neighborhoodValue}`.trim();
  }

  const parsedPrice = parseInt(priceRaw, 10) || 0;
  const parsedBedrooms = parseInt(bedroomsRaw, 10) || 0;
  const parsedBathrooms = parseInt(bathroomsRaw, 10) || 0;
  const parsedArea = areaRaw && areaRaw !== "" ? parseInt(areaRaw, 10) : null;

  const uploadedImages = req.files && req.files['images'] ? req.files['images'] : [];
  const uploadedVideo = req.files && req.files['video'] ? req.files['video'][0] : null;
  const videoUrl = uploadedVideo ? uploadedVideo.path : null;
  const videoPublicId = uploadedVideo ? uploadedVideo.filename : null;

  const rawId = String(req.user.id || '0');
  const parsedLandlordId = rawId.includes('-') ? rawId : `00000000-0000-0000-0000-${rawId.padStart(12, '0')}`;

  const result = await pool.query(`
    INSERT INTO listings
      (landlord_id, title, description, type, price, bedrooms, bathrooms,
       area_sqm, address, neighbourhood, district, amenities, available_from, 
       status, video_url, video_public_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $15)
    RETURNING *
  `, [
    parsedLandlordId,
    computedTitle,
    descriptionRaw || 'No description.',
    finalType,
    parsedPrice,
    parsedBedrooms,
    parsedBathrooms,
    parsedArea,
    addressRaw || 'Kampala',
    neighborhoodValue,
    districtRaw || 'Kampala',
    typeof amenitiesRaw === 'string' && amenitiesRaw.startsWith('[') ? JSON.parse(amenitiesRaw) :
      (amenitiesRaw ? (Array.isArray(amenitiesRaw) ? amenitiesRaw : amenitiesRaw.split(',').map(a => a.trim())) : []),
    availableRaw || null,
    videoUrl,
    videoPublicId
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
    message: 'Listing submitted for review!',
    listing,
  });
});

// =========================================================================
// 4. PATCH /api/listings/:id — update listing
// =========================================================================
const updateListing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const existing = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
  if (!existing.rows.length) throw new AppError('Listing not found.', 404);

  const listing = existing.rows[0];
  if (listing.landlord_id !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized.', 403);
  }

  const allowedStatuses = ['active', 'rented', 'inactive', 'pending'];
  if (status && !allowedStatuses.includes(status)) {
    throw new AppError('Invalid status.', 400);
  }

  const result = await pool.query(
    'UPDATE listings SET status = COALESCE($1, status), updated_at = NOW() WHERE id = $2 RETURNING *',
    [status || null, id]
  );

  // If marked as rented, notify admin
  if (status === 'rented') {
    await pool.query(`
      INSERT INTO notifications (user_id, type, message, listing_id)
      SELECT id, 'rented', $1, $2 FROM users WHERE role = 'admin'
    `, [`Property "${listing.title}" has been rented.`, id]).catch(() => { });
  }

  res.status(200).json({
    success: true,
    message: `Listing updated.`,
    listing: result.rows[0]
  });
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

  const images = await pool.query('SELECT public_id FROM listing_images WHERE listing_id = $1', [id]);
  await Promise.all(images.rows.map(img => img.public_id && deleteImage(img.public_id)));

  await pool.query('DELETE FROM listings WHERE id = $1', [id]);
  res.json({ success: true, message: 'Listing deleted.' });
});

// =========================================================================
// 6. POST /api/listings/:id/images
// =========================================================================
const addImages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const listing = await pool.query('SELECT landlord_id FROM listings WHERE id = $1', [id]);
  if (!listing.rows.length) throw new AppError('Listing not found.', 404);
  if (listing.rows[0].landlord_id !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized.', 403);
  }

  if (!req.files || !req.files.length) throw new AppError('No images uploaded.', 400);

  const hasExisting = await pool.query('SELECT COUNT(*) FROM listing_images WHERE listing_id = $1', [id]);
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
  const landlordId = req.user.id;

  const result = await pool.query(`
    SELECT l.*, 
      (SELECT url FROM listing_images WHERE listing_id = l.id AND is_cover = true LIMIT 1) AS cover_image,
      COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.listing_id = l.id), 0) AS review_count
    FROM listings l
    WHERE l.landlord_id = $1
    ORDER BY l.created_at DESC
  `, [landlordId]);

  res.json({ success: true, listings: result.rows });
});

// =========================================================================
// 8. POST /api/listings/:id/like — tenant likes/saves a listing
// =========================================================================
const likeListing = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get the listing to find the landlord
  const listingResult = await pool.query('SELECT landlord_id, title FROM listings WHERE id = $1', [id]);
  if (!listingResult.rows.length) {
    return res.json({ success: true }); // silent fail
  }

  const { landlord_id, title } = listingResult.rows[0];
  const tenantName = req.user?.name || 'A tenant';

  // Create notification for the landlord
  await pool.query(`
    INSERT INTO notifications (user_id, type, message, listing_id, created_at)
    VALUES ($1, 'like', $2, $3, NOW())
    ON CONFLICT DO NOTHING
  `, [landlord_id, `${tenantName} saved your property: "${title}"`, id]).catch(() => { });

  res.json({ success: true });
});

module.exports = {
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  addImages,
  getMyListings,
  likeListing,
};
