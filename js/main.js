// ── NYUMBA UG — Main JS ──

// ─────────────────────────────────────────
// AUTH SYSTEM (localStorage)
// ─────────────────────────────────────────
const Auth = {
  register(data) {
    const users = JSON.parse(localStorage.getItem('nyumba-users') || '[]');
    const exists = users.find(u => u.email === data.email);
    if (exists) return { ok: false, msg: 'An account with this email already exists.' };
    const user = {
      id: Date.now(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      district: data.district,
      role: data.role || 'tenant',
      plan: 'free',
      nationalId: data.nationalId || '',
      createdAt: new Date().toISOString(),
      password: btoa(data.password)
    };
    users.push(user);
    localStorage.setItem('nyumba-users', JSON.stringify(users));
    const session = { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, plan: user.plan };
    localStorage.setItem('nyumba-session', JSON.stringify(session));
    return { ok: true, user: session };
  },

  login(email, password) {
    const users = JSON.parse(localStorage.getItem('nyumba-users') || '[]');
    const user = users.find(u => u.email === email && u.password === btoa(password));
    if (!user) return { ok: false, msg: 'Incorrect email or password. Please try again.' };
    const session = { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, plan: user.plan || 'free' };
    localStorage.setItem('nyumba-session', JSON.stringify(session));
    return { ok: true, user: session };
  },

  getUser() {
    return JSON.parse(localStorage.getItem('nyumba-session') || 'null');
  },

  isLoggedIn() {
    return !!this.getUser();
  },

  logout() {
    localStorage.removeItem('nyumba-session');
  }
};

// ─────────────────────────────────────────
// NAV — update based on login state
// ─────────────────────────────────────────
function initNav() {
  const user = Auth.getUser();
  const ctaLink = document.querySelector('.nav-cta');
  const navList = document.querySelector('.nav-links');
  if (!ctaLink || !navList) return;

  if (user) {
    ctaLink.textContent = '👤 ' + user.name.split(' ')[0];
    ctaLink.href = '#';
    ctaLink.style.background = 'rgba(255,255,255,0.15)';
    ctaLink.style.color = 'var(--gold)';

    const logoutLi = document.createElement('li');
    logoutLi.innerHTML = `<a href="#" id="nav-logout" style="color:rgba(255,255,255,0.5);font-size:0.85rem;">Log out</a>`;
    navList.appendChild(logoutLi);
    document.getElementById('nav-logout').addEventListener('click', e => {
      e.preventDefault();
      Auth.logout();
      showToast('👋 You have been logged out.');
      setTimeout(() => location.reload(), 800);
    });
  } else {
    // Show login link next to sign up
    const loginLi = document.createElement('li');
    const inPages = location.pathname.includes('/pages/');
    loginLi.innerHTML = `<a href="${inPages ? 'login.html' : 'pages/login.html'}" style="color:rgba(255,255,255,0.7);">Log In</a>`;
    navList.insertBefore(loginLi, navList.lastElementChild);
  }
}

// ─────────────────────────────────────────
// REDIRECT IF ALREADY LOGGED IN
// ─────────────────────────────────────────
function redirectIfLoggedIn() {
  if (Auth.isLoggedIn()) {
    const inPages = location.pathname.includes('/pages/');
    window.location.href = inPages ? 'listings.html' : 'pages/listings.html';
  }
}

// ─────────────────────────────────────────
// LISTINGS DATA
// ─────────────────────────────────────────
const listings = [
  {
    id: 1,
    title: "Modern 3-Bedroom Apartment",
    location: "Kololo, Kampala",
    price: 1800000,
    type: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    area: 140,
    badge: "new",
    image: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=600&q=80",
    featured: true,
    description: "Spacious modern apartment in the heart of Kololo with stunning city views, fully fitted kitchen, and 24/7 security.",
    amenities: ["WiFi", "Parking", "Generator", "Security", "Water Tank", "Balcony"],
    landlord: "Mr. Ssemakula James",
    phone: "+256 772 123 456",
    available: "Immediately"
  },
  {
    id: 2,
    title: "Executive 2-Bedroom Flat",
    location: "Bugolobi, Kampala",
    price: 1200000,
    type: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    area: 95,
    badge: "available",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80",
    featured: true,
    description: "Well-maintained executive flat in quiet Bugolobi estate. Ideal for professionals and small families.",
    amenities: ["Parking", "Security", "Water Tank", "Tiled Floors"],
    landlord: "Mrs. Namubiru Jane",
    phone: "+256 766 513 833",
    available: "1st Jan 2025"
  },
  {
    id: 3,
    title: "Self-Contained Studio",
    location: "Ntinda, Kampala",
    price: 450000,
    type: "studio",
    bedrooms: 1,
    bathrooms: 1,
    area: 35,
    badge: "available",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80",
    featured: false,
    description: "Cozy self-contained studio perfect for a single professional. Close to Ntinda market and major roads.",
    amenities: ["Water Tank", "Security"],
    landlord: "Mr. George Doris",
    phone: "+256 740 271 661",
    available: "Immediately"
  },
  {
    id: 4,
    title: "Spacious Family Home",
    location: "Muyenga, Kampala",
    price: 3500000,
    type: "house",
    bedrooms: 5,
    bathrooms: 3,
    area: 280,
    badge: "new",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80",
    featured: true,
    description: "Beautiful standalone house with large garden in prestigious Muyenga. Perfect for families who value space and privacy.",
    amenities: ["WiFi", "Parking", "Generator", "Security", "Garden", "Water Tank", "DSTV"],
    landlord: "Dr. Wamala Robert",
    phone: "+256 777 321 987",
    available: "15th Jan 2025"
  },
  {
    id: 5,
    title: "3-Bedroom Bungalow",
    location: "Kira, Wakiso",
    price: 900000,
    type: "house",
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    badge: "available",
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80",
    featured: false,
    description: "Affordable and spacious bungalow in developing Kira suburb. Great for families looking for value.",
    amenities: ["Parking", "Water Tank", "Compound"],
    landlord: "Mrs. Namutebi Sarah",
    phone: "+256 754 456 789",
    available: "Immediately"
  },
  {
    id: 6,
    title: "Luxury 4-Bedroom Duplex",
    location: "Naguru, Kampala",
    price: 4200000,
    type: "apartment",
    bedrooms: 4,
    bathrooms: 3,
    area: 220,
    badge: "available",
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80",
    featured: true,
    description: "Prestigious duplex apartment in Naguru with panoramic views of Kampala. High-end finishes throughout.",
    amenities: ["WiFi", "Parking", "Generator", "Security", "Swimming Pool", "Gym", "Water Tank"],
    landlord: "Mr. Musoke Brian",
    phone: "+256 792 789 123",
    available: "1st Feb 2025"
  }
];

// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────
function formatUGX(amount) {
  return "UGX " + amount.toLocaleString('en-UG');
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// ─────────────────────────────────────────
// RENDER LISTING CARDS
// ─────────────────────────────────────────
function renderListings(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const inPages = location.pathname.includes('/pages/');
  const detailPath = inPages ? 'listing-detail.html' : 'pages/listing-detail.html';

  if (data.length === 0) {
    container.innerHTML = '';
    const noResults = document.getElementById('no-results');
    if (noResults) noResults.style.display = 'block';
    const countEl = document.getElementById('result-count');
    if (countEl) countEl.textContent = '0 properties found';
    return;
  }

  const noResults = document.getElementById('no-results');
  if (noResults) noResults.style.display = 'none';
  const countEl = document.getElementById('result-count');
  if (countEl) countEl.textContent = `Showing ${data.length} propert${data.length === 1 ? 'y' : 'ies'}`;

  container.innerHTML = data.map(l => `
    <div class="listing-card" onclick="window.location.href='${detailPath}?id=${l.id}'">
      <div class="listing-img">
        <img src="${l.image}" alt="${l.title}" loading="lazy" />
        <span class="listing-badge ${l.badge === 'new' ? 'new' : ''}">${l.badge === 'new' ? '🆕 New' : 'Available'}</span>
        <button class="listing-fav" onclick="toggleFav(event, this, ${l.id})" aria-label="Save listing">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
      </div>
      <div class="listing-body">
        <div class="listing-price">${formatUGX(l.price)} <span>/ month</span></div>
        <div class="listing-title">${l.title}</div>
        <div class="listing-location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${l.location}
        </div>
        <div class="listing-amenities">
          <div class="amenity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            ${l.bedrooms} Bed${l.bedrooms > 1 ? 's' : ''}
          </div>
          <div class="amenity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16M4 6h16M4 18h16"/></svg>
            ${l.bathrooms} Bath${l.bathrooms > 1 ? 's' : ''}
          </div>
          <div class="amenity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            ${l.area} m²
          </div>
        </div>
      </div>
    </div>
  `).join('');

  setTimeout(restoreFavs, 50);
}

// ─────────────────────────────────────────
// FAVOURITES
// ─────────────────────────────────────────
function toggleFav(e, btn, id) {
  e.stopPropagation();
  btn.classList.toggle('liked');
  const saved = JSON.parse(localStorage.getItem('nyumba-favs') || '[]');
  const idx = saved.indexOf(id);
  if (idx === -1) { saved.push(id); showToast('❤️ Saved to favourites'); }
  else { saved.splice(idx, 1); showToast('Removed from favourites'); }
  localStorage.setItem('nyumba-favs', JSON.stringify(saved));
}

function restoreFavs() {
  const saved = JSON.parse(localStorage.getItem('nyumba-favs') || '[]');
  document.querySelectorAll('.listing-fav').forEach(btn => {
    const match = btn.getAttribute('onclick').match(/\d+/);
    const id = parseInt(match?.[0] || 0);
    if (saved.includes(id)) btn.classList.add('liked');
  });
}

// ─────────────────────────────────────────
// FILTER & TABS
// ─────────────────────────────────────────
function filterListings() {
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const type = document.getElementById('filter-type')?.value || '';
  const maxPrice = document.getElementById('filter-price')?.value || '';
  const tab = document.querySelector('.tab.active')?.dataset.filter || 'all';

  let filtered = listings.filter(l => {
    const matchSearch = l.location.toLowerCase().includes(search) || l.title.toLowerCase().includes(search);
    const matchType = !type || l.type === type;
    const matchPrice = !maxPrice || l.price <= parseInt(maxPrice);
    const matchTab = tab === 'all' || l.type === tab;
    return matchSearch && matchType && matchPrice && matchTab;
  });

  renderListings(filtered, 'listings-container');
}

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterListings();
    });
  });
}

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─────────────────────────────────────────
// SCROLL / NAV HIGHLIGHT
// ─────────────────────────────────────────
function initScrollHighlight() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href.endsWith(path)) link.classList.add('active');
  });
}

// ─────────────────────────────────────────
// REGISTER HANDLER
// ─────────────────────────────────────────
function handleRegister(e) {
  e.preventDefault();
  let valid = true;

  const firstName = document.getElementById('first-name').value.trim();
  const lastName = document.getElementById('last-name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const district = document.getElementById('district').value;
  const password = document.getElementById('password').value;
  const confirmPw = document.getElementById('confirm-password').value;
  const terms = document.getElementById('agree-terms').checked;
  const isLandlord = document.getElementById('role-landlord')?.classList.contains('selected');
  const nationalId = document.getElementById('national-id')?.value.trim() || '';

  function se(id, show, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = show ? 'block' : 'none';
    if (msg) el.textContent = msg;
  }
  function ie(id, has) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('input-error', has);
  }

  if (!firstName) { se('err-first', true); ie('first-name', true); valid = false; }
  else { se('err-first', false); ie('first-name', false); }

  if (!lastName) { se('err-last', true); ie('last-name', true); valid = false; }
  else { se('err-last', false); ie('last-name', false); }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) { se('err-email', true); ie('email', true); valid = false; }
  else { se('err-email', false); ie('email', false); }

  if (phone.length < 10) { se('err-phone', true); ie('phone', true); valid = false; }
  else { se('err-phone', false); ie('phone', false); }

  if (!district) { se('err-district', true); ie('district', true); valid = false; }
  else { se('err-district', false); ie('district', false); }

  if (password.length < 8) { se('err-password', true); ie('password', true); valid = false; }
  else { se('err-password', false); ie('password', false); }

  if (password !== confirmPw) { se('err-confirm', true); ie('confirm-password', true); valid = false; }
  else { se('err-confirm', false); ie('confirm-password', false); }

  if (isLandlord && !nationalId) { se('err-nid', true); ie('national-id', true); valid = false; }
  else { se('err-nid', false); ie('national-id', false); }

  if (!terms) { se('err-terms', true); valid = false; }
  else { se('err-terms', false); }

  if (!valid) return;

  const result = Auth.register({
    name: firstName + ' ' + lastName,
    email, phone, district, password,
    role: isLandlord ? 'landlord' : 'tenant',
    nationalId
  });

  if (!result.ok) {
    se('err-email', true, result.msg);
    ie('email', true);
    return;
  }

  document.getElementById('success-overlay').classList.add('show');
  document.getElementById('register-form').reset();
  const fill = document.getElementById('strength-fill');
  if (fill) fill.style.width = '0%';
  const lbl = document.getElementById('strength-label');
  if (lbl) lbl.textContent = 'Enter a password';
  if (typeof selectRole === 'function') selectRole('tenant');

  setTimeout(() => {
    const inPages = location.pathname.includes('/pages/');
    window.location.href = inPages ? 'listings.html' : 'pages/listings.html';
  }, 2500);
}

// ─────────────────────────────────────────
// LOGIN HANDLER
// ─────────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  let valid = true;

  function se(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'block' : 'none';
  }
  function ie(id, has) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('input-error', has);
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) { se('err-email', true); ie('email', true); valid = false; }
  else { se('err-email', false); ie('email', false); }

  if (!password) { se('err-password', true); ie('password', true); valid = false; }
  else { se('err-password', false); ie('password', false); }

  if (!valid) return;

  const result = Auth.login(email, password);
  if (!result.ok) {
    const alertEl = document.getElementById('alert-error');
    const alertMsg = document.getElementById('alert-msg');
    if (alertEl && alertMsg) {
      alertMsg.textContent = result.msg;
      alertEl.classList.add('show');
      setTimeout(() => alertEl.classList.remove('show'), 5000);
    }
    return;
  }

  showToast('✅ Welcome back, ' + result.user.name.split(' ')[0] + '!');
  setTimeout(() => {
    const inPages = location.pathname.includes('/pages/');
    window.location.href = inPages ? 'listings.html' : 'pages/listings.html';
  }, 800);
}

// ─────────────────────────────────────────
// AUTO-INIT ON EVERY PAGE
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initScrollHighlight();
});

// ─────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────
window.Auth = Auth;
window.listings = listings;
window.formatUGX = formatUGX;
window.getInitials = getInitials;
window.renderListings = renderListings;
window.toggleFav = toggleFav;
window.filterListings = filterListings;
window.initTabs = initTabs;
window.showToast = showToast;
window.initScrollHighlight = initScrollHighlight;
window.restoreFavs = restoreFavs;
window.handleRegister = handleRegister;
window.handleLogin = handleLogin;
window.redirectIfLoggedIn = redirectIfLoggedIn;