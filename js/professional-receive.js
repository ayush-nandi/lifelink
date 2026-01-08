import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, addDoc, query, where, onSnapshot, doc, getDoc, deleteDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const staffRequestsFeed = document.getElementById("staffRequestsFeed");
const matchesGrid = document.getElementById("matchesGrid");
const matchCountLabel = document.getElementById("matchCount");

let selectedRequestId = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadStaffActiveFeed(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

/* -----------------------------------------------------------
   1. BROADCAST NEW (Staff can submit many)
   ----------------------------------------------------------- */
document.getElementById("professionalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const requestData = {
    userId: auth.currentUser.uid,
    type: document.getElementById("reqType").value,
    bloodGroup: document.getElementById("bloodGroup").value,
    hospital: document.getElementById("hospital").value,
    contactName: document.getElementById("contactName").value,
    contactPhone: document.getElementById("contactPhone").value,
    status: "open",
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "help_requests"), requestData);
    document.getElementById("professionalForm").reset();
  } catch (err) { alert(err.message); }
});

/* -----------------------------------------------------------
   2. FEED MANAGER (Show all your open cases)
   ----------------------------------------------------------- */
function loadStaffActiveFeed(uid) {
  const q = query(collection(db, "help_requests"), where("userId", "==", uid), where("status", "==", "open"));
  onSnapshot(q, (snap) => {
    staffRequestsFeed.innerHTML = snap.empty ? `<p class="text-slate-400 italic text-xs p-4">No active broadcasts under your ID.</p>` : "";
    snap.forEach(d => renderStaffRequestCard(d.id, d.data()));
  });
}

function renderStaffRequestCard(id, data) {
  const card = document.createElement("div");
  card.id = `card-${id}`;
  card.className = "bg-white p-5 rounded-3xl border border-slate-100 shadow-sm cursor-pointer hover:border-red-200 transition-all flex justify-between items-center group";
  if (selectedRequestId === id) card.classList.add("selected-card");

  card.innerHTML = `
    <div>
        <h5 class="font-black text-slate-900">${data.bloodGroup} ${data.type}</h5>
        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${data.hospital}</p>
    </div>
    <button onclick="window.resolveCase('${id}')" class="opacity-0 group-hover:opacity-100 bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all">Resolve</button>
  `;

  card.onclick = (e) => {
    if (e.target.tagName !== 'BUTTON') {
        document.querySelectorAll('.selected-card').forEach(el => el.classList.remove('selected-card'));
        card.classList.add("selected-card");
        selectedRequestId = id;
        findLiveMatches(data.type, data.bloodGroup);
    }
  };
  staffRequestsFeed.appendChild(card);
}

/* -----------------------------------------------------------
   3. THE MATCHER (Fail-safe stock scanner)
   ----------------------------------------------------------- */
async function findLiveMatches(type, bloodGroup) {
  matchesGrid.innerHTML = `<div class="py-20 text-center animate-pulse"><p class="text-slate-400 font-black text-xs uppercase tracking-widest">Scanning Stock for ${bloodGroup}...</p></div>`;
  document.getElementById("searchTitle").innerText = `Matches for ${bloodGroup} ${type}`;

  const q = query(collection(db, "organizerStock"), where("category", "==", type), where("bloodGroup", "==", bloodGroup));
  const connSnap = await getDocs(query(collection(db, "direct_requests"), where("requestId", "==", selectedRequestId)));
  const alreadyRequestedIds = connSnap.docs.map(d => d.data().orgId);

  onSnapshot(q, async (snap) => {
    const activeDocs = snap.docs.filter(d => Number(d.data().units) > 0);
    matchCountLabel.innerText = `${activeDocs.length} Found`;
    matchesGrid.innerHTML = "";

    for (const d of activeDocs) {
        const stock = d.data();
        const isConnected = alreadyRequestedIds.includes(stock.orgId);
        try {
            const orgSnap = await getDoc(doc(db, "users", stock.orgId));
            const orgData = orgSnap.exists() ? orgSnap.data() : { name: "LifeLink Facility", email: stock.orgId };
            renderOrgCard(orgData, stock, isConnected);
        } catch (err) {
            renderOrgCard({ name: "Verified Provider", email: "Email Hidden" }, stock, isConnected);
        }
    }
  });
}

function renderOrgCard(org, stock, isConnected) {
  const div = document.createElement("div");
  div.className = "bg-white p-6 rounded-[2.5rem] border border-slate-100 flex justify-between items-center animate-in slide-in-from-right-4";
  const btnText = isConnected ? "Connected" : "Connect";
  const btnStyle = isConnected ? "bg-slate-100 text-slate-400" : "bg-red-600 text-white shadow-lg";

  div.innerHTML = `
    <div class="flex items-center gap-5">
        <div class="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic">${(org.name || org.email).charAt(0).toUpperCase()}</div>
        <div>
            <h4 class="font-bold text-slate-900">${org.name || org.email}</h4>
            <p class="text-[10px] font-bold text-green-600 uppercase tracking-widest">${stock.units} Units</p>
        </div>
    </div>
    <button onclick="window.openRequestPopup('${stock.orgId}', ${isConnected})" class="${btnStyle} px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">${btnText}</button>
  `;
  matchesGrid.appendChild(div);
}

/* -----------------------------------------------------------
   4. HANDSHAKE & RESOLUTION
   ----------------------------------------------------------- */
window.openRequestPopup = async (orgId, isConnected) => {
    const modal = document.getElementById("orgProfileModal");
    const orgSnap = await getDoc(doc(db, "users", orgId));
    let org = orgSnap.exists() ? orgSnap.data() : { email: "Registration Only" };

    document.getElementById("modalOrgName").innerText = org.name || org.email;
    document.getElementById("modalEmail").innerText = org.email;
    document.getElementById("modalPhone").innerText = org.phone || org.email;
    
    const reqBtn = document.getElementById("directRequestBtn");
    if (isConnected) {
        reqBtn.innerText = "Handshake Active";
        reqBtn.className = "flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest cursor-default";
        reqBtn.onclick = null;
    } else {
        reqBtn.innerText = "Send Direct Request";
        reqBtn.className = "flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700";
        reqBtn.onclick = () => window.sendDirectRequest(orgId);
    }
    modal.classList.replace("hidden", "flex");
};

window.sendDirectRequest = async (orgId) => {
    const reqSnap = await getDoc(doc(db, "help_requests", selectedRequestId));
    const req = reqSnap.data();

    await addDoc(collection(db, "direct_requests"), {
        orgId, requestId: selectedRequestId, requesterId: auth.currentUser.uid,
        requesterName: req.contactName, requesterPhone: req.contactPhone,
        type: req.type, bloodGroup: req.bloodGroup, hospital: req.hospital,
        status: "pending", timestamp: serverTimestamp()
    });
    alert("Request Broadcasted to Organizer Dashboard.");
    window.closeModal();
    findLiveMatches(req.type, req.bloodGroup); // Refresh UI
};

window.resolveCase = async (id) => {
    if (!confirm("Archive this emergency?")) return;
    const snap = await getDoc(doc(db, "help_requests", id));
    await addDoc(collection(db, "successful_donations"), { ...snap.data(), resolvedAt: serverTimestamp() });
    await deleteDoc(doc(db, "help_requests", id));
    if (selectedRequestId === id) matchesGrid.innerHTML = `<div class="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100"><p class="text-slate-300 font-bold uppercase tracking-widest text-[10px]">Select an active case card to scan stock</p></div>`;
};

window.closeModal = () => document.getElementById("orgProfileModal").classList.replace("flex", "hidden");