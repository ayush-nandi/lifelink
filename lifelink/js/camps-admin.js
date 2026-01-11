import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, serverTimestamp, deleteDoc 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// DOM Elements
const makerList = document.getElementById("pendingMakersList");
const pendingCampList = document.getElementById("pendingCampsList");
const approvedCampList = document.getElementById("approvedCampsList");

// --- INITIALIZATION & SECURITY ---
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "login.html"; return; }
    
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists() || userSnap.data().role !== "admin") {
        alert("Access Denied: Admins Only");
        window.location.href = "camps-dashboard.html";
        return;
    }

    // Pre-load data so it's ready when boxes are clicked
    loadPendingMakers();
    loadPendingCamps();
    loadApprovedCamps();
});

// --- HUB NAVIGATION LOGIC (The "Box" Click Logic) ---
window.showSection = (type) => {
    const display = document.getElementById("contentDisplay");
    const title = document.getElementById("sectionTitle");
    const mArea = document.getElementById("pendingMakersList");
    const cArea = document.getElementById("campSubContainer");

    if (!display) return; // Safety check

    display.classList.remove("hidden");
    
    if (type === 'makers') {
        title.innerText = "Maker Applications";
        title.className = "text-3xl font-black uppercase italic text-red-600";
        if (mArea) mArea.classList.remove("hidden");
        if (cArea) cArea.classList.add("hidden");
    } else {
        title.innerText = "Camp Management";
        title.className = "text-3xl font-black uppercase italic text-green-700";
        if (mArea) mArea.classList.add("hidden");
        if (cArea) cArea.classList.remove("hidden");
    }

    // Smooth scroll to the content
    window.scrollTo({
        top: display.offsetTop - 40,
        behavior: 'smooth'
    });
};

window.hideSection = () => {
    const display = document.getElementById("contentDisplay");
    if (display) display.classList.add("hidden");
};

// --- DATA LOADING FUNCTIONS ---

async function loadPendingMakers() {
    const q = query(collection(db, "camp_maker_requests"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    
    makerList.innerHTML = snap.empty ? `<p class="text-slate-400 italic p-4">No pending maker applications.</p>` : "";

    snap.forEach(dSnap => {
        const req = dSnap.data();
        const displayName = req.creatorName || "Unknown User";
        const displayEmail = req.creatorEmail || "No Email";
        const orgName = req.organizationName || "No Org Info";

        const div = document.createElement("div");
        div.className = "bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100 flex justify-between items-center mb-4";
        div.innerHTML = `
            <div>
                <h4 class="font-black uppercase text-slate-800 text-lg">${displayName}</h4>
                <p class="text-xs text-slate-500 font-bold mb-1">${displayEmail}</p>
                <p class="text-[10px] text-blue-600 font-black uppercase tracking-wider">🏛️ Org: ${orgName}</p>
                <p class="text-[10px] text-slate-400 font-bold">🆔 ${req.govtIdType}: ${req.govtIdNumber}</p>
            </div>
            <div class="flex flex-col gap-2">
                <button onclick="approveMaker('${dSnap.id}', '${req.userId}')" class="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-md">Approve</button>
                <button onclick="rejectRequest('${dSnap.id}', 'camp_maker_requests')" class="bg-red-50 hover:bg-red-100 text-red-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all">Deny</button>
            </div>`;
        makerList.appendChild(div);
    });
}

async function loadPendingCamps() {
    const q = query(collection(db, "camps"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    
    pendingCampList.innerHTML = snap.empty ? `<p class="text-slate-400 italic p-4">No camps awaiting approval.</p>` : "";

    snap.forEach(dSnap => {
        const camp = dSnap.data();
        const div = document.createElement("div");
        div.className = "bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100 flex justify-between items-center mb-4";
        div.innerHTML = `
            <div>
                <h4 class="font-black uppercase text-slate-800">${camp.campTitle}</h4>
                <p class="text-xs text-slate-500 font-bold">📍 ${camp.locationText}</p>
                <p class="text-[10px] text-slate-400 mt-1">📅 ${camp.campDate}</p>
            </div>
            <div class="flex flex-col gap-2">
                <button onclick="approveCamp('${dSnap.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-md">Go Live</button>
                <button onclick="rejectRequest('${dSnap.id}', 'camps')" class="bg-red-50 hover:bg-red-100 text-red-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all">Reject</button>
            </div>`;
        pendingCampList.appendChild(div);
    });
}

async function loadApprovedCamps() {
    const q = query(collection(db, "camps"), where("status", "==", "active"));
    const snap = await getDocs(q);
    
    approvedCampList.innerHTML = snap.empty ? `<p class="text-slate-400 italic p-4">No approved camps live yet.</p>` : "";

    snap.forEach(dSnap => {
        const camp = dSnap.data();
        const div = document.createElement("div");
        div.className = "bg-white p-6 rounded-2xl shadow-sm border-2 border-green-100 border-l-4 border-l-green-500 flex justify-between items-center mb-4";
        div.innerHTML = `
            <div>
                <h4 class="font-black uppercase text-slate-800">${camp.campTitle}</h4>
                <p class="text-xs text-green-600 font-bold italic">● Active on Map</p>
                <p class="text-[10px] text-slate-400 mt-1">📅 ${camp.campDate} | 📍 ${camp.locationText}</p>
            </div>
            <div>
                <button onclick="deleteApprovedCamp('${dSnap.id}')" class="bg-slate-900 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-md">Delete Camp</button>
            </div>`;
        approvedCampList.appendChild(div);
    });
}

// --- DATABASE ACTIONS ---

window.approveMaker = async (reqId, userId) => {
    try {
        const btn = document.activeElement;
        if(btn) btn.innerText = "Processing...";
        await updateDoc(doc(db, "camp_maker_requests", reqId), { status: "approved" });
        await setDoc(doc(db, "camp_makers", userId), { 
            userId, approvedAt: serverTimestamp(), role: "maker" 
        });
        alert("User is now an official Camp Maker!");
        location.reload();
    } catch (err) { alert(err.message); }
};

window.approveCamp = async (campId) => {
    try {
        const btn = document.activeElement;
        if(btn) btn.innerText = "Processing...";
        await updateDoc(doc(db, "camps", campId), { status: "active" });
        alert("Camp is now live on the map!");
        location.reload();
    } catch (err) { alert(err.message); }
};

window.rejectRequest = async (id, collectionName) => {
    if(confirm("Are you sure you want to delete this request permanently?")) {
        try {
            await deleteDoc(doc(db, collectionName, id));
            location.reload();
        } catch(err) { alert("Error deleting: " + err.message); }
    }
};

window.deleteApprovedCamp = async (campId) => {
    if(confirm("CRITICAL: This will remove the approved camp from the map permanently. Proceed?")) {
        try {
            await deleteDoc(doc(db, "camps", campId));
            alert("Approved camp has been deleted.");
            location.reload();
        } catch(err) { alert("Error: " + err.message); }
    }
};