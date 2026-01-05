// --- 1. IMPORTS ---
// Ensure this path matches where your firebase.js is located
import { db } from './js/firebase.js'; 
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// --- 2. GLOBAL VARIABLES ---
let map;
let featureGroup; // We make this global so we can add markers to it later
let allShops = [];
let currentPage = 1;
const itemsPerPage = 10;

// Helper: Calculate Distance
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// --- 3. SEARCH FUNCTIONS (Attached to Window) ---

window.findShopsByText = async function() {
    const location = document.getElementById('locationInput').value;
    if (!location) return alert("Please enter a location");
    
    const searchBtn = document.querySelector('.search-box button');
    const originalText = searchBtn.innerText;
    searchBtn.innerText = "Searching...";
    searchBtn.disabled = true;

    try {
        const geoUrl = `https://nominatim.openstreetmap.org/search?q=${location}&format=json&limit=1`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (geoData.length === 0) {
            alert("Location not found.");
            return;
        }

        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);

        await fetchShopsFromFirebase(lat, lon);

    } catch (error) {
        console.error("Error:", error);
        alert("Could not find location.");
    } finally {
        searchBtn.innerText = originalText;
        searchBtn.disabled = false;
    }
};

window.findShopsByGeo = function() {
    if (!navigator.geolocation) return alert("Geolocation not supported by your browser");
    
    const btn = document.getElementById('geoBtn');
    const originalHtml = btn.innerHTML; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            fetchShopsFromFirebase(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            console.error("Geo Error:", error);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            alert("Location access denied. Please enable GPS.");
        }
    );
};

// --- 4. FIREBASE FETCH FUNCTION ---
async function fetchShopsFromFirebase(userLat, userLon) {
    // FIX 1: Clear old data immediately so map doesn't show ghost markers
    allShops = []; 
    document.getElementById('resultSection').style.display = 'block';
    
    // FIX 2: Initialize map with ONLY user location first
    initMap(userLat, userLon);

    try {
        const q = query(collection(db, "shops"), where("status", "==", "approved"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No approved shops found.");
            document.getElementById('shopCount').innerText = "0";
            document.getElementById('shopList').innerHTML = "<p>No shops found nearby.</p>";
            return;
        }

        const tempShops = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.lat && data.lon) {
                const dist = getDistance(userLat, userLon, data.lat, data.lon);
                // 50km Radius Filter
                if (dist <= 50) { 
                    tempShops.push({
                        id: doc.id,
                        ...data, 
                        distance: parseFloat(dist.toFixed(2))
                    });
                }
            }
        });

        allShops = tempShops.sort((a, b) => a.distance - b.distance);
        document.getElementById('shopCount').innerText = allShops.length;
        
        // FIX 3: Plot new markers NOW, after we have the new data
        plotShopMarkers();
        
        renderPage();

    } catch (err) {
        console.error("Firebase Error:", err);
        alert("Database error: " + err.message);
    }
}

// --- 5. MAP & RENDER FUNCTIONS ---

function initMap(lat, lon) {
    if (map) {
        map.remove(); // Reset map if it already exists
    }
    
    map = L.map('map').setView([lat, lon], 13);
    
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Initialize the group that will hold our markers
    featureGroup = L.featureGroup().addTo(map);

    // Add ONLY the User Marker (Blue)
    L.marker([lat, lon]).addTo(featureGroup)
        .bindPopup("<b>You are here</b>")
        .openPopup();
}

// NEW FUNCTION: Handles plotting shops separately
function plotShopMarkers() {
    allShops.forEach(shop => {
         L.circleMarker([shop.lat, shop.lon], { 
             color: 'red', 
             radius: 8, 
             fillColor: '#f03', 
             fillOpacity: 0.5 
         })
         .addTo(featureGroup)
         .bindPopup(`<b>${shop.name}</b><br>${shop.distance} km`);
    });

    // Auto-zoom to show all shops + user
    if (allShops.length > 0) {
        map.fitBounds(featureGroup.getBounds(), { padding: [50, 50] });
    }
}

function renderPage() {
    const listContainer = document.getElementById('shopList');
    listContainer.innerHTML = "";
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageShops = allShops.slice(start, end);

    if (pageShops.length === 0 && allShops.length > 0) {
        // Handle edge case if pagination goes out of bounds
        currentPage = 1;
        renderPage();
        return;
    }

    pageShops.forEach(shop => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        
        const badge247 = shop.isOpen247 
            ? `<span style="background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold; border: 1px solid #2e7d32; margin-left: 10px;">🟢 24/7</span>` 
            : ``;

        card.innerHTML = `
            <div class="shop-info">
                <h3>${shop.name} ${badge247}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${shop.address} - ${shop.pincode}</p>
                <p><i class="fas fa-phone"></i> ${shop.phone || "N/A"}</p>
                <span class="distance-badge">${shop.distance} km away</span>
            </div>
            <div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}" 
               target="_blank" class="direction-btn">Get Directions</a>
            </div>
        `;
        listContainer.appendChild(card);
    });

    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = end >= allShops.length;
    document.getElementById('pageIndicator').innerText = `Page ${currentPage}`;
}

window.changePage = function(d) {
    currentPage += d;
    renderPage();
};