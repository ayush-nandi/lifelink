import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, query, orderBy, onSnapshot, doc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const archivesGrid = document.getElementById("archivesGrid");
const totalCountDisplay = document.getElementById("totalCount");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // SECURITY GATE: Only Admin can see archives
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const role = userSnap.data().role;

    if (role === 'admin') {
      loadArchives();
    } else {
      alert("Unauthorized Access: Administrators only.");
      window.location.href = "dashboard.html";
    }
  } else {
    window.location.href = "login.html";
  }
});

/* -----------------------------------------------------------
   1. DATA ENGINE: Load Successful Donations
   ----------------------------------------------------------- */
function loadArchives() {
  const q = query(collection(db, "successful_donations"), orderBy("resolvedAt", "desc"));

  onSnapshot(q, (snap) => {
    totalCountDisplay.innerText = snap.size;
    archivesGrid.innerHTML = "";

    if (snap.empty) {
      archivesGrid.innerHTML = `
        <div class="col-span-full py-20 text-center bg-white rounded-[3rem] border border-slate-100">
            <p class="text-slate-400 font-bold uppercase tracking-widest text-xs">No resolved cases found in history.</p>
        </div>`;
      return;
    }

    snap.forEach((d) => renderArchiveCard(d.id, d.data()));
  });
}

/* -----------------------------------------------------------
   2. RENDERING: High-end Detail Cards
   ----------------------------------------------------------- */
function renderArchiveCard(id, data) {
  const card = document.createElement("div");
  card.className = "archive-card bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm transition-all animate-in zoom-in duration-500 flex flex-col justify-between";
  
  // Format the date
  const resolvedDate = data.resolvedAt ? new Date(data.resolvedAt.toDate()).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
  }) : "Recent";

  card.innerHTML = `
    <div>
        <div class="flex justify-between items-start mb-6">
            <span class="bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Fulfilled</span>
            <p class="text-[10px] font-bold text-slate-300 uppercase">${resolvedDate}</p>
        </div>
        <h4 class="text-2xl font-black text-slate-900 italic tracking-tight mb-2">${data.bloodGroup} ${data.type}</h4>
        <p class="text-xs font-bold text-slate-500 mb-6">${data.hospital}</p>
        
        <div class="space-y-4 pt-6 border-t border-slate-50">
            <div>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Requester Profile</p>
                <p class="font-bold text-slate-800 text-sm">${data.contactName}</p>
            </div>
            <div>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Details</p>
                <p class="font-medium text-slate-600 text-xs">${data.contactPhone}</p>
            </div>
        </div>
    </div>
    
    <div class="pt-8">
        <button onclick="window.deleteArchive('${id}')" class="w-full bg-slate-50 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all">
            Delete Record
        </button>
    </div>
  `;
  archivesGrid.appendChild(card);
}

/* -----------------------------------------------------------
   3. DELETION: Permanent Removal
   ----------------------------------------------------------- */
window.deleteArchive = async (id) => {
    if (!confirm("CRITICAL ACTION: This will permanently delete this record from the legacy vault. Continue?")) return;

    try {
        await deleteDoc(doc(db, "successful_donations", id));
        // No need to refresh, onSnapshot handles it!
    } catch (err) {
        alert("Permission Denied or System Error: " + err.message);
    }
};