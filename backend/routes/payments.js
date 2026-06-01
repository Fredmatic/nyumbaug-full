const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { protect } = require('../middleware/auth');

// ── ENSURE PAYMENTS TABLE ──
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
  `).catch(() => {});
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

// ── POST /api/payments/mtn/pay ──
router.post('/mtn/pay', protect, async (req, res) => {
    const user = req.user;
    const { phone, amount, plan } = req.body;

    if (!phone || !amount || !plan) {
        return res.status(400).json({ success: false, message: 'Phone, amount and plan are required.' });
    }

    // Enforce 100,000 UGX/month minimum
    const MIN_AMOUNT = 100000;
    if (parseInt(amount) < MIN_AMOUNT) {
        return res.status(400).json({ success: false, message: `Minimum subscription is UGX ${MIN_AMOUNT.toLocaleString()}/month.` });
    }

    // Clean phone number
    let cleanPhone = phone.replace(/[\s+]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '256' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('256')) cleanPhone = '256' + cleanPhone;

    const referenceId = uuidv4();

    try {
        await ensurePaymentsTable();

        await pool.query(`
      INSERT INTO payments (user_id, reference_id, amount, phone, plan, provider, status)
      VALUES ($1, $2, $3, $4, $5, 'mtn', 'pending')
    `, [user.id, referenceId, amount, cleanPhone, plan]);

        const token = await getMTNToken();

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
                payer: { partyIdType: 'MSISDN', partyId: cleanPhone },
                payerMessage: `NyumbaUG ${plan} subscription`,
                payeeNote: `NyumbaUG landlord subscription – ${plan} plan`,
            }),
        });

        if (payRes.status !== 202) {
            const text = await payRes.text();
            await pool.query('UPDATE payments SET status = $1 WHERE reference_id = $2', ['failed', referenceId]);
            return res.status(400).json({ success: false, message: 'Payment request failed.', detail: text });
        }

        res.json({ success: true, message: 'Check your phone to approve the payment.', referenceId });

    } catch (err) {
        console.error('MTN Pay error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/payments/mtn/status/:referenceId ──
router.get('/mtn/status/:referenceId', protect, async (req, res) => {
    const user = req.user;
    const { referenceId } = req.params;

    try {
        await ensurePaymentsTable();

        const local = await pool.query(
            'SELECT * FROM payments WHERE reference_id = $1 AND user_id = $2',
            [referenceId, user.id]
        );

        if (!local.rows.length) {
            return res.status(404).json({ success: false, message: 'Payment not found.' });
        }

        const payment = local.rows[0];

        if (payment.status === 'successful') {
            return res.json({ success: true, status: 'successful', payment });
        }

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
        const momoStatus = statusData.status;

        let dbStatus = 'pending';
        if (momoStatus === 'SUCCESSFUL') dbStatus = 'successful';
        else if (momoStatus === 'FAILED') dbStatus = 'failed';

        await pool.query(
            'UPDATE payments SET status = $1, momo_status = $2, updated_at = NOW() WHERE reference_id = $3',
            [dbStatus, momoStatus, referenceId]
        );

        if (dbStatus === 'successful') {
            const expiry = new Date();
            if (payment.plan === 'yearly') expiry.setFullYear(expiry.getFullYear() + 1);
            else expiry.setMonth(expiry.getMonth() + 1);

            await pool.query(`
        INSERT INTO subscriptions (user_id, plan, amount, expires_at, payment_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          plan = $2, amount = $3, expires_at = $4, payment_id = $5, updated_at = NOW()
      `, [user.id, payment.plan, payment.amount, expiry, payment.id]).catch(() => {});

            // Notify landlord via notification
            await pool.query(`
        INSERT INTO notifications (user_id, type, message, created_at)
        VALUES ($1, 'payment', $2, NOW())
      `, [user.id, `✅ Your subscription has been activated until ${expiry.toLocaleDateString('en-UG')}.`]).catch(() => {});

            return res.json({
                success: true,
                status: 'successful',
                message: 'Payment confirmed! Your subscription is now active.',
                expiresAt: expiry,
            });
        }

        res.json({
            success: true,
            status: dbStatus,
            momoStatus,
            message: momoStatus === 'PENDING'
                ? 'Waiting for your approval on the phone.'
                : 'Payment failed. Please try again.',
        });

    } catch (err) {
        console.error('Status check error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/payments/my ──
router.get('/my', protect, async (req, res) => {
    try {
        await ensurePaymentsTable();
        const result = await pool.query(
            'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ success: true, payments: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/payments/mtn/setup (sandbox only) ──
router.post('/mtn/setup', async (req, res) => {
    try {
        const apiUserId = uuidv4();
        const callbackUrl = process.env.CLIENT_URL || 'https://nyumbaug-full.vercel.app';

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

        const createKey = await fetch(`${process.env.MTN_MOMO_BASE_URL}/v1_0/apiuser/${apiUserId}/apikey`, {
            method: 'POST',
            headers: { 'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_PRIMARY_KEY },
        });

        const keyData = await createKey.json();
        res.json({
            success: true,
            message: 'Add these to your .env file',
            MTN_MOMO_API_USER: apiUserId,
            MTN_MOMO_API_KEY: keyData.apiKey,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
