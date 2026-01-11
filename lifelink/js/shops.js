// --- 1. IMPORTS ---
// Ensure this path matches where your firebase.js is located
import { db,auth } from './firebase.js'; 
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, getDoc, setDoc, increment, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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

// --- 1. RENDER FUNCTION (Modified for Click-to-Expand) ---
function renderPage() {
    const listContainer = document.getElementById('shopList');
    listContainer.innerHTML = "";
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageShops = allShops.slice(start, end);

    pageShops.forEach(shop => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        // We add an ID to the details div so we can toggle it
        const detailsId = `details-${shop.id}`;
        
        const badge247 = shop.isOpen247 
            ? `<span style="font-size:0.8em; background:#e8f5e9; color:#2e7d32; padding:2px 8px; border-radius:10px; border:1px solid #2e7d32;">24/7</span>` 
            : ``;

        // HTML Structure: Summary (Visible) + Details (Hidden)
        card.innerHTML = `
            <div class="shop-summary" onclick="toggleShopDetails('${shop.id}')">
                <div>
                    <h3>${shop.name} ${badge247}</h3>
                    <span class="distance-badge" style="margin-top:5px;">${shop.distance} km away</span>
                </div>
                <div style="color:var(--text-grey); font-size:1.2rem;">
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>

            <div id="${detailsId}" class="shop-details">
                <p><i class="fas fa-map-marker-alt" style="color:var(--primary-green); width:20px;"></i> ${shop.address} - ${shop.pincode}</p>
                <p><i class="fas fa-phone" style="color:var(--primary-green); width:20px;"></i> ${shop.phone || "N/A"}</p>
                
                <div class="action-buttons">
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}" 
                       target="_blank" 
                       class="icon-btn btn-direction"
                       onclick="trackAction('${shop.id}', 'directionClicks')">
                       <i class="fas fa-directions"></i> Get Directions
                    </a>
                    
                    <a href="tel:${shop.phone}" 
                       class="icon-btn"
                       onclick="trackAction('${shop.id}', 'phoneClicks')">
                       <i class="fas fa-phone-alt"></i> Call Now
                    </a>
                </div>
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
}

// --- 2. INTERACTION & ANALYTICS LOGIC ---

// Attached to window so HTML onclick can find it
window.toggleShopDetails = function(shopId) {
    const detailsDiv = document.getElementById(`details-${shopId}`);
    const isHidden = !detailsDiv.classList.contains('active');
    
    // Toggle UI
    if (isHidden) {
        // Close others (Optional: keeps UI clean)
        document.querySelectorAll('.shop-details').forEach(el => el.classList.remove('active'));
        
        detailsDiv.classList.add('active');
        // Record the View (Analytics)
        recordShopView(shopId);
    } else {
        detailsDiv.classList.remove('active');
    }
}

window.trackAction = function(shopId, type) {
    // type is 'directionClicks' or 'phoneClicks'
    recordAnalytics(shopId, type);
}

// --- 3. CORE ANALYTICS ENGINE ---

async function recordShopView(shopId) {
    const user = auth.currentUser;
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0]; // "2023-10-27"

    // A. PRELIMINARY CHECK (Local Storage) - Blocks spam from same device immediately
    const localKey = `view_${shopId}_${todayStr}`;
    if (localStorage.getItem(localKey)) {
        console.log("Analytics: View debounced locally.");
        return; 
    }

    // B. LOGGED-IN USER CHECK (Firestore) - Blocks spam from same account across devices
    if (user) {
        // Prevent owner from boosting their own shop
        // (Ideally we check this, but we need the shop ownerId available in the shop object)
        const shop = allShops.find(s => s.id === shopId);
        if (shop && shop.ownerId === user.uid) {
            console.log("Analytics: Owner viewing own shop ignored.");
            return;
        }

        const userViewRef = doc(db, "shops", shopId, "unique_views", user.uid);
        
        try {
            await runTransaction(db, async (transaction) => {
                const userViewDoc = await transaction.get(userViewRef);
                
                let shouldCount = true;
                if (userViewDoc.exists()) {
                    const lastViewed = userViewDoc.data().lastViewedAt.toMillis();
                    // Check if 24 hours have passed
                    if ((now - lastViewed) < 24 * 60 * 60 * 1000) {
                        shouldCount = false;
                    }
                }

                if (shouldCount) {
                    // 1. Update User Tracking Doc
                    transaction.set(userViewRef, { 
                        lastViewedAt: serverTimestamp(),
                        email: user.email // Optional: for debugging
                    });

                    // 2. Increment Daily Stats
                    const statsRef = doc(db, "shops", shopId, "stats", todayStr);
                    transaction.set(statsRef, { 
                        views: increment(1),
                        date: todayStr
                    }, { merge: true });
                    
                    console.log("Analytics: Verified View Recorded (User).");
                }
            });
            // Lock local storage after successful DB write
            localStorage.setItem(localKey, "true");

        } catch (e) {
            console.error("Analytics Error:", e);
        }

    } else {
        // C. GUEST USER (Just rely on LocalStorage + simple increment)
        // We accept that guests might clear cache and view again, but that's acceptable noise.
        const statsRef = doc(db, "shops", shopId, "stats", todayStr);
        await setDoc(statsRef, { 
            views: increment(1),
            date: todayStr
        }, { merge: true });
        
        localStorage.setItem(localKey, "true");
        console.log("Analytics: Guest View Recorded.");
    }
}

async function recordAnalytics(shopId, field) {
    const todayStr = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, "shops", shopId, "stats", todayStr);
    
    // We don't debounce clicks as strictly as views (user might mistakenly close map and reopen)
    try {
        await setDoc(statsRef, { 
            [field]: increment(1), // Uses computed property name
            date: todayStr 
        }, { merge: true });
        console.log(`Analytics: ${field} recorded.`);
    } catch (e) {
        console.error(e);
    }
}

// --- AUTH LISTENER & ADMIN CHECK ---
// --- AUTH LISTENER & ADMIN CHECK ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Logged in user:", user.email);

        try {
            // Check the 'users' collection for the user's role
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                console.log("User Role:", userData.role); // Check console for this!

                // Accepts 'admin' or 'Admin' just in case
                if (userData.role === 'admin' || userData.role === 'Admin') {
                    injectAdminButton();
                }
            } else {
                console.log("No user profile found in database.");
            }
        } catch (error) {
            console.error("Error checking admin status:", error);
        }
    }
});

function injectAdminButton() {
    const navContainer = document.querySelector('.nav-links');
    
    // Prevent duplicate buttons
    if (document.getElementById('adminBtnLink')) return;

    if (navContainer) {
        // Create the button element
        const adminBtn = document.createElement('a');
        adminBtn.href = "admin-shop.html"; 
        adminBtn.id = "adminBtnLink";
        adminBtn.className = "nav-btn admin-link"; // Uses special CSS class
        adminBtn.innerHTML = `<i class="fas fa-shield-alt"></i> Admin Panel`;

        // Insert it BEFORE the "Register Shop" button
        navContainer.insertBefore(adminBtn, navContainer.firstChild);
        console.log("Admin button injected.");
    } else {
        console.error("Could not find .nav-links container");
    }
};