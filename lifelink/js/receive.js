import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, addDoc, query, where, onSnapshot, doc, getDoc, deleteDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const formContainer = document.getElementById("formContainer");
const activeContainer = document.getElementById("activeRequestContainer");
const matchesGrid = document.getElementById("matchesGrid");
const matchCountLabel = document.getElementById("matchCount");

let activeRequestId = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    monitorUserRequest(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

/* -----------------------------------------------------------
   1. STATE WATCHER
   ----------------------------------------------------------- */
function monitorUserRequest(uid) {
  const q = query(collection(db, "help_requests"), where("userId", "==", uid), where("status", "==", "open"));

  onSnapshot(q, (snap) => {
    if (!snap.empty) {
      const data = snap.docs[0].data();
      activeRequestId = snap.docs[0].id;
      
      document.getElementById("activeType").innerText = `${data.type} Required`;
      document.getElementById("activeDetails").innerText = `${data.bloodGroup} | ${data.hospital}`;
      
      formContainer.classList.add("hidden");
      activeContainer.classList.remove("hidden");

      findLiveMatches(data.type, data.bloodGroup);
    } else {
      formContainer.classList.remove("hidden");
      activeContainer.classList.add("hidden");
      activeRequestId = null;
      matchesGrid.innerHTML = `<div class="py-24 text-center opacity-30 italic">Submit a request to find matches.</div>`;
      matchCountLabel.innerText = "0 Found";
    }
  });
}

/* -----------------------------------------------------------
   2. BROADCASTER
   ----------------------------------------------------------- */
document.getElementById("receiveForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("broadcastBtn");
  
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
    btn.disabled = true;
    btn.innerText = "Broadcasting...";
    await addDoc(collection(db, "help_requests"), requestData);
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "Initiate Broadcast";
  }
});

/* -----------------------------------------------------------
   3. FAIL-SAFE MATCHER + CONNECTION CHECKER
   ----------------------------------------------------------- */
async function findLiveMatches(type, bloodGroup) {
  matchesGrid.innerHTML = `<div class="p-10 text-center animate-pulse text-slate-400 font-black text-xs uppercase tracking-widest">Scanning Global Stock...</div>`;

  const q = query(collection(db, "organizerStock"), where("category", "==", type), where("bloodGroup", "==", bloodGroup));

  onSnapshot(q, async (snap) => {
    const activeDocs = snap.docs.filter(d => Number(d.data().units) > 0);
    matchCountLabel.innerText = `${activeDocs.length} Matches Found`;

    if (activeDocs.length === 0) {
        matchesGrid.innerHTML = `<div class="py-10 text-center bg-white rounded-3xl border border-slate-100"><p class="text-slate-400 text-sm font-medium px-10">No organizers currently have ${bloodGroup} ${type} in stock.</p></div>`;
        return;
    }

    // NEW LOGIC: Check for existing direct requests to prevent duplicates
    const connQuery = query(
        collection(db, "direct_requests"), 
        where("requesterId", "==", auth.currentUser.uid),
        where("requestId", "==", activeRequestId)
    );
    const connSnap = await getDocs(connQuery);
    const alreadyRequestedIds = connSnap.docs.map(d => d.data().orgId);

    matchesGrid.innerHTML = "";
    for (const d of activeDocs) {
        const stock = d.data();
        const isConnected = alreadyRequestedIds.includes(stock.orgId);
        
        try {
            const orgSnap = await getDoc(doc(db, "users", stock.orgId));
            const orgData = orgSnap.exists() ? orgSnap.data() : { name: "LifeLink Hospital", email: "Contact via Request" };
            renderOrgCard(orgData, stock, isConnected);
        } catch (err) {
            renderOrgCard({ name: "Verified Provider", email: "Check profile" }, stock, isConnected);
        }
    }
  });
}

/* -----------------------------------------------------------
   4. RENDERING: Includes 'Connected' UI State
   ----------------------------------------------------------- */
function renderOrgCard(org, stock, isConnected) {
  const card = document.createElement("div");
  card.className = "bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex justify-between items-center group hover:border-red-500 transition-all mb-4 animate-in slide-in-from-right-4";
  
  const displayName = org.name || org.email || "Verified Facility";
  
  // Logic: Change button appearance if already requested
  const btnText = isConnected ? "Connected" : "Connect";
  const btnStyle = isConnected ? "bg-slate-100 text-slate-500" : "bg-red-600 text-white hover:bg-red-700 shadow-lg";

  card.innerHTML = `
    <div class="flex items-center gap-5">
        <div class="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-xl font-black italic">
            ${displayName.charAt(0).toUpperCase()}
        </div>
        <div>
            <h4 class="font-black text-slate-900 group-hover:text-red-600 transition-colors">${displayName}</h4>
            <p class="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-1">${stock.units} Units Available</p>
        </div>
    </div>
    <button onclick="window.openRequestPopup('${stock.orgId}', ${isConnected})" class="${btnStyle} px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
        ${btnText}
    </button>
  `;
  matchesGrid.appendChild(card);
}

/* -----------------------------------------------------------
   5. POPUP: Includes 'Already Sent' status
   ----------------------------------------------------------- */
window.openRequestPopup = async (orgId, isConnected) => {
    const modal = document.getElementById("orgProfileModal");
    const orgSnap = await getDoc(doc(db, "users", orgId));
    let org = orgSnap.exists() ? orgSnap.data() : { email: "Registration Email Hidden" };

    document.getElementById("modalOrgName").innerText = org.name || org.email || "Verified Medical Center";
    document.getElementById("modalEmail").innerText = org.email || "Contact Hidden";
    document.getElementById("modalPhone").innerText = org.phone || org.email || "No direct phone available";
    
    const reqBtn = document.getElementById("directRequestBtn");
    
    if (isConnected) {
        reqBtn.innerText = "Request Already Sent";
        reqBtn.className = "flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest cursor-default";
        reqBtn.onclick = null;
    } else {
        reqBtn.innerText = "Send Direct Request";
        reqBtn.className = "flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all";
        reqBtn.onclick = () => window.sendDirectRequest(orgId);
    }

    modal.classList.replace("hidden", "flex");
};

window.sendDirectRequest = async (orgId) => {
    try {
        const reqSnap = await getDoc(doc(db, "help_requests", activeRequestId));
        const req = reqSnap.data();

        await addDoc(collection(db, "direct_requests"), {
            orgId, requestId: activeRequestId,
            requesterId: auth.currentUser.uid,
            requesterName: req.contactName, requesterPhone: req.contactPhone,
            type: req.type, bloodGroup: req.bloodGroup, hospital: req.hospital,
            status: "pending", timestamp: serverTimestamp()
        });
        alert("Success! The Organizer has been notified of your request.");
        window.closeModal();
    } catch (err) {
        alert("Failed to send request: " + err.message);
    }
};

/* -----------------------------------------------------------
   6. RESOLUTION
   ----------------------------------------------------------- */
document.getElementById("cancelBtn").onclick = async () => {
    if (!confirm("Are you sure? This moves the request to the successful archive.")) return;

    try {
        const snap = await getDoc(doc(db, "help_requests", activeRequestId));
        await addDoc(collection(db, "successful_donations"), { ...snap.data(), resolvedAt: serverTimestamp() });
        await deleteDoc(doc(db, "help_requests", activeRequestId));
        alert("Request archived. You can now submit a new one.");
    } catch (err) {
        alert("Action failed: " + err.message);
    }
};

window.closeModal = () => document.getElementById("orgProfileModal").classList.replace("flex", "hidden");