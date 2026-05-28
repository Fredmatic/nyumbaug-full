const pool = require('./db');

async function migrateReviews() {
    const client = await pool.connect();

    try {
        console.log('🔄 Running reviews migration...');

        await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        tenant_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title       VARCHAR(120),
        body        TEXT NOT NULL,
        status      VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'flagged')),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (listing_id, tenant_id)
      );
    `);

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_tenant  ON reviews(tenant_id);
    `);

        console.log('✅ Reviews table created successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

migrateReviews();