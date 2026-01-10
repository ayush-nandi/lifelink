// Global Variables
let map, userMarker, markersLayer;
let markersMap = {}; 
let userLat = null; 
let userLng = null;
let allHospitalsData = []; 

// --- CONFIGURATION ---
// 👇👇👇 PASTE YOUR API KEY HERE 👇👇👇
const GEMINI_API_KEY = "AIzaSyBtELq9zjsX6-3EgsOcQ2V-qyMxwn5Ozdk"; 
// 👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆

// --- ICONS ---
const hospitalIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const userIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const hospitalList = document.getElementById("hospital-list");
  const pincodeInput = document.getElementById("pincode-input");
  const searchBtn = document.getElementById("search-btn");
  const detectBtn = document.getElementById("detect-btn");
  const radiusSlider = document.getElementById("radius-slider");
  const radiusVal = document.getElementById("radius-val");
  
  // Details Panel
  const detailsPanel = document.getElementById("hospital-details");
  const detailName = document.getElementById("detail-name");
  const detailAddress = document.getElementById("detail-address");
  const detailPhone = document.getElementById("detail-phone");
  const detailWebsite = document.getElementById("detail-website");
  const detailHours = document.getElementById("detail-hours");

  // AI Elements
  const aiToggleBtn = document.getElementById("ai-toggle-btn");
  const aiModal = document.getElementById("ai-modal");
  const closeAiBtn = document.getElementById("close-ai");
  const aiInput = document.getElementById("ai-input");
  const aiSendBtn = document.getElementById("ai-send-btn");
  const aiChatBody = document.getElementById("ai-chat-body");

  markersLayer = new L.LayerGroup();

  // --- MAP INIT ---
  map = L.map("map", { zoomControl: false }).setView([20.5937, 78.9629], 5);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: 'OSM' }).addTo(map);
  markersLayer.addTo(map);

  // --- EVENT LISTENERS ---
  searchBtn.addEventListener("click", () => {
    const pincode = pincodeInput.value.trim();
    if(pincode.length > 0) searchByPincode(pincode);
    else alert("Please enter a valid pincode.");
  });

  pincodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchBtn.click();
  });

  detectBtn.addEventListener("click", locateAndFetchHospitals);

  radiusSlider.addEventListener("input", () => {
    radiusVal.textContent = radiusSlider.value;
  });

  radiusSlider.addEventListener("change", () => {
    if (userLat && userLng) fetchHospitalsIRL(userLat, userLng);
  });

  // AI Event Listeners
  aiToggleBtn.addEventListener("click", () => {
    aiModal.classList.add("active");
    const tag = document.querySelector('.ai-tag');
    if(tag) tag.style.display = 'none';
  });

  closeAiBtn.addEventListener("click", () => {
    aiModal.classList.remove("active");
  });

  aiSendBtn.addEventListener("click", handleAiQuery);
  aiInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAiQuery();
  });


  // --- MAIN LOGIC ---

  async function searchByPincode(pincode) {
    hospitalList.innerHTML = "<div class='empty-state'><p>🔍 Searching Pincode...</p></div>";
    try {
      const url = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&countrycodes=in&format=json`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        userLat = lat;
        userLng = lng;
        updateUserLocation(lat, lng, `Pincode: ${pincode}`);
        fetchHospitalsIRL(lat, lng);
      } else {
        hospitalList.innerHTML = "<div class='empty-state'><p>❌ Pincode not found.</p></div>";
      }
    } catch (e) {
      console.error(e);
      hospitalList.innerHTML = "<div class='empty-state'><p>⚠️ Connection Error.</p></div>";
    }
  }

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
        updateUserLocation(userLat, userLng, "You are here");
        fetchHospitalsIRL(userLat, userLng);
      },
      err => {
         console.error(err);
         hospitalList.innerHTML = "<div class='empty-state'><p>⚠️ Location denied. Use Pincode.</p></div>";
      },
      { enableHighAccuracy: true }
    );
  }

  function updateUserLocation(lat, lng, popupText) {
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng], {icon: userIcon})
      .addTo(map)
      .bindPopup(`<b>${popupText}</b>`)
      .openPopup();
    map.setView([lat, lng], 14);
  }

  async function fetchHospitalsIRL(lat, lng) {
    const radiusKm = radiusSlider.value;
    const radiusMeters = radiusKm * 1000;
    
    // Increased timeout to 90 seconds
    hospitalList.innerHTML = `<div class='empty-state'><p>🔎 Scanning ${radiusKm}km radius... (This may take a moment)</p></div>`;
    
    const queryStr = `[out:json][timeout:90];(node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});way["amenity"="hospital"](around:${radiusMeters},${lat},${lng}););out center;`;
    
    // ⚠️ SERVER ORDER UPDATE: Main server is usually more reliable (though slower)
    const servers = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://lz4.overpass-api.de/api/interpreter"
    ];

    for (const server of servers) {
      try {
        console.log(`Trying server: ${server}`);
        const res = await fetch(server + "?data=" + encodeURIComponent(queryStr));
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        
        const data = await res.json();
        allHospitalsData = data.elements;
        displayHospitals(allHospitalsData, lat, lng);
        return; 
      } catch (e) { 
        console.warn(`Server ${server} failed:`, e); 
      }
    }
    hospitalList.innerHTML = "<div class='empty-state'><p>⚠️ All map servers are busy. Please try a smaller radius.</p></div>";
  }

  function displayHospitals(elements, userLat, userLng) {
    hospitalList.innerHTML = "";
    markersLayer.clearLayers();
    markersMap = {};
    
    if (!elements || !elements.length) {
      hospitalList.innerHTML = "<div class='empty-state'><p>No hospitals found.</p></div>";
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
        phone: tags['phone'] || tags['contact:phone'] || null,
        website: tags['website'] || tags['contact:website'] || null,
        hours: tags['opening_hours'] || null,
        wikidata: tags['wikidata'] || null 
      };
      return { ...h, lat, lng, distMeters, info };
    });

    processed.sort((a, b) => a.distMeters - b.distMeters);

    processed.forEach(h => {
      const distKm = (h.distMeters / 1000).toFixed(1);

      const card = document.createElement("div");
      card.className = "hospital-card";
      card.id = `card-${h.info.id}`;
      card.innerHTML = `
        <span class="distance-tag">${distKm} km</span>
        <strong>${h.info.name}</strong>
      `;
      card.onclick = () => openHospitalDetails(h.info, h.lat, h.lng, false);
      hospitalList.appendChild(card);

      const marker = L.marker([h.lat, h.lng], {icon: hospitalIcon});
      marker.bindPopup(`<b>${h.info.name}</b><br>${distKm} km away`);
      marker.on('click', () => openHospitalDetails(h.info, h.lat, h.lng, true));
      
      markersLayer.addLayer(marker);
      markersMap[h.info.id] = marker;
    });
  }

  // --- UPDATED AI LOGIC (FINAL ATTEMPT: gemini-flash-latest) ---

  async function handleAiQuery() {
    const userPrompt = aiInput.value.trim();
    if (!userPrompt) return;

    if (allHospitalsData.length === 0) {
      addAiMessage("Please find hospitals on the map first!", "bot");
      return;
    }

    addAiMessage(userPrompt, "user");
    aiInput.value = "";
    addAiMessage("Thinking... Analyzing hospital data...", "bot");

    const simplifiedList = allHospitalsData.map(h => ({
      id: String(h.id),
      name: h.tags?.name || "Unnamed Hospital",
      type: h.tags?.['healthcare:speciality'] || h.tags?.['amenity'] || "general"
    }));

    const prompt = `
      You are a medical assistant. I have a list of hospitals near the user. 
      User Query: "${userPrompt}"
      
      List of Hospitals (JSON):
      ${JSON.stringify(simplifiedList)}

      Task: Identify which hospitals from the list are most likely to handle the user's request based on their names or types.
      Strict Rule: Return ONLY a JSON array of the matching IDs. Do not write any other text.
      Example Response: ["12345", "67890"]
    `;

    try {
      // ⚠️ MODEL UPDATE: Using 'gemini-flash-latest'
      // This is an alias that points to the current stable free model.
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) {
        console.error("Gemini API Error Detail:", await response.text());
        throw new Error(`API Error: ${response.status}. Check Console.`);
      }

      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response from AI");
      }

      const aiText = data.candidates[0].content.parts[0].text;
      const cleanJson = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      let matchedIds = [];
      try {
        matchedIds = JSON.parse(cleanJson);
      } catch (e) {
        console.error("AI returned invalid JSON:", aiText);
        matchedIds = [];
      }

      if (matchedIds.length > 0) {
        filterMapByAi(matchedIds);
        aiChatBody.removeChild(aiChatBody.lastElementChild); // Remove "Thinking"
        addAiMessage(`I found ${matchedIds.length} matching hospitals. Map updated!`, "bot");
      } else {
        aiChatBody.removeChild(aiChatBody.lastElementChild);
        addAiMessage("I couldn't find any hospitals matching that service nearby.", "bot");
      }

    } catch (error) {
      console.error(error);
      aiChatBody.removeChild(aiChatBody.lastElementChild);
      addAiMessage(`Error: ${error.message}`, "bot");
    }
  }

  function filterMapByAi(ids) {
    markersLayer.clearLayers();
    hospitalList.innerHTML = "";

    const filtered = allHospitalsData.filter(h => ids.includes(String(h.id)));

    if(filtered.length === 0) {
       displayHospitals(allHospitalsData, userLat, userLng);
       return;
    }

    filtered.forEach(h => {
      const lat = h.lat || h.center.lat;
      const lng = h.lon || h.center.lon;
      const distMeters = L.latLng(userLat, userLng).distanceTo(L.latLng(lat, lng));
      const distKm = (distMeters / 1000).toFixed(1);
      
      const tags = h.tags || {};
      const info = {
        id: String(h.id),
        name: tags.name || "Unnamed Hospital",
        address: tags['addr:full'] || tags['addr:street'] || null,
        phone: tags['phone'] || tags['contact:phone'] || null,
        website: tags['website'] || null,
        hours: tags['opening_hours'] || null,
        wikidata: tags['wikidata'] || null 
      };

      const card = document.createElement("div");
      card.className = "hospital-card";
      card.innerHTML = `<span class="distance-tag">${distKm} km</span><strong>${info.name}</strong>`;
      card.onclick = () => openHospitalDetails(info, lat, lng, false);
      hospitalList.appendChild(card);

      const marker = L.marker([lat, lng], {icon: hospitalIcon});
      marker.bindPopup(`<b>${info.name}</b><br>Match Found! ✨`);
      marker.on('click', () => openHospitalDetails(info, lat, lng, true));
      markersLayer.addLayer(marker);
      markersMap[info.id] = marker;
    });

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Show All Hospitals";
    resetBtn.className = "outline-btn";
    resetBtn.style.marginTop = "10px";
    resetBtn.onclick = () => displayHospitals(allHospitalsData, userLat, userLng);
    hospitalList.prepend(resetBtn);
  }

  function addAiMessage(text, sender) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `ai-msg ${sender}`;
    msgDiv.textContent = text;
    aiChatBody.appendChild(msgDiv);
    aiChatBody.scrollTop = aiChatBody.scrollHeight;
  }

  // --- DETAILS PANEL ---
  async function openHospitalDetails(info, lat, lng, isMapClick = false) {
    hospitalList.style.display = "none";
    detailsPanel.style.display = "flex"; 
    detailName.textContent = info.name;

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

  async function enrichHospitalData(info, lat, lng) {
    if (info.address) {
      detailAddress.textContent = info.address;
    } else {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.display_name) detailAddress.textContent = data.display_name;
        else hideField(detailAddress);
      } catch (e) { hideField(detailAddress); }
    }

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
             setWebsite(data.claims.P856[0].mainsnak.datavalue.value);
             websiteFound = true;
          }
          if (!phoneFound && data.claims.P1329) {
             detailPhone.textContent = data.claims.P1329[0].mainsnak.datavalue.value;
             phoneFound = true;
          }
        }
      } catch(e) { console.log(e); }
    }
    if (!phoneFound) hideField(detailPhone);
    if (!websiteFound) hideField(detailWebsite);
    
    if (info.hours) detailHours.textContent = info.hours;
    else hideField(detailHours);
  }

  function setWebsite(url) {
    detailWebsite.textContent = "Visit Website";
    detailWebsite.href = url;
    detailWebsite.target = "_blank";
    detailWebsite.closest('.info-item').style.display = "flex";
  }
});