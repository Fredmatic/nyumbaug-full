# 🏠 NyumbaUG — Full Stack Setup Guide

## Project Structure

```
nyumba-ug/
├── index.html              ← Homepage
├── css/style.css           ← All styles
├── js/
│   ├── main.js             ← Frontend UI logic
│   └── api.js              ← Connects frontend to backend
├── pages/
│   ├── listings.html       ← Browse & filter page
│   ├── listing-detail.html ← Single property page
│   ├── list-property.html  ← Landlord submission form
│   ├── register.html       ← Sign up page
│   └── contact.html        ← Contact + FAQ
└── backend/
    ├── server.js           ← Express entry point
    ├── package.json
    ├── .env.example        ← Copy this to .env and fill in
    ├── config/
    │   ├── db.js           ← PostgreSQL connection
    │   ├── migrate.js      ← Creates all tables
    │   └── seed.js         ← Adds sample data
    ├── controllers/
    │   ├── authController.js
    │   ├── listingsController.js
    │   └── enquiryController.js
    ├── middleware/
    │   ├── auth.js         ← JWT protection
    │   ├── error.js        ← Error handling
    │   └── upload.js       ← Cloudinary image uploads
    └── routes/
        └── index.js        ← All API routes
```

---

## STEP 1 — Install Node.js

1. Go to **https://nodejs.org**
2. Download the **LTS version** (e.g. v20)
3. Run the installer — keep all defaults
4. Open a terminal and verify:
   ```bash
   node --version    # should print v20.x.x
   npm --version     # should print 10.x.x
   ```

---

## STEP 2 — Install PostgreSQL

1. Go to **https://www.postgresql.org/download/**
2. Download for Windows/Mac/Linux
3. Run the installer:
   - Set a password for the `postgres` user (remember it!)
   - Keep default port: **5432**
4. After install, open **pgAdmin** (comes with PostgreSQL)
5. Create a new database called `nyumbaug`

---

## STEP 3 — Set Up the Backend

Open your terminal inside the `backend` folder:

```bash
cd nyumba-ug/backend

# Install all dependencies
npm install

# Copy the environment file
cp .env.example .env
```

Now open `.env` in VS Code and fill in:
```
DB_PASSWORD=your_postgres_password_here
JWT_SECRET=any_long_random_string_here
```

---

## STEP 4 — Create Database Tables

```bash
npm run db:migrate
```

You should see: `✅ All tables created successfully`

---

## STEP 5 — Add Sample Data

```bash
npm run db:seed
```

You should see: `✅ Database seeded!`

Sample login credentials:
- **Tenant:** tenant@example.com / password123
- **Landlord:** james@example.com / password123

---

## STEP 6 — Start the Backend

```bash
npm run dev
```

You should see the NyumbaUG banner and:
- Health check: http://localhost:5000/health
- Listings API: http://localhost:5000/api/listings

---

## STEP 7 — Run the Frontend

In VS Code, open `index.html` → right-click → **Open with Live Server**

Your full site is now running with a real database!

---

## Optional: Cloudinary (Image Uploads)

1. Sign up free at **https://cloudinary.com**
2. Get your Cloud Name, API Key, API Secret from the dashboard
3. Add them to your `.env` file

---

## Optional: Email Notifications

Use Gmail:
1. Go to Google Account → Security → App Passwords
2. Generate a password for "Mail"
3. Add to `.env`:
   ```
   EMAIL_USER=your@gmail.com
   EMAIL_PASS=the_app_password
   ```

---

## API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | — | Create account |
| POST | /api/auth/login | — | Login |
| GET | /api/auth/me | ✓ | Get my profile |
| GET | /api/listings | — | Browse listings (with filters) |
| GET | /api/listings/:id | — | Get single listing |
| POST | /api/listings | Landlord | Create listing |
| PATCH | /api/listings/:id | Landlord | Update listing |
| DELETE | /api/listings/:id | Landlord | Delete listing |
| POST | /api/enquiries | — | Send enquiry |
| GET | /api/enquiries | Landlord | View enquiries |
| POST | /api/messages | ✓ | Send message |
| GET | /api/messages | ✓ | Get messages |
| POST | /api/saved/:id | ✓ | Save listing |
| GET | /api/saved | ✓ | My saved listings |

---

## Deploying to Production

**Backend → Render.com (free)**
1. Push code to GitHub
2. Go to render.com → New Web Service → connect repo
3. Set environment variables
4. Add a free PostgreSQL database on Render

**Frontend → Vercel (free)**
1. Drag the `nyumba-ug` folder to vercel.com
2. Update `API_BASE` in `js/api.js` to your Render URL

**Domain → nyumbaug.co.ug**
- Register at **https://www.registry.co.ug**
