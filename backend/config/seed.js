const pool = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');
    await client.query('BEGIN');

    // Sample landlords
    const passwordHash = await bcrypt.hash('password123', 10);

    const landlords = await client.query(`
      INSERT INTO users (name, email, phone, password, role, is_verified)
      VALUES
        ('Ssaazi Fred',  'fssaazi46@gmail.com',  '+256740193837', $1, 'landlord', true),
        ('Jane Momo',    'janemomo@.com',  '+256766513833', $1, 'landlord', true),
        ('Dr. Claude Martins','martins@gmail.com', '+256744541025', $1, 'landlord', true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name
    `, [passwordHash]);

    console.log(`   ✔ Created ${landlords.rows.length} landlords`);

    // Sample tenant
    await client.query(`
      INSERT INTO users (name, email, phone, password, role, is_verified)
      VALUES ('Joshua nduhura', 'joshvfx@gmail.com', '+256759514123', $1, 'tenant', true)
      ON CONFLICT (email) DO NOTHING
    `, [passwordHash]);

    if (landlords.rows.length > 0) {
      const [fred, momo, claude] = landlords.rows;

      const listingsData = [
        {
          landlord_id: fred.id,
          title: 'Modern 3-Bedroom Apartment',
          description: 'Spacious modern apartment in the heart of Kololo with stunning city views, fully fitted kitchen, and 24/7 security.',
          type: 'apartment', price: 1800000, bedrooms: 3, bathrooms: 2, area_sqm: 140,
          address: 'Plot 14, Kololo Hill Drive', neighbourhood: 'Kololo', district: 'Kampala',
          amenities: ['WiFi', 'Parking', 'Generator', 'Security', 'Water Tank', 'Balcony'],
          status: 'active', is_featured: true,
        },
        {
          landlord_id: momo.id,
          title: 'Executive 2-Bedroom Flat',
          description: 'Well-maintained executive flat in quiet Bugolobi estate. Ideal for professionals and small families.',
          type: 'apartment', price: 1200000, bedrooms: 2, bathrooms: 2, area_sqm: 95,
          address: 'Plot 7, Bugolobi Estate', neighbourhood: 'Bugolobi', district: 'Kampala',
          amenities: ['Parking', 'Security', 'Water Tank'],
          status: 'active', is_featured: true,
        },
        {
          landlord_id: fred.id,
          title: 'Self-Contained Studio',
          description: 'Cozy self-contained studio perfect for a single professional. Close to Ntinda market and major roads.',
          type: 'studio', price: 450000, bedrooms: 1, bathrooms: 1, area_sqm: 35,
          address: 'Ntinda Road, off Najjera', neighbourhood: 'Ntinda', district: 'Kampala',
          amenities: ['Water Tank', 'Security'],
          status: 'active', is_featured: false,
        },
        {
          landlord_id: claude.id,
          title: 'Spacious Family Home',
          description: 'Beautiful standalone house with large garden in prestigious Muyenga. Perfect for families who value space and privacy.',
          type: 'house', price: 3500000, bedrooms: 5, bathrooms: 3, area_sqm: 280,
          address: 'Tank Hill Road, Muyenga', neighbourhood: 'Muyenga', district: 'Kampala',
          amenities: ['WiFi', 'Parking', 'Generator', 'Security', 'Garden', 'Water Tank', 'DSTV'],
          status: 'active', is_featured: true,
        },
        {
          landlord_id: momo.id,
          title: 'Luxury 4-Bedroom Duplex',
          description: 'Prestigious duplex apartment in Naguru with panoramic views of Kampala. High-end finishes throughout.',
          type: 'apartment', price: 4200000, bedrooms: 4, bathrooms: 3, area_sqm: 220,
          address: 'Naguru Drive, Plot 9', neighbourhood: 'Naguru', district: 'Kampala',
          amenities: ['WiFi', 'Parking', 'Generator', 'Security', 'Swimming Pool', 'Gym', 'Water Tank'],
          status: 'active', is_featured: true,
        },
      ];

      for (const l of listingsData) {
        await client.query(`
          INSERT INTO listings
            (landlord_id, title, description, type, price, bedrooms, bathrooms,
             area_sqm, address, neighbourhood, district, amenities, status, is_featured)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `, [
          l.landlord_id, l.title, l.description, l.type, l.price,
          l.bedrooms, l.bathrooms, l.area_sqm, l.address,
          l.neighbourhood, l.district, l.amenities, l.status, l.is_featured
        ]);
      }

      console.log(`   ✔ Created ${listingsData.length} listings`);
    }

    await client.query('COMMIT');
    console.log('✅ Database seeded! Login: fssaazi46@gmail.com / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
