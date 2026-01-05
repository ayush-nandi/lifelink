//

// Global Variables
let map, userMarker, markersLayer;
let markersMap = {}; 
let userLat = null; 
let userLng = null;

// Custom Red Icon for Hospitals
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Blue Icon for User
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const hospitalList = document.getElementById("hospital-list");
  
  // Slider
  const radiusSlider = document.getElementById("radius-slider");
  const radiusVal = document.getElementById("radius-val");

  // Details Panel DOM
  const detailsPanel = document.getElementById("hospital-details");
  const detailName = document.getElementById("detail-name");
  
  // Contact Info DOM
  const detailAddress = document.getElementById("detail-address");
  const detailPhone = document.getElementById("detail-phone");
  const detailWebsite = document.getElementById("detail-website");
  const detailHours = document.getElementById("detail-hours");

  markersLayer = new L.LayerGroup();

  // --- MAP INIT ---
  map = L.map("map", { zoomControl: false }).setView([20.5937, 78.9629], 5);
  
  // Add Zoom Control to bottom right for better UI balance
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: 'OSM' }).addTo(map);
  markersLayer.addTo(map);

  // --- START UP ---
  locateAndFetchHospitals();

  // --- SLIDER LOGIC ---
  radiusSlider.addEventListener("input", () => {
    radiusVal.textContent = radiusSlider.value;
  });

  radiusSlider.addEventListener("change", () => {
    if (userLat && userLng) {
      fetchHospitalsIRL(userLat, userLng);
    } else {
      locateAndFetchHospitals();
    }
  });

  // --- LOCATION LOGIC ---
  function locateAndFetchHospitals() {
    if (!navigator.geolocation) {
      hospitalList.innerHTML = "<div class='empty-state'><p>Geolocation is not supported.</p></div>";
      return;
    }
    
    hospitalList.innerHTML = "<div class='empty-state'><p>📍 Locating you...</p></div>";
    
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        updateUserLocation(userLat, userLng);
        fetchHospitalsIRL(userLat, userLng);
      },
      err => {
         console.error(err);
         hospitalList.innerHTML = "<div class='empty-state'><p>⚠️ Location access denied.</p></div>";
      },
      { enableHighAccuracy: true }
    );
  }

  function updateUserLocation(lat, lng) {
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng], {icon: blueIcon}).addTo(map).bindPopup("<b>You are here</b>").openPopup();
    map.setView([lat, lng], 14);
  }

  // --- FETCHING DATA ---
  async function fetchHospitalsIRL(lat, lng) {
    const radiusKm = radiusSlider.value;
    const radiusMeters = radiusKm * 1000;
    
    hospitalList.innerHTML = `<div class='empty-state'><p>🔎 Scanning ${radiusKm}km radius...</p></div>`;
    
    const queryStr = `[out:json][timeout:45];(node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});way["amenity"="hospital"](around:${radiusMeters},${lat},${lng}););out center;`;
    
    const servers = [
      "https://overpass-api.de/api/interpreter",
      "https://lz4.overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ];

    for (const server of servers) {
      try {
        const res = await fetch(server + "?data=" + encodeURIComponent(queryStr));
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        
        const data = await res.json();
        displayHospitals(data.elements, lat, lng);
        return; 
      } catch (e) {
        console.warn(`Server ${server} failed:`, e);
      }
    }

    hospitalList.innerHTML = "<div class='empty-state'><p>⚠️ Map servers are busy. Try again.</p></div>";
  }

  function displayHospitals(elements, userLat, userLng) {
    hospitalList.innerHTML = "";
    markersLayer.clearLayers();
    markersMap = {};
    
    if (!elements || !elements.length) {
      hospitalList.innerHTML = "<div class='empty-state'><p>No hospitals found nearby.</p></div>";
      return;
    }

    const processed = elements.map(h => {
      const lat = h.lat || h.center.lat;
      const lng = h.lon || h.center.lon;
      const distMeters = L.latLng(userLat, userLng).distanceTo(L.latLng(lat, lng));
      
      const tags = h.tags || {};
      const info = {
        id: String(h.id),
        name: tags.name || "Unnamed Hospital",
        address: tags['addr:full'] || tags['addr:street'] || null,
        phone: tags['phone'] || tags['contact:phone'] || tags['contact:mobile'] || null,
        website: tags['website'] || tags['contact:website'] || tags['url'] || null,
        hours: tags['opening_hours'] || null,
        wikidata: tags['wikidata'] || null 
      };

      return { ...h, lat, lng, distMeters, info };
    });

    processed.sort((a, b) => a.distMeters - b.distMeters);

    processed.forEach(h => {
      const distKm = (h.distMeters / 1000).toFixed(1);

      // Create List Item
      const card = document.createElement("div");
      card.className = "hospital-card";
      card.innerHTML = `
        <span class="distance-tag">${distKm} km</span>
        <strong>${h.info.name}</strong>
      `;
      card.onclick = () => openHospitalDetails(h.info, h.lat, h.lng, false);
      hospitalList.appendChild(card);

      // Create Marker with RED ICON
      const marker = L.marker([h.lat, h.lng], {icon: redIcon});
      marker.bindPopup(`<b>${h.info.name}</b><br>${distKm} km away`);
      marker.on('click', () => openHospitalDetails(h.info, h.lat, h.lng, true));
      
      markersLayer.addLayer(marker);
      markersMap[h.info.id] = marker;
    });
  }

  // --- DETAILS PANEL LOGIC ---
  async function openHospitalDetails(info, lat, lng, isMapClick = false) {
    hospitalList.style.display = "none";
    detailsPanel.style.display = "flex"; // Changed to flex for new layout

    detailName.textContent = info.name;

    // Reset Fields
    showField(detailAddress, "Fetching address...");
    showField(detailPhone, "Checking...");
    showField(detailWebsite, "Checking...");
    detailWebsite.href = "#";
    showField(detailHours, "Checking...");

    if (!isMapClick) {
      map.flyTo([lat, lng], 16, { duration: 1.5 });
      if (markersMap[info.id]) markersMap[info.id].openPopup();
    }

    enrichHospitalData(info, lat, lng);
  }

  // --- UI HELPERS ---
  function showField(element, text) {
    element.textContent = text;
    element.closest('.info-item').style.display = "flex";
  }

  function hideField(element) {
    element.closest('.info-item').style.display = "none";
  }

  document.getElementById("back-btn").onclick = () => {
    detailsPanel.style.display = "none";
    hospitalList.style.display = "block";
    map.closePopup();
  };

  // --- DATA ENRICHMENT ---
  async function enrichHospitalData(info, lat, lng) {
    // 1. ADDRESS
    if (info.address) {
      detailAddress.textContent = info.address;
    } else {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.display_name) {
          detailAddress.textContent = data.display_name;
        } else {
          hideField(detailAddress);
        }
      } catch (e) {
        hideField(detailAddress);
      }
    }

    // 2. CONTACT INFO
    let phoneFound = !!info.phone;
    let websiteFound = !!info.website;
    
    if (info.phone) detailPhone.textContent = info.phone;
    if (info.website) setWebsite(info.website);

    if (info.wikidata && (!phoneFound || !websiteFound)) {
      try {
        const wikiUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&property=P856|P1329&entity=${info.wikidata}&format=json&origin=*`;
        const res = await fetch(wikiUrl);
        const data = await res.json();
        
        if (data.claims) {
          if (!websiteFound && data.claims.P856) {
             const url = data.claims.P856[0].mainsnak.datavalue.value;
             setWebsite(url);
             websiteFound = true;
          }
          if (!phoneFound && data.claims.P1329) {
             const phone = data.claims.P1329[0].mainsnak.datavalue.value;
             detailPhone.textContent = phone;
             phoneFound = true;
          }
        }
      } catch(e) { console.log("Wikidata fetch failed", e); }
    }

    if (!phoneFound) hideField(detailPhone);
    if (!websiteFound) hideField(detailWebsite);
    
    // 3. HOURS
    if (info.hours) {
      detailHours.textContent = info.hours;
    } else {
      hideField(detailHours);
    }
  }

  function setWebsite(url) {
    detailWebsite.textContent = "Visit Website";
    detailWebsite.href = url;
    detailWebsite.target = "_blank";
    detailWebsite.closest('.info-item').style.display = "flex";
  }
});