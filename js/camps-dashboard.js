import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    deleteDoc // Added for delete functionality
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const container = document.getElementById("actionContainer");
const regList = document.getElementById("userRegistrationsList");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    await checkMakerStatus(user.uid);
    await loadUserJoinedCamps(user.uid);
});

// --- GLOBAL DELETE FUNCTION ---
window.handleDeleteCamp = async (campId) => {
    const confirmation = confirm("⚠️ Are you sure? Deleting this camp will remove it from the map and participant lists forever.");
    
    if (confirmation) {
        try {
            await deleteDoc(doc(db, "camps", campId));
            alert("Camp successfully deleted.");
            location.reload(); // Refresh to update the UI
        } catch (err) {
            console.error("Error deleting camp:", err);
            alert("Failed to delete camp. You may not have permission.");
        }
    }
};

async function checkMakerStatus(uid) {
    try {
        const makerSnap = await getDoc(doc(db, "camp_makers", uid));
        if (makerSnap.exists()) {
            renderApprovedUI();
            await loadOrganizerHub(uid);
        } else {
            await checkPendingRequest(uid);
        }
    } catch (err) {
        console.error("Maker Check Error:", err);
    }
}

function renderApprovedUI() {
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <button onclick="window.location.href='camps-create.html'" class="bg-yellow-400 hover:bg-yellow-500 p-10 rounded-[2.5rem] transition-all flex flex-col items-center shadow-xl border-b-8 border-yellow-600 active:translate-y-1">
                <span class="text-5xl mb-4">➕</span>
                <span class="font-black uppercase italic text-slate-900">Create New Camp</span>
            </button>
            <button onclick="window.location.href='camps-explore.html'" class="bg-slate-900 hover:bg-black text-white p-10 rounded-[2.5rem] transition-all flex flex-col items-center shadow-xl border-b-8 border-slate-700 active:translate-y-1">
                <span class="text-5xl mb-4">🗺️</span>
                <span class="font-black uppercase italic">Explore Map</span>
            </button>
        </div>`;
}

async function loadOrganizerHub(organizerUid) {
    const campsQ = query(collection(db, "camps"), where("createdBy", "==", organizerUid));
    const campsSnap = await getDocs(campsQ);
    
    const summaryDiv = document.createElement("div");
    summaryDiv.className = "mt-12 grid grid-cols-1 gap-6";
    summaryDiv.innerHTML = `<h3 class="text-2xl font-black uppercase italic text-slate-800">📋 My Created Camps</h3>`;
    
    document.querySelector('main').appendChild(summaryDiv);

    const tableDiv = document.createElement("div");
    tableDiv.className = "mt-8 w-full bg-white p-8 rounded-[3rem] border-4 border-slate-900 shadow-xl overflow-hidden";
    tableDiv.innerHTML = `
        <h3 class="text-xl font-black mb-6 uppercase italic text-slate-800 flex items-center gap-2">
            <span class="bg-black text-white p-2 rounded-lg text-xs">👥</span> Participant Contact List
        </h3>
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead class="border-b-4 border-yellow-400 font-black text-[10px] uppercase tracking-widest text-slate-400">
                    <tr>
                        <th class="py-4 px-2">Camp Name</th>
                        <th class="py-4 px-2">Participant Name</th>
                        <th class="py-4 px-2">Contact Info</th>
                    </tr>
                </thead>
                <tbody id="pTableBody"></tbody>
            </table>
        </div>`;
    document.querySelector('main').appendChild(tableDiv);
    const pTableBody = document.getElementById("pTableBody");

    if (campsSnap.empty) {
        summaryDiv.innerHTML += `<p class="text-slate-400 font-bold italic">No camps created yet.</p>`;
        return;
    }

    for (const cDoc of campsSnap.docs) {
        const camp = cDoc.data();
        const rSnap = await getDocs(query(collection(db, "camp_registrations"), where("campId", "==", cDoc.id)));
        const regCount = rSnap.size;

        const campCard = document.createElement("div");
        campCard.className = "bg-white p-6 rounded-3xl border-2 border-slate-100 flex justify-between items-center shadow-sm hover:border-yellow-400 transition-all";
        campCard.innerHTML = `
            <div>
                <h4 class="font-black text-slate-800 uppercase italic text-lg">${camp.campTitle}</h4>
                <p class="text-[10px] font-bold text-slate-400">📍 ${camp.locationText}</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="bg-yellow-400 px-6 py-2 rounded-2xl text-center">
                    <span class="block text-2xl font-black text-slate-900">${regCount}</span>
                    <span class="text-[8px] font-black uppercase text-slate-900 tracking-tighter">Joined</span>
                </div>
                <button onclick="handleDeleteCamp('${cDoc.id}')" class="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                    🗑️
                </button>
            </div>
        `;
        summaryDiv.appendChild(campCard);

        rSnap.forEach(rDoc => {
            const reg = rDoc.data();
            const tr = document.createElement("tr");
            tr.className = "border-b border-yellow-50 hover:bg-yellow-50";
            tr.innerHTML = `
                <td class="py-5 px-2 font-bold text-slate-700 text-sm">${camp.campTitle}</td>
                <td class="py-5 px-2 font-black text-slate-900">${reg.userName}</td>
                <td class="py-5 px-2 font-mono text-xs text-slate-500">${reg.userPhone}</td>`;
            pTableBody.appendChild(tr);
        });
    }
}

async function loadUserJoinedCamps(uid) {
    const q = query(collection(db, "camp_registrations"), where("userId", "==", uid));
    const snap = await getDocs(q);
    
    regList.innerHTML = snap.empty ? `<p class="col-span-full text-slate-300 font-black uppercase text-[10px] py-10">You haven't joined any camps yet.</p>` : "";

    for (const rDoc of snap.docs) {
        const cSnap = await getDoc(doc(db, "camps", rDoc.data().campId));
        if (cSnap.exists()) {
            const camp = cSnap.data();
            const div = document.createElement("div");
            div.className = "p-6 bg-yellow-50 rounded-[2.5rem] border-2 border-yellow-200 shadow-sm";
            div.innerHTML = `
                <h4 class="font-black uppercase italic text-slate-800 text-sm mb-1">${camp.campTitle}</h4>
                <p class="text-[10px] font-bold text-slate-500">📍 ${camp.locationText}</p>
            `;
            regList.appendChild(div);
        }
    }
}

async function checkPendingRequest(uid) {
    const q = query(collection(db, "camp_maker_requests"), where("userId", "==", uid), where("status", "==", "pending"));
    const snap = await getDocs(q);
    if (!snap.empty) {
        container.innerHTML = `<p class="font-black text-yellow-600 uppercase italic">Application Pending...</p>`;
    } else {
        container.innerHTML = `
            <h3 class="text-xl font-black mb-4 uppercase italic tracking-tighter">Ready to lead?</h3>
            <button onclick="window.location.href='camps-apply.html'" class="bg-yellow-400 px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-lg">Apply as Maker</button>
        `;
    }
}