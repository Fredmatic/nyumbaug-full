// ── NYUMBA UG — Main JS ──

// Sample listing data (replace with real API/backend)
const listings = [
  {
    id: 1,
    title: "Modern 3-Bedroom Apartment",
    location: "Kololo, Kampala",
    price: 1800000,
    type: "house",
    bedrooms: 3,
    bathrooms: 2,
    area: 140,
    badge: "new",
    image: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=600&q=80",
    featured: true,
    description: "Spacious modern house in the heart of Kololo with stunning city views, fully fitted kitchen, and 24/7 security.",
    amenities: ["WiFi", "Parking", "Generator", "Security", "Water Tank", "Balcony"],
    landlord: "Mr. Ssekate Isaac",
    phone: "+256 783 641 973",
    available: "Available"
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
    landlord: "Mrs. Nassazi Allen",
    phone: "+256 779 753333",
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
    image: "/images/self-contained.jpg",
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
    landlord: "Dr. Baliyambala Uthor",
    phone: "+256 743 692 523",
    available: "Immediately"
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
    landlord: "Mr. Claude Martins",
    phone: "+256 744 541 025",
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
    landlord: "Mrs. Aggie ",
    phone: "+256 708683630",
    available: "1st Feb 2026"
  },
  {
    id: 7,
    title: "Luxury 3-Bedroom Duplex",
    location: "Kansanga, Kampala",
    price: 5000000,
    type: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    area: 220,
    badge: "new",
    image: "/images/house1.jpg",
    featured: true,
    description: "Prestigious duplex apartment in Naguru with panoramic views of Kampala. High-end finishes throughout.",
    amenities: ["WiFi", "Parking", "Generator", "Security", "Swimming Pool", "Gym", "Water Tank"],
    landlord: "Mrs. Nakito Jojo ",
    phone: "+256 743 615 589",
    available: "25th May 2026"
  }
  ,
  {
    id: 8,
    title: "Luxury 1-Bedroom Duplex",
    location: "Kawempe, Kampala",
    price: 150000,
    type: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    area: 20,
    badge: "available",
    image: "/images/sub-apartment.jpg",
    gallery: {
      kitchen: "images/house1-kitchen.jpg",
      kitchen: "images/house2-livingroom.jpg",
    },
    featured: true,
    description: "Prestigious duplex apartment in Kawempe with panoramic views of Kampala.",
    amenities: ["WiFi", "Parking", "Generator", "Security"],
    landlord: "Mrs. Nakasumba Penina ",
    phone: "+256 740 193 837",
    available: "20th May 2026"
  },
  {
    id: 9,
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
    landlord: "Dr. Joshua Nduhura",
    phone: "+256 759 514123",
    available: "15th Jan 2026"
  },
  {
    id: 10,
    title: "3-Bedroom Bungalow",
    location: "Kira, Wakiso",
    price: 900000,
    type: "house",
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    badge: "available",
    image: "/images/fancy.jpg",
    featured: false,
    description: "Affordable and spacious bungalow in developing Kira suburb. Great for families looking for value.",
    amenities: ["Parking", "Water Tank", "Compound"],
    landlord: "Mrs. Namubiru Jane",
    phone: "+256 766513833",
    available: "Immediately"
  },
  {
    id: 11,
    title: "Luxury 3-Bedroom house",
    location: "Naguru, Kampala",
    price: 4000000,
    type: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    area: 230,
    badge: "available",
    image: "https://res.cloudinary.com/dxvium3me/image/upload/v1779952865/fancy2_dpn4bb.jpg",
    featured: true,
    description: "Prestigious house apartment in Kansanga with panoramic views of Kampala. High-end finishes throughout.",
    amenities: ["WiFi", "Parking", "Generator", "Security", "Gym", "Water Tank"],
    landlord: "Mr. Stanely IphoneSang",
    phone: "+256 706 272 875",
    available: "2st Feb 2025"
  }
];

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

  container.innerHTML = data.map(l => {
    const isNew = l.badge === 'new' || l.status === 'active';
    const badgeText = l.badge === 'new' ? 'New' : 'Available';
    const badgeClass = l.badge === 'new' ? 'new' : '';
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
    <div class="listing-card" onclick="window.location.href='${detailPath}?id=${l.id}'">
      <div class="listing-img">
        <img src="${image}" alt="${l.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80'" />
        <span class="listing-badge ${badgeClass}">${badgeText}</span>
        <button class="listing-fav" onclick="toggleFav(event, this, '${l.id}')" aria-label="Save listing">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
      </div>
      <div class="listing-body">
        <div class="listing-price">${formatUGX(l.price)} <span>/ month</span></div>
        <div class="listing-title">${l.title}</div>
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
  }).join('');
}

// Favourite toggle
function toggleFav(e, btn, id) {
  e.stopPropagation();
  btn.classList.toggle('liked');
  const saved = JSON.parse(localStorage.getItem('nyumba-favs') || '[]');
  const idx = saved.indexOf(id);
  if (idx === -1) {
    saved.push(id);
    showToast('❤️ Saved to favourites');
  } else {
    saved.splice(idx, 1);
    showToast('Removed from favourites');
  }
  localStorage.setItem('nyumba-favs', JSON.stringify(saved));
}

// Filter listings
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

// Tab switching
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterListings();
    });
  });
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
      if (link.getAttribute('href') === path || link.getAttribute('href') === '..' + '/' + path) {
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
    const id = parseInt(btn.getAttribute('onclick').match(/\d+/)?.[0] || 0);
    if (saved.includes(id)) btn.classList.add('liked');
  });
}

// Export for inline use
window.listings = listings;
window.formatUGX = formatUGX;
window.renderListings = renderListings;
window.toggleFav = toggleFav;
window.filterListings = filterListings;
window.initTabs = initTabs;
window.showToast = showToast;
window.initScrollHighlight = initScrollHighlight;
window.restoreFavs = restoreFavs;
// Init homepage featured listings
document.addEventListener('DOMContentLoaded', () => {
  const featuredContainer = document.getElementById('featured-listings');
  if (featuredContainer) {
    const featured = listings.filter(l => l.featured);
    renderListings(featured, 'featured-listings');
  }

  // Init listings page
  const listingsContainer = document.getElementById('listings-container');
  if (listingsContainer) {
    renderListings(listings, 'listings-container');
    initTabs();
  }

  restoreFavs();
  initScrollHighlight();
});