import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* -----------------------------------------------------------
   1. GLOBAL STATE & CONFIG
   ----------------------------------------------------------- */
let userLocation = null;
let selectedEventId = null;
let activeDonation = null;
let map, marker;

const eventsContainer = document.getElementById("eventsContainer");
const modal = document.getElementById("registerModal");
const regForm = document.getElementById("registerForm");

/* -----------------------------------------------------------
   2. INITIALIZATION & AUTH
   ----------------------------------------------------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html"; // Standardized security redirect
  } else {
    // Check if user is already registered for an event
    await checkExistingRegistration();
  }
});

// Initialize Map with default view (Kolkata)
map = L.map("map").setView([22.5726, 88.3639], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Click map to set custom location
map.on("click", (e) => setUserLocation(e.latlng.lat, e.latlng.lng));

/* -----------------------------------------------------------
   3. LOCATION LOGIC
   ----------------------------------------------------------- */
async function setUserLocation(lat, lng) {
  userLocation = { lat, lng };

  // UI: Update Marker
  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lng]).addTo(map);
  map.setView([lat, lng], 14);

  // FIX: Force Leaflet to refresh container size to prevent grey tiles
  setTimeout(() => map.invalidateSize(), 200);

  loadEvents();
}

// Browser Geolocation
document.getElementById("detectLocationBtn").onclick = () => {
  navigator.geolocation.getCurrentPosition(
    pos => setUserLocation(pos.coords.latitude, pos.coords.longitude),
    () => alert("Please enable location permissions in your browser.")
  );
};

// Nominatim Search (Address to Coordinates)
document.getElementById("searchLocationBtn").onclick = async () => {
  const queryInput = document.getElementById("locationSearchInput").value.trim();
  if (!queryInput) return;

  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryInput)}`, {
    headers: { "User-Agent": "LifeLink-Production-App" }
  });
  const data = await res.json();
  if (!data.length) return alert("Area not found. Please try a different name.");

  setUserLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
};

/* -----------------------------------------------------------
   4. DISTANCE & DATA FETCHING
   ----------------------------------------------------------- */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function checkExistingRegistration() {
  const q = query(
    collection(db, "donations"),
    where("donorId", "==", auth.currentUser.uid),
    where("status", "==", "registered")
  );
  const snap = await getDocs(q);
  activeDonation = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function loadEvents() {
  if (!userLocation) return;
  eventsContainer.innerHTML = `<p class="text-slate-400 animate-pulse text-center py-10">Scanning for events within range...</p>`;

  const snap = await getDocs(query(collection(db, "events"), where("status", "==", "approved")));
  let filteredEvents = [];
  let maxRadiusSeen = 10;

  snap.forEach(docSnap => {
    const ev = docSnap.data();
    const dist = calculateDistance(userLocation.lat, userLocation.lng, ev.lat, ev.lng);
    const radius = ev.radius || 10;
    if (radius > maxRadiusSeen) maxRadiusSeen = radius;

    if (dist <= radius) {
      filteredEvents.push({ ...ev, id: docSnap.id, dist });
    }
  });

  filteredEvents.sort((a, b) => a.dist - b.dist);
  renderEvents(filteredEvents, maxRadiusSeen);
}

/* -----------------------------------------------------------
   5. RENDER & MODAL LOGIC
   ----------------------------------------------------------- */
function renderEvents(list, radius) {
  eventsContainer.innerHTML = "";

  if (list.length === 0) {
    eventsContainer.innerHTML = `
      <div class="bg-white border-2 border-dashed border-slate-200 p-12 rounded-[2rem] text-center">
        <p class="text-slate-400 text-lg font-medium">No events found within ${radius}km.</p>
        <p class="text-slate-500 text-sm mt-1">Try expanding your search or selecting a new location on the map.</p>
      </div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  list.forEach(ev => {
    const isThisEventRegistered = activeDonation && activeDonation.eventId === ev.id;
    
    const card = document.createElement("div");
    card.className = "bg-white p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group border border-slate-50";

    card.innerHTML = `
      <div>
        <div class="flex justify-between items-start mb-4">
          <span class="text-[10px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-full uppercase tracking-tighter">${ev.type}</span>
          <span class="text-xs font-bold text-slate-400">📍 ${ev.dist.toFixed(1)} km</span>
        </div>
        <h4 class="text-xl font-black text-slate-900 leading-tight group-hover:text-red-600 transition-colors">${ev.title}</h4>
        <p class="text-slate-500 text-sm mt-2 font-medium">${ev.locationText}</p>
      </div>
      
      <button class="action-btn mt-6 w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-md">
        ${isThisEventRegistered ? 'Cancel Registration' : (activeDonation ? 'Already Registered Elsewhere' : 'Register Now')}
      </button>
    `;

    const btn = card.querySelector(".action-btn");
    
    // Logic for Button States
    if (isThisEventRegistered) {
      btn.className += " bg-orange-100 text-orange-600 hover:bg-orange-200";
      btn.onclick = () => cancelReg(activeDonation.id);
    } else if (activeDonation) {
      btn.className += " bg-slate-100 text-slate-400 cursor-not-allowed";
      btn.disabled = true;
    } else {
      btn.className += " bg-red-600 text-white hover:bg-red-700 shadow-red-100";
      btn.onclick = () => openModal(ev.id);
    }

    grid.appendChild(card);
  });
  eventsContainer.appendChild(grid);
}

/* -----------------------------------------------------------
   6. ACTIONS (REGISTER / CANCEL)
   ----------------------------------------------------------- */
function openModal(eventId) {
  selectedEventId = eventId;
  modal.classList.replace("hidden", "flex");
}

document.getElementById("cancelModalBtn").onclick = () => modal.classList.replace("flex", "hidden");

regForm.onsubmit = async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("confirmRegBtn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Processing...";

  try {
    await addDoc(collection(db, "donations"), {
      eventId: selectedEventId,
      donorId: auth.currentUser.uid,
      donorName: document.getElementById("donorName").value,
      donorPhone: document.getElementById("donorPhone").value,
      status: "registered",
      createdAt: serverTimestamp()
    });
    
    modal.classList.replace("flex", "hidden");
    await checkExistingRegistration();
    loadEvents();
  } catch (err) {
    alert("Error registering. Please try again.");
    submitBtn.disabled = false;
  }
};

async function cancelReg(docId) {
  if (!confirm("Are you sure you want to cancel your donation registration?")) return;
  await updateDoc(doc(db, "donations", docId), { status: "cancelled" });
  activeDonation = null;
  loadEvents();
}