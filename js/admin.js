import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, onSnapshot, query, where, doc, updateDoc, getDoc, serverTimestamp, addDoc, deleteDoc, orderBy
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* -----------------------------------------------------------
   1. GLOBAL STATE & MEMORY MANAGEMENT
   ----------------------------------------------------------- */
let activeListeners = [];

const clearListeners = () => {
    activeListeners.forEach(unsubscribe => unsubscribe());
    activeListeners = [];
};

/* -----------------------------------------------------------
   2. REAL-TIME SYSTEM BADGES (Admin Oversight)
   ----------------------------------------------------------- */
function initBadges() {
  onSnapshot(query(collection(db, "host_requests"), where("status", "==", "pending")), (snap) => {
    updateBadge('badge-host', snap.size);
  });
  onSnapshot(query(collection(db, "help_requests"), where("status", "==", "open")), (snap) => {
    updateBadge('badge-help', snap.size);
  });
  onSnapshot(collection(db, "events"), (snap) => {
    updateBadge('badge-events', snap.size);
  });
}

function updateBadge(id, count) {
  const el = document.getElementById(id);
  if (el) {
      el.textContent = count;
      count > 0 ? el.classList.remove('hidden') : el.classList.add('hidden');
  }
}

/* -----------------------------------------------------------
   3. TAB SWITCHER (Grand Logic)
   ----------------------------------------------------------- */
window.switchTab = (tab) => {
  const grid = document.getElementById("contentGrid");
  const title = document.getElementById("tabTitle");
  const desc = document.getElementById("tabDesc");
  
  clearListeners();

  grid.innerHTML = `<div class="col-span-full py-20 text-center animate-pulse"><p class="text-slate-400 font-black uppercase text-[10px] tracking-widest">Decrypting Secure Stream...</p></div>`;

  if (tab === 'host') loadHostRequests(grid, title, desc);
  if (tab === 'help') loadHelpRequests(grid, title, desc);
  if (tab === 'events') loadEvents(grid, title, desc);
  if (tab === 'archives') loadArchives(grid, title, desc);
};

/* -----------------------------------------------------------
   4. STREAM LOADERS
   ----------------------------------------------------------- */

// --- HOST APPLICATIONS ---
function loadHostRequests(grid, title, desc) {
    title.innerText = "Host Verification";
    desc.innerText = "Verify organizations applying for official LifeLink status.";
    const unsub = onSnapshot(query(collection(db, "host_requests"), where("status", "==", "pending")), (snap) => {
        document.getElementById("totalRecordsCount").innerText = snap.size;
        renderAdminGrid(grid, snap, (doc) => {
            const r = doc.data();
            return createAdminCard(r.orgName, r.orgType, [
                { label: "ID", value: r.registrationId },
                { label: "Contact", value: r.contact || "No Email" }
            ], `
                <div class="flex gap-3 mt-6">
                    <button onclick="window.approveOrg('${doc.id}', '${r.userId}', '${r.orgName}')" class="flex-1 bg-green-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase">Approve</button>
                    <button onclick="window.rejectOrg('${doc.id}')" class="flex-1 bg-slate-100 text-slate-400 py-3 rounded-2xl text-[10px] font-black uppercase">Deny</button>
                </div>
            `);
        });
    });
    activeListeners.push(unsub);
}

// --- LIVE EMERGENCIES (The Fix) ---
function loadHelpRequests(grid, title, desc) {
    title.innerText = "Live Emergencies";
    desc.innerText = "Active broadcasts requiring immediate resource matching.";
    const unsub = onSnapshot(query(collection(db, "help_requests"), where("status", "==", "open")), (snap) => {
        document.getElementById("totalRecordsCount").innerText = snap.size;
        renderAdminGrid(grid, snap, (doc) => {
            const h = doc.data();
            return createAdminCard(`${h.bloodGroup} ${h.type}`, h.hospital, [
                { label: "Patient", value: h.contactName },
                { label: "Phone", value: h.contactPhone }
            ], `
                <button onclick="window.markResolved('${doc.id}')" class="w-full mt-6 bg-red-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-red-100">Force Resolve & Archive</button>
            `);
        });
    });
    activeListeners.push(unsub);
}

// --- LEGACY VAULT ---
function loadArchives(grid, title, desc) {
    title.innerText = "Legacy Vault";
    desc.innerText = "Permanent history of successfully resolved cases.";
    const unsub = onSnapshot(query(collection(db, "successful_donations"), orderBy("resolvedAt", "desc")), (snap) => {
        document.getElementById("totalRecordsCount").innerText = snap.size;
        renderAdminGrid(grid, snap, (doc) => {
            const a = doc.data();
            return createAdminCard(a.bloodGroup + " Resolved", a.hospital, [
                { label: "Date", value: a.resolvedAt ? new Date(a.resolvedAt.toDate()).toLocaleDateString() : 'N/A' },
                { label: "Staff", value: a.contactName }
            ], `
                <button onclick="window.deleteForever('successful_donations', '${doc.id}')" class="w-full mt-6 bg-slate-900 text-slate-400 py-3 rounded-2xl text-[10px] font-black uppercase hover:text-red-500 transition">Delete Permanently</button>
            `);
        });
    });
    activeListeners.push(unsub);
}

// --- EVENTS ---
function loadEvents(grid, title, desc) {
    title.innerText = "Moderate Events";
    desc.innerText = "Oversee and manage public donation drives.";
    const unsub = onSnapshot(collection(db, "events"), (snap) => {
        document.getElementById("totalRecordsCount").innerText = snap.size;
        renderAdminGrid(grid, snap, (doc) => {
            const e = doc.data();
            return createAdminCard(e.title, e.type, [
                { label: "Location", value: e.locationText },
                { label: "Organized By", value: e.organizerName || "Verified Partner" }
            ], `
                <button onclick="window.deleteForever('events', '${doc.id}')" class="w-full mt-6 bg-red-50 text-red-600 py-3 rounded-2xl text-[10px] font-black uppercase">Remove Event</button>
            `);
        });
    });
    activeListeners.push(unsub);
}

/* -----------------------------------------------------------
   5. GLOBAL ADMIN ACTIONS (GOD MODE)
   ----------------------------------------------------------- */

// RESOLVE CASE: Moves data from Help -> Success before deleting
window.markResolved = async (id) => {
    if (!confirm("This will archive the emergency and mark it as successful. Proceed?")) return;
    try {
        const snap = await getDoc(doc(db, "help_requests", id));
        if (snap.exists()) {
            await addDoc(collection(db, "successful_donations"), {
                ...snap.data(),
                resolvedAt: serverTimestamp(),
                adminResolution: true
            });
            await deleteDoc(doc(db, "help_requests", id));
            alert("Case successfully moved to Legacy Vault.");
        }
    } catch (err) { alert("Security Error: " + err.message); }
};

window.approveOrg = async (reqId, userId, orgName) => {
    if (!confirm(`Grant ${orgName} full Organizer permissions?`)) return;
    await updateDoc(doc(db, "users", userId), { role: "organizer" });
    await updateDoc(doc(db, "host_requests", reqId), { status: "approved" });
    alert("Role Updated: User is now a Verified Organizer.");
};

window.deleteForever = async (col, id) => {
    if (!confirm("CRITICAL: This action cannot be undone. Delete forever?")) return;
    await deleteDoc(doc(db, col, id));
};

/* -----------------------------------------------------------
   6. CORE UTILS
   ----------------------------------------------------------- */
function renderAdminGrid(grid, snap, cardBuilder) {
    grid.innerHTML = snap.empty ? `<p class="col-span-full py-20 text-center font-black text-slate-200 tracking-[0.5em] uppercase">No Records In Stream</p>` : "";
    snap.forEach(doc => grid.appendChild(cardBuilder(doc)));
}

function createAdminCard(title, badge, fields, actions) {
    const card = document.createElement("div");
    card.className = "admin-card bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm transition-all animate-in zoom-in duration-300 flex flex-col justify-between";
    const fieldHtml = fields.map(f => `
        <div>
            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${f.label}</p>
            <p class="font-bold text-slate-800 text-xs truncate">${f.value}</p>
        </div>
    `).join("");
    
    card.innerHTML = `
        <div>
            <div class="flex justify-between items-start mb-6">
                <h4 class="text-xl font-black text-slate-900 italic leading-none">${title}</h4>
                <span class="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">${badge}</span>
            </div>
            <div class="grid grid-cols-2 gap-4">${fieldHtml}</div>
        </div>
        ${actions}
    `;
    return card;
}

/* -----------------------------------------------------------
   7. STARTUP & GATEKEEPER
   ----------------------------------------------------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists() && snap.data().role === 'admin') {
      initBadges();
      switchTab('host'); // Auto-load first tab
    } else {
      window.location.href = "dashboard.html";
    }
  } else {
    window.location.href = "login.html";
  }
});