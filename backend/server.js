require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const routes = require('./routes/index');
const { errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1); WebGL2RenderingContext.com

// ── SECURITY MIDDLEWARE ──
app.use(helmet());

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://127.0.0.1:5501',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', limiter);

// Stricter limit on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── BODY PARSING ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HEALTH CHECK ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NyumbaUG API',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ── ROUTES ──
app.use('/api', routes);

// ── SERVE FRONTEND (in production) ──
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── ERROR HANDLER ──
app.use(errorHandler);

// ── START ──
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════╗
  ║   🏠 NyumbaUG API Running         ║
  ║   Port:  ${PORT}                     ║
  ║   Env:   ${(process.env.NODE_ENV || 'development').padEnd(11)}           ║
  ╚═══════════════════════════════════╝
  `);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  API:    http://localhost:${PORT}/api/listings\n`);
});

module.exports = app;
