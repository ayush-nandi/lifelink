import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let campLat = null;
let campLng = null;

// SECURITY: Only allow users present in camp_makers
onAuthStateChanged(auth, async (user) => {
    if (!user) window.location.href = "login.html";
    const snap = await getDoc(doc(db, "camp_makers", user.uid));
    if (!snap.exists()) {
        alert("Verification required to access this page.");
        window.location.href = "camps-dashboard.html";
    }
});

// MAP LOGIC
const map = L.map('map').setView([22.5726, 88.3639], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let marker = null;
map.on('click', (e) => {
    campLat = e.latlng.lat;
    campLng = e.latlng.lng;
    if (marker) map.removeLayer(marker);
    marker = L.marker([campLat, campLng]).addTo(map);
});

// SEARCH (Nominatim)
document.getElementById("searchBtn").onclick = async () => {
    const q = document.getElementById("mapSearch").value;
    if (!q) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.length > 0) {
        campLat = data[0].lat;
        campLng = data[0].lon;
        map.setView([campLat, campLng], 15);
        if (marker) map.removeLayer(marker);
        marker = L.marker([campLat, campLng]).addTo(map);
    }
};

// FINAL SUBMISSION
document.getElementById("submitBtn").onclick = async () => {
    if (!campLat || !campLng) return alert("Select location on map!");

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.innerText = "Publishing...";

    const campData = {
        campTitle: document.getElementById("campTitle").value,
        campDescription: document.getElementById("campDescription").value,
        campDate: document.getElementById("campDate").value,
        startTime: document.getElementById("startTime").value,
        endTime: document.getElementById("endTime").value,
        expectedParticipants: document.getElementById("expectedParticipants").value,
        eligibilityCriteria: document.getElementById("eligibilityCriteria").value,
        locationText: document.getElementById("locationText").value,
        landmark: document.getElementById("landmark").value,
        city: document.getElementById("city").value,
        pincode: document.getElementById("pincode").value,
        lat: campLat,
        lng: campLng,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        status: "active"
    };

    try {
        await addDoc(collection(db, "camps"), campData);
        alert("Camp published successfully!");
        window.location.href = "camps-dashboard.html";
    } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.innerText = "PUBLISH CAMP";
    }
};