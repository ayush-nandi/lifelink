import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let eventLat = null;
let eventLng = null;
const searchInput = document.getElementById("locationSearchInput");
const searchBtn = document.getElementById("searchLocationBtn");

/* ---------- AUTH & ROLE ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "organizer") {
    alert("Only approved organizers can create events.");
    window.location.href = "dashboard.html";
  }
});

/* ---------- MAP ---------- */

const map = L.map("map").setView([22.5726, 88.3639], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let marker = null;
map.on("click", (e) => {
  eventLat = e.latlng.lat;
  eventLng = e.latlng.lng;

  if (marker) map.removeLayer(marker);
  marker = L.marker([eventLat, eventLng]).addTo(map);
});
if (searchBtn && searchInput) {
  searchBtn.addEventListener("click", async () => {
    const query = searchInput.value.trim();
    if (!query) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await res.json();

      if (!data.length) {
        alert("Location not found");
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      map.setView([lat, lng], 13);

      // Optional: drop marker immediately
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng]).addTo(map);

      // Organizer can still click to adjust
      eventLat = lat;
      eventLng = lng;

    } catch (err) {
      console.error(err);
      alert("Failed to search location");
    }
  });
}

/* ---------- FORM ---------- */
document.getElementById("eventForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!eventLat || !eventLng) {
    alert("Please select event location on the map.");
    return;
  }
  const startDateValue = document.getElementById("startDate").value;
const endDateValue = document.getElementById("endDate").value;

const startDate = new Date(startDateValue);
const endDate = new Date(endDateValue);

  await addDoc(collection(db, "events"), {
  title: document.getElementById("eventTitle").value,
  type: document.getElementById("donationType").value,
  mode: document.getElementById("mode").value,

  startDate: startDate,
  endDate: endDate,

  radius: Number(document.getElementById("radius").value),
  locationText: document.getElementById("locationText").value,
  lat: eventLat,
  lng: eventLng,
  organizerId: auth.currentUser.uid,
  status: "approved",
  createdAt: serverTimestamp()
});

  alert("Event created successfully!");
  window.location.href = "dashboard.html";
});
