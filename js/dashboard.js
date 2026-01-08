import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
  doc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocs, serverTimestamp, deleteDoc, addDoc 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const userNameDisplay = document.getElementById("userName");
const roleBadge = document.getElementById("userRoleBadge");
const organizerSection = document.getElementById("organizerSection");
const adminSection = document.getElementById("adminSection");
const directRequestsList = document.getElementById("directRequestsList");
const profileModal = document.getElementById("profileModal");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 1. STABLE PROFILE FETCH
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (userSnap.exists()) {
      const userData = userSnap.data();
      userNameDisplay.innerText = userData.name;

      if (userData.role === 'admin') {
        roleBadge.innerText = "Super Admin";
        roleBadge.classList.remove('hidden');
        adminSection.classList.remove("hidden");
        organizerSection.classList.remove("hidden");
        initAdminEmergencyFeed();
        initAdminBadges(); 
      } 
      else if (userData.role === 'organizer') {
        roleBadge.innerText = "Verified Organizer";
        roleBadge.classList.remove('hidden');
        organizerSection.classList.remove("hidden");
        initOrganizerHandshakes(user.uid);
        if (!userData.phone) openProfileModal();
      } 
      else {
        checkHostStatus(user.uid);
      }
      
      // 2. STABLE NOTIFICATION BADGES
      initUserNotifications(user.uid);
    }
  } else {
    window.location.href = "login.html";
  }
});

/* -----------------------------------------------------------
   1. ORGANIZER: LIVE-BROADCAST ONLY HANDSHAKES
   ----------------------------------------------------------- */
function initOrganizerHandshakes(orgId) {
    const q = query(collection(db, "direct_requests"), where("orgId", "==", orgId), where("status", "==", "pending"));

    onSnapshot(q, async (snap) => {
        document.getElementById("requestCountBadge").innerText = `${snap.size} Pending`;
        directRequestsList.innerHTML = "";
        
        if (snap.empty) {
            directRequestsList.innerHTML = `<p class="col-span-full py-10 text-center text-slate-400 italic">No live handshakes.</p>`;
            return;
        }

        for (const d of snap.docs) {
            const req = d.data();
            
            // SECONDARY CHECK: Verify if the original broadcast is still LIVE
            const broadcastSnap = await getDoc(doc(db, "help_requests", req.requestId));
            if (broadcastSnap.exists() && broadcastSnap.data().status === 'open') {
                renderHandshakeCard(req);
            } else {
                // If the broadcast is gone, auto-cleanup this handshake
                await updateDoc(doc(db, "direct_requests", d.id), { status: 'resolved' });
            }
        }
    });
}

function renderHandshakeCard(req) {
    const card = document.createElement("div");
    card.className = "bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-red-500 animate-in zoom-in transition-all";
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <span class="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">Live</span>
            <p class="text-[9px] font-bold text-slate-300 uppercase">${new Date(req.timestamp?.toDate()).toLocaleTimeString()}</p>
        </div>
        <h4 class="font-black text-slate-900 leading-tight">${req.bloodGroup} ${req.type}</h4>
        <p class="text-xs font-bold text-slate-500 mt-2">${req.hospital}</p>
        <div class="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
            <div>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient</p>
                <p class="font-black text-slate-800 text-sm">${req.requesterName}</p>
            </div>
            <a href="tel:${req.requesterPhone}" class="p-3 bg-red-600 text-white rounded-xl shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-2.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </a>
        </div>
    `;
    directRequestsList.appendChild(card);
}

/* -----------------------------------------------------------
   2. ADMIN: GLOBAL BROADCAST MONITOR
   ----------------------------------------------------------- */
function initAdminEmergencyFeed() {
    const q = query(collection(db, "help_requests"), where("status", "==", "open"));
    onSnapshot(q, (snap) => {
        document.getElementById("requestCountBadge").innerText = `${snap.size} Live`;
        directRequestsList.innerHTML = snap.empty ? `<p class="col-span-full py-10 text-center text-slate-400 italic font-black uppercase text-[10px]">Platform Status: Clear</p>` : "";
        snap.forEach(d => {
            const h = d.data();
            const card = document.createElement("div");
            card.className = "bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-purple-500 animate-in zoom-in";
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <span class="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Global Watch</span>
                </div>
                <h4 class="font-black text-slate-900 leading-tight">${h.bloodGroup} ${h.type} Required</h4>
                <p class="text-xs font-bold text-slate-500 mt-2 italic">${h.hospital}</p>
                <div class="mt-4 p-4 bg-slate-50 rounded-2xl">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Details</p>
                    <p class="text-xs font-bold text-slate-800">${h.contactName} | ${h.contactPhone}</p>
                </div>
                <button onclick="window.markResolved('${d.id}')" class="w-full mt-6 bg-slate-900 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">Resolve & Archive</button>
            `;
            directRequestsList.appendChild(card);
        });
    });
}

window.markResolved = async (id) => {
    if (!confirm("Move to archive?")) return;
    const snap = await getDoc(doc(db, "help_requests", id));
    if (snap.exists()) {
        await addDoc(collection(db, "successful_donations"), { ...snap.data(), resolvedAt: serverTimestamp() });
        await deleteDoc(doc(db, "help_requests", id));
        alert("Case archived.");
    }
};

/* -----------------------------------------------------------
   3. STABLE BADGE LISTENERS (Legacy logic)
   ----------------------------------------------------------- */
function initAdminBadges() {
    onSnapshot(query(collection(db, "host_requests"), where("status", "==", "pending")), (snap) => {
        const b = document.getElementById("badge-admin-apps");
        if (b) {
            b.innerText = snap.size;
            snap.size > 0 ? b.classList.remove("hidden") : b.classList.add("hidden");
        }
    });
}

function initUserNotifications(uid) {
    onSnapshot(query(collection(db, "help_requests"), where("userId", "==", uid), where("status", "==", "open")), (snap) => {
        const b = document.getElementById("badge-user-help");
        if (b) {
            b.innerText = snap.size;
            snap.size > 0 ? b.classList.remove("hidden") : b.classList.add("hidden");
        }
    });
}

/* -----------------------------------------------------------
   4. HOST STATUS & UTILS
   ----------------------------------------------------------- */
async function checkHostStatus(uid) {
    const hostBtn = document.getElementById("hostBtnArea");
    const snap = await getDocs(query(collection(db, "host_requests"), where("userId", "==", uid)));
    if (!snap.empty) {
        const r = snap.docs[0].data();
        hostBtn.innerHTML = `<div class="text-center"><span class="text-4xl">⏳</span><h4 class="text-[10px] font-black uppercase text-orange-600 mt-2">${r.status}</h4></div>`;
    } else {
        hostBtn.innerHTML = `<a href="host.html" class="flex flex-col items-center"><span class="text-4xl mb-2">🏢</span><h4 class="text-[10px] font-black uppercase text-slate-900 tracking-widest">Become a Host</h4></a>`;
        hostBtn.classList.add("cursor-pointer", "hover:border-red-500");
    }
}

window.openProfileModal = () => profileModal.classList.replace("hidden", "flex");
window.closeProfileModal = () => profileModal.classList.replace("flex", "hidden");

document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: document.getElementById("orgName").value,
        phone: document.getElementById("orgPhone").value,
        email: document.getElementById("orgEmail").value,
        profileUpdated: serverTimestamp()
    });
    alert("Profile Updated!");
    location.reload();
});

document.getElementById("logoutBtn").onclick = () => {
    if (confirm("Sign out?")) signOut(auth).then(() => window.location.href = "index.html");
};