// seed.js — Only creates the admin user. 
// All property listings must be created by landlords via the platform.
const pool = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding admin account...');
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash('admin1234', 10);

    await client.query(`
      INSERT INTO users (name, email, phone, password, role, is_verified, is_active)
      VALUES ('Admin', 'admin@nyumbaug.com', '+256700000000', $1, 'admin', true, true)
      ON CONFLICT (email) DO NOTHING
    `, [passwordHash]);

    await client.query('COMMIT');
    console.log('✅ Admin seeded. Login: admin@nyumbaug.com / admin1234');
    console.log('ℹ️  All property listings must be created by landlords via the platform.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
