const cron = require('node-cron');
const pool = require('../config/db');
const nodemailer = require('nodemailer');

// ── EMAIL TRANSPORTER ──
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password
    },
});

async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: `"NyumbaUG" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`✅ Email sent to ${to}`);
    } catch (err) {
        console.error(`❌ Email failed to ${to}:`, err.message);
    }
}

// ── JOB 1: Send reminder 3 days before expiry ──
async function sendExpiryReminders() {
    try {
        const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email,
        s.expires_at,
        COUNT(l.id) AS listing_count
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN listings l ON l.landlord_id = u.id AND l.status = 'active'
      WHERE 
        s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
        AND u.is_active = TRUE
      GROUP BY u.id, u.name, u.email, s.expires_at
    `);

        console.log(`📧 Sending reminders to ${result.rows.length} landlords...`);

        for (const landlord of result.rows) {
            const expiryDate = new Date(landlord.expires_at).toLocaleDateString('en-UG', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            await sendEmail(landlord.email, '⚠️ Your NyumbaUG subscription expires in 3 days', `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0e3d2c;padding:24px;text-align:center;">
            <h1 style="color:#d4a91e;margin:0;font-size:1.8rem;">NyumbaUG</h1>
          </div>
          <div style="padding:32px;background:#ffffff;">
            <h2 style="color:#0e3d2c;">Hello ${landlord.name},</h2>
            <p style="color:#444;line-height:1.7;">
              Your NyumbaUG subscription expires on <strong>${expiryDate}</strong>.
            </p>
            <p style="color:#444;line-height:1.7;">
              You have <strong>${landlord.listing_count} active listing(s)</strong> that will be 
              <strong style="color:#dc2626;">deactivated</strong> if your subscription is not renewed.
            </p>
            <div style="background:#fef9c3;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0;color:#92400e;">
                ⚠️ Renew now to keep your listings visible to thousands of tenants on NyumbaUG.
              </p>
            </div>
            <a href="https://nyumbaug-full.vercel.app/pages/payment.html" 
               style="display:inline-block;background:#0e3d2c;color:#d4a91e;padding:14px 28px;
                      border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px;">
              Renew Subscription — UGX 100,000
            </a>
            <p style="color:#888;font-size:0.85rem;margin-top:24px;">
              Questions? Reply to this email or call +256 740 193 837
            </p>
          </div>
          <div style="background:#f4f6f3;padding:16px;text-align:center;">
            <p style="color:#888;font-size:0.8rem;margin:0;">
              © 2025 NyumbaUG · Kampala, Uganda 🇺🇬
            </p>
          </div>
        </div>
      `);

            // Log notification in DB
            await pool.query(`
        INSERT INTO notifications (user_id, type, message)
        VALUES ($1, 'subscription', $2)
      `, [landlord.id, `Your subscription expires on ${expiryDate}. Renew to keep your listings active.`]);
        }
    } catch (err) {
        console.error('Reminder job error:', err.message);
    }
}

// ── JOB 2: Deactivate expired subscriptions ──
async function deactivateExpiredListings() {
    try {
        // Find landlords whose subscription has expired
        const expired = await pool.query(`
      SELECT u.id, u.name, u.email, COUNT(l.id) AS listing_count
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN listings l ON l.landlord_id = u.id AND l.status = 'active'
      WHERE s.expires_at < NOW()
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(l.id) > 0
    `);

        console.log(`🔴 Deactivating listings for ${expired.rows.length} expired landlords...`);

        for (const landlord of expired.rows) {
            // Deactivate all their active listings
            await pool.query(`
        UPDATE listings SET status = 'inactive', updated_at = NOW()
        WHERE landlord_id = $1 AND status = 'active'
      `, [landlord.id]);

            // Send deactivation email
            await sendEmail(landlord.email, '🔴 Your NyumbaUG listings have been deactivated', `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0e3d2c;padding:24px;text-align:center;">
            <h1 style="color:#d4a91e;margin:0;font-size:1.8rem;">NyumbaUG</h1>
          </div>
          <div style="padding:32px;background:#ffffff;">
            <h2 style="color:#dc2626;">Hello ${landlord.name},</h2>
            <p style="color:#444;line-height:1.7;">
              Your NyumbaUG subscription has <strong>expired</strong> and your 
              <strong>${landlord.listing_count} listing(s)</strong> have been temporarily deactivated.
            </p>
            <p style="color:#444;line-height:1.7;">
              Tenants can no longer see your properties. Renew your subscription to 
              <strong>reactivate your listings immediately.</strong>
            </p>
            <a href="https://nyumbaug-full.vercel.app/pages/payment.html"
               style="display:inline-block;background:#dc2626;color:#ffffff;padding:14px 28px;
                      border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px;">
              Renew Now — UGX 100,000/month
            </a>
            <p style="color:#888;font-size:0.85rem;margin-top:24px;">
              Your listings will be reactivated instantly once payment is confirmed.
            </p>
          </div>
          <div style="background:#f4f6f3;padding:16px;text-align:center;">
            <p style="color:#888;font-size:0.8rem;margin:0;">
              © 2025 NyumbaUG · Kampala, Uganda 🇺🇬
            </p>
          </div>
        </div>
      `);

            // Notify in DB
            await pool.query(`
        INSERT INTO notifications (user_id, type, message)
        VALUES ($1, 'subscription', $2)
      `, [landlord.id, `Your subscription expired. Your listings have been deactivated. Renew to go live again.`]);
        }

        console.log('✅ Deactivation job complete');
    } catch (err) {
        console.error('Deactivation job error:', err.message);
    }
}

// ── SCHEDULE ──
// Run deactivation every day at midnight
cron.schedule('0 0 * * *', () => {
    console.log('🕛 Running subscription deactivation job...');
    deactivateExpiredListings();
});

// Run reminder every day at 9am
cron.schedule('0 9 * * *', () => {
    console.log('📧 Running subscription reminder job...');
    sendExpiryReminders();
});

// Export for manual testing
module.exports = { deactivateExpiredListings, sendExpiryReminders };