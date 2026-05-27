// Run: node config/make-admin.js your@email.com
const pool = require('./db');

const email = process.argv[2];
if (!email) { console.log('Usage: node config/make-admin.js fssaazi46@email.com'); process.exit(1); }

async function run() {
  const result = await pool.query(
    "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING name, email, role",
    [email]
  );
  if (!result.rows.length) {
    console.log('❌ User not found:', email);
  } else {
    console.log('✅ Admin access granted to:', result.rows[0].name, '(' + result.rows[0].email + ')');
  }
  pool.end();
}
run();
