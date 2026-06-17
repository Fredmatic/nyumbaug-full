// backend/routes/subscriptions.js
// NEW FILE — Place at: nyumba-ug/backend/routes/subscriptions.js

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

// ── GET /api/subscriptions/plans ──
// Public: returns all available plans
router.get('/plans', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM subscription_plans ORDER BY price_ugx ASC'
        );
        res.json({ success: true, plans: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/subscriptions/my ──
// Landlord: get their current active subscription + plan details
router.get('/my', protect, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        ls.id, ls.status, ls.started_at, ls.expires_at, ls.auto_renew,
        sp.name AS plan_name,
        sp.display_name,
        sp.price_ugx,
        sp.max_listings,
        sp.featured_listings,
        sp.can_chat,
        sp.can_view_analytics,
        sp.verification_badge,
        sp.description
      FROM landlord_subscriptions ls
      JOIN subscription_plans sp ON sp.id = ls.plan_id
      WHERE ls.landlord_id = $1 AND ls.status = 'active'
      LIMIT 1
    `, [req.user.id]);

        if (!result.rows.length) {
            // Auto-assign free plan if none exists
            const freePlan = await pool.query(
                "SELECT id FROM subscription_plans WHERE name = 'free'"
            );
            if (freePlan.rows.length) {
                await pool.query(`
          INSERT INTO landlord_subscriptions (landlord_id, plan_id, status)
          VALUES ($1, $2, 'active')
        `, [req.user.id, freePlan.rows[0].id]);
                return res.json({
                    success: true,
                    subscription: { plan_name: 'free', display_name: 'Free', price_ugx: 0, max_listings: 1, can_chat: false, can_view_analytics: false, verification_badge: false, status: 'active' }
                });
            }
            return res.json({ success: true, subscription: null });
        }

        res.json({ success: true, subscription: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/subscriptions/upgrade ──
// Landlord: manually upgrade to a plan (called after payment is confirmed)
router.post('/upgrade', protect, authorize('landlord'), async (req, res) => {
    const { plan_name, months = 1, payment_reference } = req.body;
    if (!plan_name) return res.status(400).json({ success: false, message: 'plan_name is required.' });

    try {
        const planResult = await pool.query(
            'SELECT * FROM subscription_plans WHERE name = $1', [plan_name]
        );
        if (!planResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Plan not found.' });
        }
        const plan = planResult.rows[0];

        // Calculate expiry
        const expiresAt = plan.price_ugx === 0 ? null : new Date();
        if (expiresAt) expiresAt.setMonth(expiresAt.getMonth() + parseInt(months));

        // Deactivate old subscription
        await pool.query(
            "UPDATE landlord_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE landlord_id = $1 AND status = 'active'",
            [req.user.id]
        );

        // Insert new subscription
        const sub = await pool.query(`
      INSERT INTO landlord_subscriptions (landlord_id, plan_id, status, expires_at)
      VALUES ($1, $2, 'active', $3)
      RETURNING *
    `, [req.user.id, plan.id, expiresAt]);

        // Log payment record if reference provided
        if (payment_reference) {
            await pool.query(`
        INSERT INTO subscription_payments (landlord_id, subscription_id, plan_id, amount_ugx, payment_reference, status, paid_at)
        VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
      `, [req.user.id, sub.rows[0].id, plan.id, plan.price_ugx * months, payment_reference]).catch(() => { });
        }

        // Reactivate listings if they were paused
        await pool.query(
            "UPDATE listings SET status = 'active', updated_at = NOW() WHERE landlord_id = $1 AND status = 'inactive'",
            [req.user.id]
        ).catch(() => { });

        // Notify landlord
        await pool.query(`
      INSERT INTO notifications (user_id, type, message)
      VALUES ($1, 'subscription', $2)
    `, [
            req.user.id,
            `✅ You are now on the ${plan.display_name} plan${expiresAt ? ` until ${expiresAt.toLocaleDateString('en-UG')}` : ''}. Enjoy your listings!`
        ]).catch(() => { });

        res.json({
            success: true,
            message: `Upgraded to ${plan.display_name} plan successfully.`,
            subscription: { ...sub.rows[0], plan_name: plan.name, display_name: plan.display_name, expires_at: expiresAt }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/subscriptions/check-limit ──
// Landlord: check if they can add another listing
router.get('/check-limit', protect, async (req, res) => {
    try {
        const subResult = await pool.query(`
      SELECT sp.max_listings
      FROM landlord_subscriptions ls
      JOIN subscription_plans sp ON sp.id = ls.plan_id
      WHERE ls.landlord_id = $1 AND ls.status = 'active'
      LIMIT 1
    `, [req.user.id]);

        const maxListings = subResult.rows[0]?.max_listings ?? 1;

        const countResult = await pool.query(
            "SELECT COUNT(*) FROM listings WHERE landlord_id = $1 AND status != 'deleted'",
            [req.user.id]
        );
        const currentCount = parseInt(countResult.rows[0].count);
        const canAdd = currentCount < maxListings;

        res.json({ success: true, canAdd, currentCount, maxListings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Admin: GET /api/subscriptions/all ──
router.get('/all', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT ls.*, u.name, u.email, sp.display_name AS plan_display, sp.price_ugx
      FROM landlord_subscriptions ls
      JOIN users u ON u.id = ls.landlord_id
      JOIN subscription_plans sp ON sp.id = ls.plan_id
      ORDER BY ls.created_at DESC
    `);
        res.json({ success: true, subscriptions: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// ═══════════════════════════════════════════════════
// ADD THIS BLOCK TO backend/routes/subscriptions.js
// Place it ABOVE the line: module.exports = router;
// ═══════════════════════════════════════════════════

// ── Admin: POST /api/subscriptions/admin/upgrade ──
// Admin manually activates/changes a landlord's plan after confirming
// payment via MoMo, Airtel Money, bank transfer, or WhatsApp proof.
router.post('/admin/upgrade', protect, authorize('admin'), async (req, res) => {
    const { landlord_id, plan_name, months = 1, payment_reference, notes } = req.body;

    if (!landlord_id || !plan_name) {
        return res.status(400).json({
            success: false,
            message: 'landlord_id and plan_name are required.'
        });
    }

    try {
        // 1. Confirm the target user exists and is a landlord
        const userResult = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = $1',
            [landlord_id]
        );
        if (!userResult.rows.length) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const targetUser = userResult.rows[0];
        if (targetUser.role !== 'landlord') {
            return res.status(400).json({ success: false, message: 'This user is not a landlord.' });
        }

        // 2. Confirm the plan exists
        const planResult = await pool.query(
            'SELECT * FROM subscription_plans WHERE name = $1',
            [plan_name]
        );
        if (!planResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Plan not found.' });
        }
        const plan = planResult.rows[0];

        // 3. Calculate expiry (free plan never expires)
        const expiresAt = plan.price_ugx === 0 ? null : new Date();
        if (expiresAt) expiresAt.setMonth(expiresAt.getMonth() + parseInt(months));

        // 4. Deactivate any existing active subscription for this landlord
        await pool.query(
            "UPDATE landlord_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE landlord_id = $1 AND status = 'active'",
            [landlord_id]
        );

        // 5. Insert the new active subscription
        const sub = await pool.query(`
            INSERT INTO landlord_subscriptions (landlord_id, plan_id, status, expires_at)
            VALUES ($1, $2, 'active', $3)
            RETURNING *
        `, [landlord_id, plan.id, expiresAt]);

        // 6. Log the payment record (manual admin-confirmed payment)
        await pool.query(`
            INSERT INTO subscription_payments
                (landlord_id, subscription_id, plan_id, amount_ugx, payment_reference, status, paid_at, notes, confirmed_by_admin_id)
            VALUES ($1, $2, $3, $4, $5, 'completed', NOW(), $6, $7)
        `, [
            landlord_id,
            sub.rows[0].id,
            plan.id,
            plan.price_ugx * months,
            payment_reference || `MANUAL-${Date.now()}`,
            notes || 'Manually activated by admin',
            req.user.id
        ]).catch(() => { /* table/columns may not exist yet — non-blocking */ });

        // 7. Reactivate any paused listings for this landlord
        await pool.query(
            "UPDATE listings SET status = 'active', updated_at = NOW() WHERE landlord_id = $1 AND status = 'inactive'",
            [landlord_id]
        ).catch(() => { });

        // 8. Notify the landlord
        await pool.query(`
            INSERT INTO notifications (user_id, type, message)
            VALUES ($1, 'subscription', $2)
        `, [
            landlord_id,
            `🎉 Your subscription has been activated on the ${plan.display_name} plan${expiresAt ? ` until ${expiresAt.toLocaleDateString('en-UG')}` : ''}. Thank you for your payment!`
        ]).catch(() => { });

        res.json({
            success: true,
            message: `${targetUser.name} upgraded to ${plan.display_name} plan successfully.`,
            subscription: {
                ...sub.rows[0],
                plan_name: plan.name,
                display_name: plan.display_name,
                expires_at: expiresAt
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Admin: GET /api/subscriptions/admin/landlords ──
// Returns every landlord with their current plan, for the admin Subscriptions tab
router.get('/admin/landlords', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                u.id, u.name, u.email, u.phone, u.created_at,
                ls.status AS sub_status,
                ls.expires_at,
                sp.name AS plan_name,
                sp.display_name AS plan_display,
                sp.price_ugx
            FROM users u
            LEFT JOIN landlord_subscriptions ls
                ON ls.landlord_id = u.id AND ls.status = 'active'
            LEFT JOIN subscription_plans sp
                ON sp.id = ls.plan_id
            WHERE u.role = 'landlord'
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, landlords: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Admin: GET /api/subscriptions/admin/payments ──
// Returns recent manually-confirmed payments for an audit trail
router.get('/admin/payments', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                sp_pay.id, sp_pay.amount_ugx, sp_pay.payment_reference,
                sp_pay.status, sp_pay.paid_at, sp_pay.notes,
                u.name AS landlord_name, u.email AS landlord_email,
                plan.display_name AS plan_display
            FROM subscription_payments sp_pay
            JOIN users u ON u.id = sp_pay.landlord_id
            JOIN subscription_plans plan ON plan.id = sp_pay.plan_id
            ORDER BY sp_pay.paid_at DESC
            LIMIT 50
        `);
        res.json({ success: true, payments: result.rows });
    } catch (err) {
        // Table may not exist yet if no payments logged — return empty instead of crashing
        res.json({ success: true, payments: [] });
    }
});

module.exports = router;