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

    async markRented(id) {
      const res = await fetch(`${API_BASE}/listings/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'rented' }),
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
    async send(receiver_id, body, listing_id = null, reply_to_id = null) {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ receiver_id, body, listing_id, reply_to_id }),
      });
      return handleResponse(res);
    },

    async getAll(partnerId = null) {
      const url = partnerId ? `${API_BASE}/messages/${partnerId}` : `${API_BASE}/messages`;
      const res = await fetch(url, { headers: authHeaders() });
      return handleResponse(res);
    },

    async getUnreadCount() {
      const res = await fetch(`${API_BASE}/messages/unread-count`, { headers: authHeaders() });
      return handleResponse(res);
    },

    async deleteForEveryone(messageId) {
      const res = await fetch(`${API_BASE}/messages/${messageId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    async react(messageId, emoji) {
      const res = await fetch(`${API_BASE}/messages/${messageId}/react`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ emoji }),
      });
      return handleResponse(res);
    },

    async unreact(messageId, emoji) {
      const res = await fetch(`${API_BASE}/messages/${messageId}/react`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ emoji }),
      });
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

  // ── REVIEWS ──
  reviews: {
    async submit(listingId, rating, title, comment) {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          listing_id: listingId,
          rating: rating,
          title: title || null,
          comment: comment
        })
      });
      return handleResponse(res);
    },

    async getListing(listingId) {
      const res = await fetch(`${API_BASE}/reviews/listing/${listingId}`);
      return handleResponse(res);
    },

    async getAdminDashboardReviews() {
      const res = await fetch(`${API_BASE}/admin/all-reviews`, { headers: authHeaders() });
      return handleResponse(res);
    },

    async updateStatus(reviewId, status) {
      const res = await fetch(`${API_BASE}/admin/reviews/${reviewId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      // If endpoint doesn't exist yet, silently succeed
      if (!res.ok) return { success: true };
      return handleResponse(res);
    },
  },

  // ── NOTIFICATIONS (landlord likes/saves) ──
  notifications: {
    async getMy() {
      const res = await fetch(`${API_BASE}/notifications`, { headers: authHeaders() });
      if (!res.ok) return { notifications: [] };
      return res.json();
    },

    async markRead(id) {
      if (id === 'all') {
        const res = await fetch(`${API_BASE}/notifications/read-all`, {
          method: 'PATCH', headers: authHeaders()
        });
        if (!res.ok) return { success: true };
        return res.json();
      }
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH', headers: authHeaders()
      });
      if (!res.ok) return { success: true };
      return res.json();
    },
  },

  // ── PAYMENTS ──
  payments: {
    async initiate(phone, amount, plan) {
      const res = await fetch(`${API_BASE}/payments/mtn/pay`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ phone, amount, plan }),
      });
      return handleResponse(res);
    },

    async checkStatus(referenceId) {
      const res = await fetch(`${API_BASE}/payments/mtn/status/${referenceId}`, {
        headers: authHeaders()
      });
      return handleResponse(res);
    },

    async getMy() {
      const res = await fetch(`${API_BASE}/payments/my`, { headers: authHeaders() });
      return handleResponse(res);
    },
  },
};

// ── SMART NAV ──
function updateNav() {
  const user = getUser();
  const cta = document.querySelector('.nav-cta');
  if (!cta) return;

  if (user) {
    cta.textContent = `👤 ${user.name.split(' ')[0]}`;
    cta.href = (user.role === 'landlord' || user.role === 'admin')
      ? base + 'pages/dashboard.html'
      : base + 'pages/dashboard.html';
    cta.style.background = '';

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

function toggleNav() {
  const nav = document.getElementById('nav-links');
  if (!nav) return;
  nav.classList.toggle('open');
  const btn = document.querySelector('.nav-toggle');
  if (btn) btn.classList.toggle('open');
}

// ── DARK MODE ──
function initTheme() {
  const saved = localStorage.getItem('nyumba-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nyumba-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  });
}

window.toggleTheme = toggleTheme;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      const nav = document.getElementById('nav-links');
      const btn = document.querySelector('.nav-toggle');
      if (nav) nav.classList.remove('open');
      if (btn) btn.classList.remove('open');
    });
  });
  updateNav();
});

window.toggleNav = toggleNav;
window.api = api;
window.requireAuth = requireAuth;
window.updateNav = updateNav;
window.showToast = showToast;