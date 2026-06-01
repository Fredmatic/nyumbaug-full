const pool = require('./db');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running database migrations...');

    // Enable extensions first (outside transaction)
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await client.query('BEGIN');

    // ── USERS ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(120) NOT NULL,
        email       VARCHAR(180) UNIQUE NOT NULL,
        phone       VARCHAR(30),
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(20) NOT NULL DEFAULT 'tenant'
                    CHECK (role IN ('tenant', 'landlord', 'admin')),
        avatar_url  TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_active   BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── LISTINGS ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        landlord_id   UUID NOT NULL,
        title         VARCHAR(200) NOT NULL,
        description   TEXT NOT NULL,
        type          VARCHAR(30) NOT NULL
                      CHECK (type IN ('apartment','house','studio','townhouse','mansion')),
        price         INTEGER NOT NULL,
        bedrooms      INTEGER NOT NULL,
        bathrooms     INTEGER NOT NULL,
        area_sqm      INTEGER,
        address       TEXT NOT NULL,
        neighbourhood VARCHAR(100) NOT NULL,
        district      VARCHAR(100) NOT NULL DEFAULT 'Kampala',
        latitude      DECIMAL(10, 8),
        longitude     DECIMAL(11, 8),
        amenities     TEXT[] DEFAULT '{}',
        status        VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','active','rented','inactive')),
        is_featured   BOOLEAN DEFAULT FALSE,
        available_from DATE,
        views         INTEGER DEFAULT 0,
        video_url     TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── LISTING IMAGES ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS listing_images (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id  UUID NOT NULL,
        url         TEXT NOT NULL,
        public_id   TEXT,
        is_cover    BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── ENQUIRIES ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id  UUID NOT NULL,
        tenant_id   UUID,
        name        VARCHAR(120) NOT NULL,
        email       VARCHAR(180),
        phone       VARCHAR(30) NOT NULL,
        message     TEXT NOT NULL,
        status      VARCHAR(20) DEFAULT 'new'
                    CHECK (status IN ('new','read','replied','closed')),
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── MESSAGES ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id   UUID NOT NULL,
        receiver_id UUID NOT NULL,
        listing_id  UUID,
        body        TEXT NOT NULL,
        is_read     BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── SAVED LISTINGS ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_listings (
        user_id     UUID NOT NULL,
        listing_id  UUID NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, listing_id)
      );
    `);

    // ── ADD FOREIGN KEYS AFTER ALL TABLES EXIST ──
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE listings ADD CONSTRAINT fk_listings_landlord
          FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE listing_images ADD CONSTRAINT fk_images_listing
          FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE enquiries ADD CONSTRAINT fk_enquiries_listing
          FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE enquiries ADD CONSTRAINT fk_enquiries_tenant
          FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE messages ADD CONSTRAINT fk_messages_sender
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE messages ADD CONSTRAINT fk_messages_receiver
          FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE saved_listings ADD CONSTRAINT fk_saved_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE saved_listings ADD CONSTRAINT fk_saved_listing
          FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── INDEXES ──
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_status       ON listings(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_neighbourhood ON listings(neighbourhood);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_type         ON listings(type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_price        ON listings(price);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_landlord     ON listings(landlord_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enquiries_listing     ON enquiries(listing_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver     ON messages(receiver_id);`);

    // ── SUBSCRIPTIONS ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan        VARCHAR(20) NOT NULL DEFAULT 'monthly',
        amount      INTEGER NOT NULL DEFAULT 100000,
        expires_at  TIMESTAMPTZ NOT NULL,
        payment_id  UUID,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── NOTIFICATIONS ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        VARCHAR(40) NOT NULL DEFAULT 'info',
        message     TEXT NOT NULL,
        listing_id  UUID,
        is_read     BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`);

    await client.query('COMMIT');
    console.log('✅ All tables created successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
