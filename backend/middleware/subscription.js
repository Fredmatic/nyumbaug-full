// backend/middleware/subscription.js
// NEW FILE — Place at: nyumba-ug/backend/middleware/subscription.js

const pool = require('../config/db');

// ── requireSubscription ──
// Use on any route that needs an active paid plan
// e.g. router.post('/listings', protect, requireSubscription, createListing)
const requireSubscription = async (req, res, next) => {
    if (req.user.role !== 'landlord') return next(); // admins/tenants skip

    try {
        const result = await pool.query(`
      SELECT sp.name AS plan_name, sp.max_listings, ls.expires_at
      FROM landlord_subscriptions ls
      JOIN subscription_plans sp ON sp.id = ls.plan_id
      WHERE ls.landlord_id = $1 AND ls.status = 'active'
      LIMIT 1
    `, [req.user.id]);

        if (!result.rows.length) {
            return res.status(403).json({
                success: false,
                code: 'NO_SUBSCRIPTION',
                message: 'You need an active subscription to perform this action.'
            });
        }

        const sub = result.rows[0];

        // Check expiry (free plan has no expiry)
        if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
            return res.status(403).json({
                success: false,
                code: 'SUBSCRIPTION_EXPIRED',
                message: 'Your subscription has expired. Please renew to continue.'
            });
        }

        req.subscription = sub; // attach to request for use in controllers
        next();
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── checkListingLimit ──
// Use before creating a listing to enforce plan limits
const checkListingLimit = async (req, res, next) => {
    if (req.user.role !== 'landlord') return next();

    try {
        const sub = req.subscription; // set by requireSubscription above
        if (!sub) return next();

        const countResult = await pool.query(
            "SELECT COUNT(*) FROM listings WHERE landlord_id = $1 AND status != 'deleted'",
            [req.user.id]
        );
        const count = parseInt(countResult.rows[0].count);

        if (count >= sub.max_listings) {
            return res.status(403).json({
                success: false,
                code: 'LISTING_LIMIT_REACHED',
                message: `Your ${sub.plan_name} plan allows up to ${sub.max_listings} listing(s). Upgrade to add more.`,
                currentCount: count,
                maxListings: sub.max_listings
            });
        }
        next();
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { requireSubscription, checkListingLimit };