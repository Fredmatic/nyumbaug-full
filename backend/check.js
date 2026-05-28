const p = require('./config/db');
p.query('SELECT id, name, email FROM users WHERE role = $1', ['tenant'])
    .then(r => { console.log('TENANTS:', r.rows); })
    .then(() => p.query('SELECT id, listing_id, tenant_id, name FROM enquiries ORDER BY created_at DESC LIMIT 5'))
    .then(r => { console.log('ENQUIRIES:', r.rows); p.end(); })
    .catch(e => { console.error(e); p.end(); });