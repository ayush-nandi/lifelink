import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    collection, query, where, getDocs, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let map, markerGroup;
let userLat, userLng;
let currentUser = null;
let userRegistrations = []; // Local array to track joined camp IDs

// Initialize Map
map = L.map('map').setView([22.5726, 88.3639], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
markerGroup = L.layerGroup().addTo(map);

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        currentUser = user;
        // Fetch current user's registrations on load
        await fetchUserRegistrations();
    }
});

// Helper to fetch user registrations
async function fetchUserRegistrations() {
    if (!currentUser) return;
    const q = query(collection(db, "camp_registrations"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    userRegistrations = snap.docs.map(doc => doc.data().campId);
}

// Calculate Distance
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// Search Logic
document.getElementById("searchBtn").onclick = async () => {
    const queryStr = document.getElementById("searchInput").value;
    if (!queryStr) return;

    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}`);
    const data = await res.json();
    
    if (data.length > 0) {
        userLat = data[0].lat;
        userLng = data[0].lon;
        map.setView([userLat, userLng], 13);
        loadCamps();
    }
};

async function loadCamps() {
    const q = query(collection(db, "camps"), where("status", "==", "active"));
    const snap = await getDocs(q);
    const listContainer = document.getElementById("campList");
    listContainer.innerHTML = "";
    markerGroup.clearLayers();

    let found = false;

    snap.forEach(docSnap => {
        const camp = docSnap.data();
        const dist = getDistance(userLat, userLng, camp.lat, camp.lng);

        if (dist < 20) {
            found = true;
            renderCampCard(docSnap.id, camp, dist);
            addMapMarker(camp);
        }
    });

    if (!found) {
        listContainer.innerHTML = `<p class="text-center py-10 text-slate-400 font-bold">No camps found in this area.</p>`;
    }
}

function renderCampCard(id, camp, dist) {
    const isJoined = userRegistrations.includes(id);
    const div = document.createElement("div");
    div.className = "bg-white p-6 rounded-[2rem] shadow-md border-2 border-transparent hover:border-yellow-400 transition-all";
    
    div.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h3 class="font-black text-lg text-slate-800">${camp.campTitle}</h3>
            <span class="text-[10px] bg-yellow-100 px-2 py-1 rounded-full font-black">${dist.toFixed(1)} km</span>
        </div>
        <p class="text-sm text-slate-500 mb-4 line-clamp-2">${camp.campDescription}</p>
        <div class="text-xs font-bold text-slate-400 flex gap-4 mb-4 uppercase">
            <span>📅 ${camp.campDate}</span>
            <span>⏰ ${camp.startTime}</span>
        </div>
        <button id="regBtn-${id}" 
            onclick="openRegModal('${id}', '${camp.campTitle}', '${camp.campDate}')" 
            ${isJoined ? 'disabled' : ''}
            class="w-full ${isJoined ? 'bg-slate-300 cursor-not-allowed text-slate-500' : 'bg-yellow-400 hover:bg-yellow-500'} py-3 rounded-xl font-black text-sm transition-all uppercase">
            ${isJoined ? 'Registered' : 'Register Now'}
        </button>
    `;
    document.getElementById("campList").appendChild(div);
}

function addMapMarker(camp) {
    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style='background-color: #facc15; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); font-size: 15px;'>⛺</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });

    L.marker([camp.lat, camp.lng], {icon: customIcon})
     .addTo(markerGroup)
     .bindPopup(`<b class="font-black text-yellow-600">${camp.campTitle}</b><br>${camp.locationText}`);
}

// Modal Logic
window.openRegModal = (id, title, date) => {
    document.getElementById("selectedCampId").value = id;
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalDate").innerText = date;
    document.getElementById("regModal").classList.replace("hidden", "flex");
};

window.closeModal = () => {
    document.getElementById("regModal").classList.replace("flex", "hidden");
};

document.getElementById("registrationForm").onsubmit = async (e) => {
    e.preventDefault();
    const campId = document.getElementById("selectedCampId").value;
    const btn = e.target.querySelector("button");
    const mainListBtn = document.getElementById(`regBtn-${campId}`);

    btn.disabled = true;
    btn.innerText = "Registering...";

    try {
        // 1. Check database for existing registration again for safety
        const checkQ = query(
            collection(db, "camp_registrations"), 
            where("userId", "==", currentUser.uid),
            where("campId", "==", campId)
        );
        const checkSnap = await getDocs(checkQ);

        if (!checkSnap.empty) {
            alert("You are already registered for this camp.");
            updateButtonState(mainListBtn);
            closeModal();
            return;
        }

        // 2. Perform Registration
        await addDoc(collection(db, "camp_registrations"), {
            campId: campId,
            userId: currentUser.uid,
            userName: document.getElementById("regName").value,
            userPhone: document.getElementById("regPhone").value,
            registeredAt: serverTimestamp(),
            status: "confirmed"
        });

        // 3. Update UI Immediately
        userRegistrations.push(campId); // Update local state
        updateButtonState(mainListBtn);
        closeModal();
        
        // Use a clean custom alert instead of browser alert if possible, 
        // but sticking to standard alert for simplicity as per your current logic
        console.log("Registered successfully");

    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirm Registration";
    }
};

// Function to visually disable the main list button
function updateButtonState(btnElement) {
    if (btnElement) {
        btnElement.innerText = "Registered";
        btnElement.disabled = true;
        btnElement.classList.remove("bg-yellow-400", "hover:bg-yellow-500");
        btnElement.classList.add("bg-slate-300", "cursor-not-allowed", "text-slate-500");
    }
}