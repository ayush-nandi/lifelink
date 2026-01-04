// --- 1. FIREBASE CONFIGURATION ---
// PASTE YOUR REAL KEYS HERE
const firebaseConfig = {
    apiKey: "AIzaSyAr3oQxAOXOtFeQIdm83dMaLj2n2ibsHYk",
    authDomain: "lifelink-a61c1.firebaseapp.com",
    projectId: "lifelink-a61c1",
    storageBucket: "lifelink-a61c1.firebasestorage.app",
    messagingSenderId: "473418229264",
    appId: "1:473418229264:web:628e0e8286d2b20cf40c95"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// --- 2. GLOBAL VARIABLES ---
let map;
let allShops = [];
let currentPage = 1;
const itemsPerPage = 10;

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// --- 3. SEARCH FUNCTIONS ---

async function findShopsByText() {
    const location = document.getElementById('locationInput').value;
    if (!location) return alert("Please enter a location");
    const searchBtn = document.querySelector('.search-box button');
    searchBtn.innerText = "Searching...";

    try {
        const geoUrl = `https://nominatim.openstreetmap.org/search?q=${location}&format=json&limit=1`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (geoData.length === 0) {
            alert("Location not found.");
            searchBtn.innerText = "Search";
            return;
        }

        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);

        await fetchShopsFromFirebase(lat, lon);

    } catch (error) {
        console.error("Error:", error);
        alert("Could not find location.");
    } finally {
        searchBtn.innerText = "Search";
    }
}

function findShopsByGeo() {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    const btn = document.getElementById('geoBtn');
    const originalText = btn.innerHTML; 
    btn.innerText = "Locating...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            btn.innerHTML = originalText;
            fetchShopsFromFirebase(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            console.error("Geo Error:", error);
            btn.innerHTML = originalText;
            alert("Location access denied.");
        }
    );
}

// --- 4. FIREBASE FETCH FUNCTION ---
async function fetchShopsFromFirebase(userLat, userLon) {
    document.getElementById('resultSection').style.display = 'block';
    initMap(userLat, userLon);

    try {
        const snapshot = await db.collection('shops')
                                 .where('status', '==', 'approved')
                                 .get();

        if (snapshot.empty) {
            console.log("No approved shops found.");
            document.getElementById('shopCount').innerText = "0";
            return;
        }

        const tempShops = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const dist = getDistance(userLat, userLon, data.lat, data.lon);
            
            // 50km Radius Filter
            if (dist <= 50) { 
                tempShops.push({
                    id: doc.id,
                    ...data, 
                    distance: parseFloat(dist.toFixed(2))
                });
            }
        });

        allShops = tempShops.sort((a, b) => a.distance - b.distance);
        document.getElementById('shopCount').innerText = allShops.length;
        renderPage();

    } catch (err) {
        console.error("Firebase Error:", err);
        alert("Database error: " + err.message);
    }
}

// --- 5. MAP & RENDER FUNCTIONS ---
function initMap(lat, lon) {
    if (map) map.remove(); 
    map = L.map('map'); // Init without view
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const featureGroup = L.featureGroup().addTo(map);

    // User Marker
    const userMarker = L.marker([lat, lon]).bindPopup("<b>You are here</b>");
    userMarker.addTo(featureGroup);

    // Shop Markers
    allShops.forEach(shop => {
         const marker = L.circleMarker([shop.lat, shop.lon], { color: 'red', radius: 8 })
            .bindPopup(`<b>${shop.name}</b>`);
        marker.addTo(featureGroup);
    });

    map.fitBounds(featureGroup.getBounds(), { padding: [50, 50] });
}

function renderPage() {
    const listContainer = document.getElementById('shopList');
    listContainer.innerHTML = "";
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageShops = allShops.slice(start, end);

    pageShops.forEach(shop => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        
        // CHECK: Is the shop 24/7?
        const badge247 = shop.isOpen247 
            ? `<span style="background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold; border: 1px solid #2e7d32; margin-left: 10px;">🟢 Open 24/7</span>` 
            : ``;

        // Note: We deliberately DO NOT show DL Number or PAN here for privacy
        card.innerHTML = `
            <div class="shop-info">
                <h3 style="display:flex; align-items:center;">
                    ${shop.name} 
                    ${badge247}
                </h3>
                <p>Address: ${shop.address} - ${shop.pincode}</p>
                <p>Phone: ${shop.phone || "N/A"}</p>
                <span class="distance-badge">${shop.distance} km away</span>
            </div>
            <div>
                <a href="http://googleusercontent.com/maps.google.com/?q=${shop.lat},${shop.lon}" 
                   target="_blank" class="direction-btn">Directions</a>
            </div>
        `;
        listContainer.appendChild(card);
    });

    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = end >= allShops.length;
    document.getElementById('pageIndicator').innerText = `Page ${currentPage}`;
}

function changePage(d) {
    currentPage += d;
    renderPage();
}