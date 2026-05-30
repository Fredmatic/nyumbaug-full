// ── NYUMBA UG — API Service ──
if (typeof API_BASE === 'undefined') {
  var API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://nyumbaug-full.onrender.com/api';
}
const getToken = () => localStorage.getItem('nyumba_token');
const getUser = () => JSON.parse(localStorage.getItem('nyumba_user') || 'null');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

const handleResponse = async (res) => {
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    // Token invalid or account suspended — force logout
    localStorage.removeItem('nyumba_token');
    localStorage.removeItem('nyumba_user');
    localStorage.removeItem('nyumba_avatar');
    if (!window.location.pathname.includes('login')) {
      window.location.href = (window.location.pathname.includes('/pages/') ? '' : 'pages/') + 'login.html';
    }
  }
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
};

// Detect if we're in /pages/ subfolder
const base = window.location.pathname.includes('/pages/') ? '../' : '';

const api = {
  // ── AUTH ──
  auth: {
    async register(name, email, phone, password, role = 'tenant') {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, role }),
      });
      const data = await handleResponse(res);
      localStorage.setItem('nyumba_token', data.token);
      localStorage.setItem('nyumba_user', JSON.stringify(data.user));
      return data;
    },

    async login(email, password) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await handleResponse(res);
      localStorage.setItem('nyumba_token', data.token);
      localStorage.setItem('nyumba_user', JSON.stringify(data.user));
      return data;
    },

    logout() {
      localStorage.removeItem('nyumba_token');
      localStorage.removeItem('nyumba_user');
      window.location.href = base + 'index.html';
    },

    async getMe() {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
      const data = await handleResponse(res);
      // Update stored avatar
      if (data.user?.avatar_url) {
        const stored = JSON.parse(localStorage.getItem('nyumba_user') || '{}');
        stored.avatar_url = data.user.avatar_url;
        localStorage.setItem('nyumba_user', JSON.stringify(stored));
      }
      return data;
    },

    async updateProfile(data) {
      const res = await fetch(`${API_BASE}/auth/update-profile`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },

    async changePassword(currentPassword, newPassword) {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return handleResponse(res);
    },

    isLoggedIn: () => !!getToken(),
    currentUser: getUser,
  },

  // ── LISTINGS ──
  listings: {
    async getAll(params = {}) {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/listings?${qs}`);
      return handleResponse(res);
    },

    async getOne(id) {
      const res = await fetch(`${API_BASE}/listings/${id}`);
      return handleResponse(res);
    },

    async getMy() {
      const res = await fetch(`${API_BASE}/listings/my`, { headers: authHeaders() });
      return handleResponse(res);
    },

    async create(formData) {
      const res = await fetch(`${API_BASE}/listings`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
      });
      return handleResponse(res);
    },

    async update(id, data) {
      const res = await fetch(`${API_BASE}/listings/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },

    async delete(id) {
      const res = await fetch(`${API_BASE}/listings/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  // ── ENQUIRIES ──
  enquiries: {
    async send(listing_id, name, email, phone, message) {
      const res = await fetch(`${API_BASE}/enquiries`, {
        method: 'POST',
        headers: api.auth.isLoggedIn() ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id, name, email, phone, message }),
      });
      return handleResponse(res);
    },

    async getMy(params = {}) {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/enquiries?${qs}`, { headers: authHeaders() });
      return handleResponse(res);
    },

    async updateStatus(id, status) {
      const res = await fetch(`${API_BASE}/enquiries/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      return handleResponse(res);
    },
  },

  // ── MESSAGES ──
  messages: {
    async send(receiver_id, body, listing_id = null) {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ receiver_id, body, listing_id }),
      });
      return handleResponse(res);
    },

    async getAll(withUserId = null) {
      const qs = withUserId ? `?with=${withUserId}` : '';
      const res = await fetch(`${API_BASE}/messages${qs}`, { headers: authHeaders() });
      return handleResponse(res);
    },

    async getUnreadCount() {
      const res = await fetch(`${API_BASE}/messages/unread-count`, { headers: authHeaders() });
      return handleResponse(res);
    },
  },

  // ── SAVED ──
  saved: {
    async save(listing_id) {
      const res = await fetch(`${API_BASE}/saved/${listing_id}`, {
        method: 'POST', headers: authHeaders(),
      });
      return handleResponse(res);
    },

    async unsave(listing_id) {
      const res = await fetch(`${API_BASE}/saved/${listing_id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      return handleResponse(res);
    },

    async getAll() {
      const res = await fetch(`${API_BASE}/saved`, { headers: authHeaders() });
      return handleResponse(res);
    },
  },
  // ── REVIEWS MODULE ──
  reviews: {
    // Tenants submit a review for a specific property listing
    async submit(listing_id, rating, title, body) {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: authHeaders(), // Plugs in Bearer token automatically
        body: JSON.stringify({ listing_id, rating, title, body }),
      });
      return handleResponse(res);
    },

    // Admin fetches all aggregate system reviews for moderation
    async getAdminDashboardReviews() {
      const res = await fetch(`${API_BASE}/admin/all-reviews`, {
        headers: authHeaders()
      });
      return handleResponse(res);
    },

    // Admin toggles review visibility status (active, hidden, flagged)
    async updateStatus(reviewId, status) {
      const res = await fetch(`${API_BASE}/reviews/${reviewId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
      return handleResponse(res);
    }
  },
};

// ── SMART NAV — updates navbar based on login state ──
function updateNav() {
  const user = getUser();
  const cta = document.querySelector('.nav-cta');
  if (!cta) return;

  if (user) {
    cta.textContent = `👤 ${user.name.split(' ')[0]}`;
    cta.href = user.role === 'landlord'
      ? base + 'pages/dashboard.html'
      : base + 'pages/register.html';
    cta.style.background = '';

    // Add logout link next to name
    if (!document.getElementById('nav-logout')) {
      const li = document.createElement('li');
      li.innerHTML = `<a id="nav-logout" href="#" onclick="api.auth.logout()" style="color:rgba(255,255,255,0.6);font-size:0.85rem;">Logout</a>`;
      cta.closest('ul')?.appendChild(li);
    }
  } else {
    cta.textContent = 'Sign Up';
    cta.href = base + 'pages/register.html';
  }
}

// ── PROTECT PAGE — redirect to login if not logged in ──
function requireAuth(role = null) {
  if (!api.auth.isLoggedIn()) {
    window.location.href = base + 'pages/login.html';
    return false;
  }
  if (role) {
    const user = getUser();
    if (user?.role !== role && user?.role !== 'admin') {
      window.location.href = base + 'index.html';
      return false;
    }
  }
  return true;
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast'; t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
// ── MOBILE NAV TOGGLE ──
function toggleNav() {
  const nav = document.getElementById('nav-links');
  if (!nav) return;
  nav.classList.toggle('open');
  // Animate hamburger
  const btn = document.querySelector('.nav-toggle');
  if (btn) btn.classList.toggle('open');
}

// Close nav when link clicked
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      const nav = document.getElementById('nav-links');
      const btn = document.querySelector('.nav-toggle');
      if (nav) nav.classList.remove('open');
      if (btn) btn.classList.remove('open');
    });
  });
});

window.toggleNav = toggleNav;

document.addEventListener('DOMContentLoaded', updateNav);

window.api = api;
window.requireAuth = requireAuth;
window.updateNav = updateNav;
window.showToast = showToast;

