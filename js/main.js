// ── NYUMBA UG — Main JS ──

// Format UGX price
function formatUGX(amount) {
  return "UGX " + amount.toLocaleString('en-UG');
}

// Render listing cards
function renderListings(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!data || !data.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-muted);grid-column:1/-1;">
      <div style="font-size:2.5rem;margin-bottom:12px;">🏠</div>
      <p>No listings found.</p>
    </div>`;
    return;
  }

  const isInPages = window.location.pathname.includes('/pages/');
  const detailPath = isInPages ? 'listing-detail.html' : 'pages/listing-detail.html';

  // ── Build card HTML (reused per listing) ──
  function buildCard(l) {
    const isRented = l.status === 'rented';
    const badgeText = isRented ? 'Rented' : (l.badge === 'new' || l.status === 'active' ? 'New' : 'Available');
    const badgeClass = isRented ? 'rented' : (l.badge === 'new' ? 'new' : '');
    const fallbacks = {
      apartment: 'images/fancy2.jpg',
      house: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80',
      studio: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80',
      townhouse: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80',
      mansion: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80',
    };
    const image = l.cover_image || l.image || fallbacks[l.type] || fallbacks.apartment;
    const location = l.neighbourhood || l.location || 'Kampala';
    const area = l.area_sqm || l.area || '—';
    const beds = l.bedrooms || 0;
    const baths = l.bathrooms || 0;

    return `
    <div class="listing-card${isRented ? ' listing-rented' : ''}" onclick="window.location.href='${detailPath}?id=${l.id}'">
      <div class="listing-img">
        <img src="${image}" alt="${l.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80'" />
        <span class="listing-badge ${badgeClass}">${badgeText}</span>
        ${isRented ? '<div class="rented-overlay"><span class="rented-label">RENTED</span></div>' : ''}
        <button class="listing-fav" onclick="toggleFav(event, this, '${l.id}')" aria-label="Save listing">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
      </div>
      <div class="listing-body">
        <div class="listing-price">${formatUGX(l.price)} <span>/ month</span></div>
        <div class="listing-title">${l.title} ${l.is_verified_landlord ? '<span style="font-size:0.75rem;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:50px;font-weight:600;vertical-align:middle;">✅ Verified</span>' : ''}</div>
        <div class="listing-location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${location}
        </div>
        <div class="listing-amenities">
          <div class="amenity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            ${beds} Bed${beds !== 1 ? 's' : ''}
          </div>
          <div class="amenity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16M4 6h16M4 18h16"/></svg>
            ${baths} Bath${baths !== 1 ? 's' : ''}
          </div>
          <div class="amenity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            ${area} m²
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Group listings by landlord ──
  const groups = {};
  const order = []; // preserve first-seen order
  data.forEach(l => {
    const key = l.landlord_id || 'unknown';
    if (!groups[key]) {
      groups[key] = {
        landlord_id: key,
        landlord_name: l.landlord_name || 'Landlord',
        is_verified: l.is_verified_landlord,
        listings: []
      };
      order.push(key);
    }
    groups[key].listings.push(l);
  });

  // ── If only 1 landlord or search is active — show normal grid ──
  if (order.length === 1) {
    container.style.display = '';
    container.innerHTML = data.map(buildCard).join('');
    return;
  }

  // ── Multiple landlords — Netflix rows ──
  container.style.display = 'block';
  container.innerHTML = order.map((key, rowIndex) => {
    const group = groups[key];
    const rowId = `landlord-row-${rowIndex}`;
    const cards = group.listings.map(buildCard).join('');
    const count = group.listings.length;

    return `
    <div class="landlord-row" style="margin-bottom:36px;">
      <!-- Row header -->
      <div style="display:flex;align-items:center;gap:10px;padding:0 4px;margin-bottom:12px;">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--green-dark);color:var(--gold);
          display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0;">
          ${group.landlord_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div>
          <div style="font-weight:700;color:var(--text-dark);font-size:0.95rem;">
            ${group.landlord_name}
            ${group.is_verified ? '<span style="font-size:0.72rem;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:50px;font-weight:600;margin-left:4px;">✅ Verified</span>' : ''}
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted);">${count} propert${count === 1 ? 'y' : 'ies'}</div>
        </div>
        <!-- Scroll arrows (desktop) -->
        <div style="margin-left:auto;display:flex;gap:6px;">
          <button onclick="scrollRow('${rowId}', -1)" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border);background:var(--white);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.background='var(--green-dark)';this.style.color='white'" onmouseout="this.style.background='var(--white)';this.style.color='inherit'">‹</button>
          <button onclick="scrollRow('${rowId}', 1)"  style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border);background:var(--white);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.background='var(--green-dark)';this.style.color='white'" onmouseout="this.style.background='var(--white)';this.style.color='inherit'">›</button>
        </div>
      </div>

      <!-- Horizontal scroll row -->
      <div id="${rowId}" style="
        display: flex;
        gap: 16px;
        overflow-x: auto;
        padding-bottom: 12px;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      " onscroll="updateScrollFade(this)">
        ${cards}
      </div>
    </div>`;
  }).join('');

  // Hide scrollbars on webkit
  document.querySelectorAll('[id^="landlord-row-"]').forEach(row => {
    row.style.cssText += 'scrollbar-width:none;';
  });

  // Constrain card width inside horizontal rows
  container.querySelectorAll('.listing-card').forEach(card => {
    card.style.minWidth = '280px';
    card.style.maxWidth = '280px';
    card.style.flex = '0 0 280px';
  });
}

// Scroll a landlord row left (-1) or right (1)
function scrollRow(rowId, direction) {
  const row = document.getElementById(rowId);
  if (row) row.scrollBy({ left: direction * 310, behavior: 'smooth' });
}



// Favourite toggle
function toggleFav(e, btn, id) {
  e.stopPropagation();
  btn.classList.toggle('liked');
  const saved = JSON.parse(localStorage.getItem('nyumba-favs') || '[]');
  const idx = saved.indexOf(String(id));
  if (idx === -1) {
    saved.push(String(id));
    showToast('❤️ Saved to favourites');
    // Notify landlord via API if logged in
    const user = typeof api !== 'undefined' ? api.auth.currentUser() : null;
    if (user && user.role === 'tenant' && typeof api !== 'undefined') {
      fetch(`${API_BASE}/listings/${id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nyumba_token')}`, 'Content-Type': 'application/json' }
      }).catch(() => { });
    }
  } else {
    saved.splice(idx, 1);
    showToast('Removed from favourites');
  }
  localStorage.setItem('nyumba-favs', JSON.stringify(saved));
}

// Tab switching for homepage
function initTabs(apiListings) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      const filtered = filter === 'all' ? apiListings : apiListings.filter(l => l.type === filter);
      renderListings(filtered.length ? filtered : apiListings, 'listings-container');
      setTimeout(restoreFavs, 50);
    });
  });
}

// Filter listings (used on listings.html page with API data stored in window.currentListings)
function filterListings() {
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const type = document.getElementById('filter-type')?.value || '';
  const maxPrice = document.getElementById('filter-price')?.value || '';

  const source = window.currentListings || [];
  let filtered = source.filter(l => {
    const loc = (l.neighbourhood || l.district || '').toLowerCase();
    const title = (l.title || '').toLowerCase();
    const matchSearch = !search || loc.includes(search) || title.includes(search);
    const matchType = !type || l.type === type;
    const matchPrice = !maxPrice || l.price <= parseInt(maxPrice);
    return matchSearch && matchType && matchPrice;
  });

  renderListings(filtered, 'listings-container');
}

// Toast notification
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

// Smooth scroll nav highlight
function initScrollHighlight() {
  const links = document.querySelectorAll('.nav-links a');
  window.addEventListener('scroll', () => {
    links.forEach(link => link.classList.remove('active'));
    const path = location.pathname.split('/').pop() || 'index.html';
    links.forEach(link => {
      if (link.getAttribute('href') === path || link.getAttribute('href') === '../index.html') {
        link.classList.add('active');
      }
    });
  });
}

// Load saved favs on cards
function restoreFavs() {
  const saved = JSON.parse(localStorage.getItem('nyumba-favs') || '[]');
  document.querySelectorAll('.listing-fav').forEach(btn => {
    const card = btn.closest('.listing-card');
    if (!card) return;
    const onclick = btn.getAttribute('onclick') || '';
    const match = onclick.match(/'([^']+)'\s*\)/);
    const id = match ? match[1] : '';
    if (id && saved.includes(String(id))) btn.classList.add('liked');
  });
}

// ── Mobile nav toggle ──
function toggleNav() {
  const nav = document.getElementById('nav-links');
  if (!nav) return;
  nav.classList.toggle('open');
  const btn = document.querySelector('.nav-toggle');
  if (btn) btn.classList.toggle('open');
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
window.formatUGX = formatUGX;
window.renderListings = renderListings;
window.toggleFav = toggleFav;
window.initTabs = initTabs;
window.filterListings = filterListings;
window.showToast = showToast;
window.initScrollHighlight = initScrollHighlight;
window.restoreFavs = restoreFavs;
window.toggleNav = toggleNav;

document.addEventListener('DOMContentLoaded', () => {
  // Close nav on link click
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      const nav = document.getElementById('nav-links');
      const btn = document.querySelector('.nav-toggle');
      if (nav) nav.classList.remove('open');
      if (btn) btn.classList.remove('open');
    });
  });
  restoreFavs();
  initScrollHighlight();
});