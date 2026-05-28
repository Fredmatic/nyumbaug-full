const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

// ── AUTH HELPER ──
async function getUser(req) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return null;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = $1 AND is_active = true',
            [decoded.id]
        );
        return result.rows[0] || null;
    } catch { return null; }
}

// ── CREATE PAYMENTS TABLE ──
async function ensurePaymentsTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id),
      reference_id    VARCHAR(100) UNIQUE NOT NULL,
      amount          INTEGER NOT NULL,
      currency        VARCHAR(10) DEFAULT 'UGX',
      phone           VARCHAR(30) NOT NULL,
      plan            VARCHAR(20) NOT NULL,
      provider        VARCHAR(20) DEFAULT 'mtn',
      status          VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','successful','failed','cancelled')),
      momo_status     VARCHAR(50),
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// ── GET MTN ACCESS TOKEN ──
async function getMTNToken() {
    const credentials = Buffer.from(
        `${process.env.MTN_MOMO_API_USER}:${process.env.MTN_MOMO_API_KEY}`
    ).toString('base64');

    const res = await fetch(`${process.env.MTN_MOMO_BASE_URL}/collection/token/`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_PRIMARY_KEY,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`MTN token error: ${text}`);
    }

    const data = await res.json();
    return data.access_token;
}

// ── CREATE API USER (sandbox only, run once) ──
// POST /api/payments/mtn/setup
router.post('/payments/mtn/setup', async (req, res) => {
    try {
        const apiUserId = uuidv4();
        const callbackUrl = process.env.CLIENT_URL || 'https://nyumbaug-full.vercel.app';

        // Step 1: Create API User
        const createUser = await fetch(`${process.env.MTN_MOMO_BASE_URL}/v1_0/apiuser`, {
            method: 'POST',
            headers: {
                'X-Reference-Id': apiUserId,
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_PRIMARY_KEY,
            },
            body: JSON.stringify({ providerCallbackHost: callbackUrl }),
        });

        if (!createUser.ok && createUser.status !== 201) {
            const text = await createUser.text();
            return res.status(400).json({ success: false, message: 'Failed to create API user', detail: text });
        }

        // Step 2: Create API Key
        const createKey = await fetch(`${process.env.MTN_MOMO_BASE_URL}/v1_0/apiuser/${apiUserId}/apikey`, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_PRIMARY_KEY,
            },
        });

        const keyData = await createKey.json();

        res.json({
            success: true,
            message: 'Add these to your .env file',
            MTN_MOMO_API_USER: apiUserId,
            MTN_MOMO_API_KEY: keyData.apiKey,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── INITIATE PAYMENT ──
// POST /api/payments/mtn/pay
router.post('/payments/mtn/pay', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Please log in.' });

    const { phone, amount, plan } = req.body;

    if (!phone || !amount || !plan) {
        return res.status(400).json({ success: false, message: 'Phone, amount and plan are required.' });
    }

    // Clean phone number — remove +, spaces, ensure starts with 256
    let cleanPhone = phone.replace(/[\s+]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '256' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('256')) cleanPhone = '256' + cleanPhone;

    const referenceId = uuidv4();

    try {
        await ensurePaymentsTable();

        // Save payment record
        await pool.query(`
      INSERT INTO payments (user_id, reference_id, amount, phone, plan, provider, status)
      VALUES ($1, $2, $3, $4, $5, 'mtn', 'pending')
    `, [user.id, referenceId, amount, cleanPhone, plan]);

        // Get access token
        const token = await getMTNToken();

        // Request to pay
        const payRes = await fetch(`${process.env.MTN_MOMO_BASE_URL}/collection/v1_0/requesttopay`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Reference-Id': referenceId,
                'X-Target-Environment': process.env.MTN_MOMO_ENV || 'sandbox',
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_PRIMARY_KEY,
            },
            body: JSON.stringify({
                amount: String(amount),
                currency: 'UGX',
                externalId: referenceId,
                payer: {
                    partyIdType: 'MSISDN',
                    partyId: cleanPhone,
                },
                payerMessage: `NyumbaUG ${plan} subscription`,
                payeeNote: `NyumbaUG landlord subscription - ${plan} plan`,
            }),
        });

        if (payRes.status !== 202) {
            const text = await payRes.text();
            await pool.query('UPDATE payments SET status = $1 WHERE reference_id = $2', ['failed', referenceId]);
            return res.status(400).json({ success: false, message: 'Payment request failed.', detail: text });
        }

        res.json({
            success: true,
            message: 'Payment request sent! Check your phone to approve.',
            referenceId,
        });

    } catch (err) {
        console.error('MTN Pay error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── CHECK PAYMENT STATUS ──
// GET /api/payments/mtn/status/:referenceId
router.get('/payments/mtn/status/:referenceId', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Not authorized.' });

    const { referenceId } = req.params;

    try {
        await ensurePaymentsTable();

        // Check local DB first
        const local = await pool.query(
            'SELECT * FROM payments WHERE reference_id = $1 AND user_id = $2',
            [referenceId, user.id]
        );

        if (!local.rows.length) {
            return res.status(404).json({ success: false, message: 'Payment not found.' });
        }

        const payment = local.rows[0];

        // If already successful, return immediately
        if (payment.status === 'successful') {
            return res.json({ success: true, status: 'successful', payment });
        }

        // Check with MTN API
        const token = await getMTNToken();

        const statusRes = await fetch(
            `${process.env.MTN_MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Target-Environment': process.env.MTN_MOMO_ENV || 'sandbox',
                    'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_PRIMARY_KEY,
                },
            }
        );

        const statusData = await statusRes.json();
        const momoStatus = statusData.status; // SUCCESSFUL, FAILED, PENDING

        let dbStatus = 'pending';
        if (momoStatus === 'SUCCESSFUL') dbStatus = 'successful';
        else if (momoStatus === 'FAILED') dbStatus = 'failed';

        // Update payment record
        await pool.query(
            'UPDATE payments SET status = $1, momo_status = $2, updated_at = NOW() WHERE reference_id = $3',
            [dbStatus, momoStatus, referenceId]
        );

        // If successful, activate subscription
        if (dbStatus === 'successful') {
            const expiry = new Date();
            if (payment.plan === 'yearly') expiry.setFullYear(expiry.getFullYear() + 1);
            else expiry.setMonth(expiry.getMonth() + 1);

            // Store subscription in DB
            await pool.query(`
        INSERT INTO subscriptions (user_id, plan, amount, expires_at, payment_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          plan = $2, amount = $3, expires_at = $4,
          payment_id = $5, updated_at = NOW()
      `, [user.id, payment.plan, payment.amount, expiry, payment.id])
                .catch(() => { }); // ignore if subscriptions table doesn't exist yet

            return res.json({
                success: true,
                status: 'successful',
                message: 'Payment confirmed! Your account is now active.',
                expiresAt: expiry,
            });
        }

        res.json({
            success: true,
            status: dbStatus,
            momoStatus,
            message: momoStatus === 'PENDING'
                ? 'Payment is pending. Please approve on your phone.'
                : 'Payment failed. Please try again.',
        });

    } catch (err) {
        console.error('Status check error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET MY PAYMENTS ──
router.get('/payments/my', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Not authorized.' });

    try {
        await ensurePaymentsTable();
        const result = await pool.query(
            'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
            [user.id]
        );
        res.json({ success: true, payments: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;