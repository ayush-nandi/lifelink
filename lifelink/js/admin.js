import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, onSnapshot, query, where, doc, updateDoc, getDoc, 
  serverTimestamp, addDoc, deleteDoc, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* -----------------------------------------------------------
   1. GLOBAL STATE & MEMORY
   ----------------------------------------------------------- */
let activeListeners = [];

const clearListeners = () => {
    activeListeners.forEach(unsubscribe => unsubscribe());
    activeListeners = [];
};

/* -----------------------------------------------------------
   2. SYSTEM BADGES
   ----------------------------------------------------------- */
function initBadges() {
    onSnapshot(query(collection(db, "host_requests"), where("status", "==", "pending")), snap => updateBadge('badge-host', snap.size));
    onSnapshot(query(collection(db, "help_requests"), where("status", "==", "open")), snap => updateBadge('badge-help', snap.size));
    onSnapshot(collection(db, "events"), snap => updateBadge('badge-events', snap.size));
}

function updateBadge(id, count) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = count;
        count > 0 ? el.classList.remove('hidden') : el.classList.add('hidden');
    }
}

/* -----------------------------------------------------------
   3. TAB SWITCHER
   ----------------------------------------------------------- */
window.switchTab = (tab) => {
    const grid = document.getElementById("contentGrid");
    const title = document.getElementById("tabTitle");
    const desc = document.getElementById("tabDesc");
    
    clearListeners();
    grid.innerHTML = `<div class="col-span-full py-20 text-center animate-pulse"><p class="text-slate-400 font-black uppercase text-[10px] tracking-widest">Establishing Secure Uplink...</p></div>`;

    if (tab === 'host') loadHostRequests(grid, title, desc);
    if (tab === 'help') loadHelpRequests(grid, title, desc);
    if (tab === 'events') loadEvents(grid, title, desc);
    if (tab === 'organizers') loadOrganizers(grid, title, desc);
};

/* -----------------------------------------------------------
   4. STREAM LOADERS
   ----------------------------------------------------------- */

function loadHostRequests(grid, title, desc) {
    title.innerText = "Host Verification";
    desc.innerText = "Evaluate organizations applying for official partner status.";
    const unsub = onSnapshot(query(collection(db, "host_requests"), where("status", "==", "pending")), (snap) => {
        document.getElementById("totalRecordsCount").innerText = snap.size;
        renderAdminGrid(grid, snap, (doc) => {
            const r = doc.data();
            return createAdminCard(r.orgName, r.orgType, [
                { label: "Reg ID", value: r.registrationId },
                { label: "Contact", value: r.contactEmail || "No Email" }
            ], `
                <div class="flex gap-3 mt-6">
                    <button onclick="window.approveOrg('${doc.id}', '${r.userId}', '${r.orgName}')" class="flex-1 bg-green-600 text-white py-3 rounded-2xl text-[9px] font-black uppercase shadow-lg shadow-green-100">Approve</button>
                    <button onclick="window.rejectOrg('${doc.id}')" class="flex-1 bg-slate-100 text-slate-400 py-3 rounded-2xl text-[9px] font-black uppercase hover:bg-red-50 hover:text-red-500 transition-colors">Deny</button>
                </div>
            `);
        });
    });
    activeListeners.push(unsub);
}

/* --- 1. DEEP-FETCH LOADER FOR EVENTS --- */
async function loadEvents(grid, title, desc) {
    title.innerText = "Moderate Events";
    desc.innerText = "Managing live drives with verified organizer identity.";
    
    // Clear the grid and show loading state
    grid.innerHTML = `<div class="col-span-full py-20 text-center animate-pulse"><p class="text-slate-400 font-black uppercase text-[10px] tracking-widest">Cross-Referencing Identities...</p></div>`;

    const unsub = onSnapshot(collection(db, "events"), async (snap) => {
        document.getElementById("totalRecordsCount").innerText = snap.size;
        
        if (snap.empty) {
            grid.innerHTML = `<p class="col-span-full py-20 text-center font-black text-slate-200 uppercase text-xs">No Active Streams</p>`;
            return;
        }

        // We use a temporary container to prevent layout flickering during async fetches
        const cardsFragment = document.createDocumentFragment();

        // Use Promise.all to fetch all organizer names in parallel for speed
        const eventCards = await Promise.all(snap.docs.map(async (eventDoc) => {
            const e = eventDoc.data();
            let organizerName = "Official Partner";
            let organizerEmail = "N/A";

            // Cross-reference user collection using the organizerId
            if (e.organizerId) {
                try {
                    const userRef = await getDoc(doc(db, "users", e.organizerId));
                    if (userRef.exists()) {
                        const userData = userRef.data();
                        organizerName = userData.name || userData.orgName || "Verified User";
                        organizerEmail = userData.email || "No Email";
                    }
                } catch (err) {
                    console.error("Identity Fetch Failed:", err);
                }
            }

            return createAdminCard(e.title, e.type, [
                { label: "Organizer", value: organizerName },
                { label: "Contact", value: organizerEmail },
                { label: "Date", value: e.date || "Ongoing" },
                { label: "Location", value: e.locationText || "Remote" }
            ], `
                <div class="flex flex-col gap-2 mt-6">
                    <button onclick="window.viewEventDetails('${eventDoc.id}')" class="w-full bg-slate-900 text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Inspect Full Intel</button>
                    <button onclick="window.deleteForever('events', '${eventDoc.id}')" class="w-full text-red-500 py-1 font-black text-[8px] uppercase tracking-tighter hover:bg-red-50 rounded-lg">Terminate Drive</button>
                </div>
            `);
        }));

        grid.innerHTML = ""; // Clear loader
        eventCards.forEach(card => grid.appendChild(card));
    });

    activeListeners.push(unsub);
}


/* --- 1. Load Organizers with Real Names from User Profile --- */
function loadOrganizers(grid, title, desc) {
    title.innerText = "Organizer Authority";
    desc.innerText = "Monitor verified partners and their registration credentials.";
    
    const unsub = onSnapshot(query(collection(db, "users"), where("role", "==", "organizer")), (snap) => {
        document.getElementById("totalRecordsCount").innerText = snap.size;
        renderAdminGrid(grid, snap, (docSnap) => {
            const u = docSnap.data();
            // PRIORITIZE: name -> orgName -> displayName -> Email
            const displayName = u.name || u.orgName || u.displayName || u.email.split('@')[0];
            
            return createAdminCard(displayName, "Verified Partner", [
                { label: "Account Email", value: u.email },
                { label: "Role Status", value: "Organizer" }
            ], `
                <div class="flex flex-col gap-2 mt-6">
                    <button onclick="window.viewOrganizerProfile('${docSnap.id}')" class="w-full bg-purple-600 text-white py-3 rounded-2xl text-[9px] font-black uppercase shadow-lg shadow-purple-100 transition-all active:scale-95">Inspect Intelligence</button>
                    <button onclick="window.revokeAuthority('${docSnap.id}', '${displayName}')" class="w-full text-slate-400 py-1 font-black text-[8px] uppercase tracking-widest hover:text-red-500 transition-colors">Revoke Authority</button>
                </div>
            `);
        });
    });
    activeListeners.push(unsub);
}

/* --- 2. Full Intelligence Modal --- */
window.viewOrganizerProfile = async (userId) => {
    // 1. Fetch User Base Data (looking for 'name' field)
    const userSnap = await getDoc(doc(db, "users", userId));
    const u = userSnap.exists() ? userSnap.data() : {};

    // 2. Cross-reference host_requests for formal organization form data
    const hostReqQuery = query(collection(db, "host_requests"), where("userId", "==", userId));
    const hostReqSnap = await getDocs(hostReqQuery);
    
    let regData = { 
        formName: "Not Submitted", 
        registrationId: "N/A", 
        orgType: "Personal Account", 
        formContact: u.phone || "No Number" 
    };
    
    if (!hostReqSnap.empty) {
        const data = hostReqSnap.docs[0].data();
        regData = {
            formName: data.orgName || "Unnamed Org",
            registrationId: data.registrationId || "N/A",
            orgType: data.orgType || "NGO/Hospital",
            formContact: data.contact || data.phone || "N/A" 
        };
    }

    // 3. Fetch their active donation drives
    const eventsSnap = await getDocs(query(collection(db, "events"), where("organizerId", "==", userId)));
    let eventsHtml = eventsSnap.empty ? `<div class="p-6 text-center text-[10px] text-slate-300 font-black uppercase italic">No Active Drives</div>` : "";
    
    eventsSnap.forEach(evDoc => {
        const ev = evDoc.data();
        eventsHtml += `
            <div class="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl mb-2 shadow-sm">
                <div class="overflow-hidden">
                    <p class="font-bold text-[10px] text-slate-800 truncate">${ev.title}</p>
                    <p class="text-[8px] text-slate-400 uppercase font-medium">${ev.locationText || 'LifeLink Campus'}</p>
                </div>
                <button onclick="window.deleteForever('events', '${evDoc.id}')" class="text-red-500 font-black text-[8px] px-3 py-1 bg-red-50 rounded-lg hover:bg-red-100">REMOVE</button>
            </div>
        `;
    });

    showModal("Partner Intelligence", `
        <div class="space-y-6">
            <div class="bg-slate-900 p-6 rounded-[2.5rem] text-white flex items-center gap-4">
                <div class="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-xl font-black italic shadow-lg shadow-red-900/20">LL</div>
                <div class="overflow-hidden">
                    <h3 class="text-lg font-black italic tracking-tighter truncate">${u.name || u.displayName || 'Unknown User'}</h3>
                    <p class="text-[9px] text-slate-400 font-mono opacity-60">ADMIN_INTEL_UID: ${userId.substring(0,12)}...</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Org Name</p>
                    <p class="text-xs font-bold text-slate-800 truncate">${regData.formName}</p>
                </div>
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Contact</p>
                    <p class="text-xs font-bold text-slate-800">${regData.formContact}</p>
                </div>
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Reg ID</p>
                    <p class="text-xs font-bold text-slate-800 truncate">${regData.registrationId}</p>
                </div>
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Type</p>
                    <p class="text-xs font-bold text-slate-800">${regData.orgType}</p>
                </div>
            </div>

            <div>
                <div class="flex justify-between items-center mb-3 px-2">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Operations</p>
                    <span class="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[8px] font-bold">${eventsSnap.size}</span>
                </div>
                <div class="bg-slate-100/50 p-2 rounded-[2rem] border border-slate-100 max-h-[200px] overflow-y-auto custom-scrollbar">
                    ${eventsHtml}
                </div>
            </div>

            <button onclick="window.revokeAuthority('${userId}', '${u.name || regData.formName}')" class="w-full bg-slate-900 text-white py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-red-600 transition-colors">Revoke Verified Status</button>
        </div>
    `);
};
function loadHelpRequests(grid, title, desc) {
    title.innerText = "Live Emergencies";
    desc.innerText = "Active broadcasts requiring immediate resource matching.";
    const unsub = onSnapshot(query(collection(db, "help_requests"), where("status", "==", "open")), (snap) => {
        document.getElementById("totalRecordsCount").innerText = snap.size;
        renderAdminGrid(grid, snap, (doc) => {
            const h = doc.data();
            return createAdminCard(`${h.bloodGroup} Needed`, h.hospital, [
                { label: "Patient", value: h.contactName },
                { label: "Phone", value: h.contactPhone }
            ], `
                <button onclick="window.markResolved('${doc.id}')" class="w-full mt-6 bg-red-600 text-white py-3 rounded-2xl text-[9px] font-black uppercase shadow-lg shadow-red-100">Force Resolve</button>
            `);
        });
    });
    activeListeners.push(unsub);
}

/* -----------------------------------------------------------
   5. ACTIONS & MODALS
   ----------------------------------------------------------- */

/* --- 2. EVENT INTEL MODAL --- */
window.viewEventDetails = async (id) => {
    const snap = await getDoc(doc(db, "events", id));
    if (!snap.exists()) return;
    const data = snap.data();

    // Fetch the organizer's profile one more time for the modal
    let orgEmail = "Not Linked";
    let orgRealName = "System Partner";
    
    if (data.organizerId) {
        const uSnap = await getDoc(doc(db, "users", data.organizerId));
        if (uSnap.exists()) {
            orgEmail = uSnap.data().email || "N/A";
            orgRealName = uSnap.data().name || uSnap.data().orgName || "Verified Partner";
        }
    }

    showModal("Event Intelligence", `
        <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Lead Organizer</p>
                    <p class="text-xs font-bold text-slate-900 truncate">${orgRealName}</p>
                </div>
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Secure Email</p>
                    <p class="text-xs font-bold text-slate-900 truncate">${orgEmail}</p>
                </div>
            </div>

            <div class="space-y-3">
                <div class="flex justify-between items-center px-1">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Satellite Mapping</p>
                    <span class="text-[8px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase">Live Coordinates</span>
                </div>
                <div id="map" class="border-2 border-slate-100 shadow-inner"></div>
                <p class="text-[10px] text-slate-600 bg-slate-50 p-3 rounded-xl italic leading-relaxed border border-slate-100">
                    📍 ${data.locationText || "Coordinates on file."}
                </p>
            </div>

            <button onclick="window.deleteForever('events', '${id}'); closeModal();" class="w-full bg-slate-900 text-white py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200">Shut Down Operations</button>
        </div>
    `);

    // Initialize Leaflet Map
    if (data.lat && data.lng) {
        setTimeout(() => {
            if (window.mapInstance) { window.mapInstance.remove(); }
            window.mapInstance = L.map('map').setView([data.lat, data.lng], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(window.mapInstance);
            L.marker([data.lat, data.lng]).addTo(window.mapInstance);
        }, 400);
    }
};

window.viewOrganizerProfile = async (userId) => {
    const userSnap = await getDoc(doc(db, "users", userId));
    const eventsSnap = await getDocs(query(collection(db, "events"), where("organizerId", "==", userId)));
    const u = userSnap.data();
    
    let eventsHtml = eventsSnap.empty ? `<div class="p-6 text-center text-[10px] text-slate-300 font-black uppercase italic">No Active Drives</div>` : "";
    eventsSnap.forEach(evDoc => {
        const ev = evDoc.data();
        eventsHtml += `
            <div class="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl mb-2 shadow-sm">
                <div>
                    <p class="font-bold text-xs text-slate-900">${ev.title}</p>
                    <p class="text-[9px] text-slate-400 uppercase">${ev.type}</p>
                </div>
                <button onclick="window.deleteForever('events', '${evDoc.id}')" class="text-red-500 font-black text-[9px] px-3 py-1 bg-red-50 rounded-lg">REMOVE</button>
            </div>
        `;
    });

    showModal("Organizer Authority", `
        <div class="space-y-6">
            <div class="flex items-center gap-4 bg-slate-900 p-6 rounded-[2rem] text-white">
                <div class="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-3xl">🛡️</div>
                <div>
                    <h3 class="text-xl font-black italic tracking-tighter">${u.orgName || u.displayName}</h3>
                    <p class="text-slate-400 text-xs">${u.email}</p>
                </div>
            </div>
            <div>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Live Operations</p>
                <div class="bg-slate-50 p-2 rounded-[2rem] border border-slate-100">${eventsHtml}</div>
            </div>
            <button onclick="window.revokeAuthority('${userId}', '${u.orgName || u.displayName}')" class="w-full bg-red-600 text-white py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-100">Demote To Normal User</button>
        </div>
    `);
};

window.rejectOrg = async (id) => {
    if(!confirm("Security Check: Permanently delete this application?")) return;
    await deleteDoc(doc(db, "host_requests", id));
    alert("Request Cleared.");
};

window.revokeAuthority = async (id, name) => {
    if(!confirm(`CRITICAL: Strip ${name} of organizer privileges?`)) return;
    await updateDoc(doc(db, "users", id), { role: "user" });
    alert("Authority Revoked.");
    closeModal();
};

/* -----------------------------------------------------------
   6. UTILS & CORE RENDERERS
   ----------------------------------------------------------- */

function showModal(title, html) {
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalContent").innerHTML = html;
    document.getElementById("detailModal").classList.remove("hidden");
}

window.closeModal = () => document.getElementById("detailModal").classList.add("hidden");

function renderAdminGrid(grid, snap, cardBuilder) {
    grid.innerHTML = snap.empty ? `<p class="col-span-full py-20 text-center font-black text-slate-200 tracking-[0.5em] uppercase text-xs">No Data Streams</p>` : "";
    snap.forEach(doc => grid.appendChild(cardBuilder(doc)));
}

function createAdminCard(title, badge, fields, actions) {
    const card = document.createElement("div");
    card.className = "admin-card bg-white p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 shadow-sm transition-all animate-in zoom-in duration-300 flex flex-col justify-between";
    const fieldHtml = fields.map(f => `
        <div>
            <p class="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${f.label}</p>
            <p class="font-bold text-slate-800 text-[10px] md:text-xs truncate">${f.value}</p>
        </div>
    `).join("");
    
    card.innerHTML = `
        <div>
            <div class="flex justify-between items-start mb-6">
                <h4 class="text-lg md:text-xl font-black text-slate-900 italic leading-none truncate pr-4">${title}</h4>
                <span class="bg-red-50 text-red-600 px-2 md:px-3 py-1 rounded-lg text-[8px] md:text-[9px] font-black uppercase whitespace-nowrap">${badge}</span>
            </div>
            <div class="grid grid-cols-2 gap-4">${fieldHtml}</div>
        </div>
        ${actions}
    `;
    return card;
}

/* -----------------------------------------------------------
   7. GLOBAL ADMIN ACTIONS
   ----------------------------------------------------------- */

window.approveOrg = async (reqId, userId, orgName) => {
    if (!confirm(`Grant ${orgName} Organizer authority?`)) return;
    await updateDoc(doc(db, "users", userId), { role: "organizer", orgName: orgName });
    await updateDoc(doc(db, "host_requests", reqId), { status: "approved" });
    alert("Verification Successful.");
};

window.markResolved = async (id) => {
    if (!confirm("Archive this case?")) return;
    try {
        const snap = await getDoc(doc(db, "help_requests", id));
        if (snap.exists()) {
            await addDoc(collection(db, "successful_donations"), {
                ...snap.data(),
                resolvedAt: serverTimestamp(),
                adminResolution: true
            });
            await deleteDoc(doc(db, "help_requests", id));
            alert("Case Resolved.");
        }
    } catch (err) { alert("Error: " + err.message); }
};

window.deleteForever = async (col, id) => {
    if (!confirm("CRITICAL: Erase this data permanently?")) return;
    await deleteDoc(doc(db, col, id));
};

/* -----------------------------------------------------------
   8. STARTUP & AUTH GATE
   ----------------------------------------------------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists() && snap.data().role === 'admin') {
      initBadges();
      switchTab('host');
    } else {
      window.location.href = "dashboard.html";
    }
  } else {
    window.location.href = "login.html";
  }
});