import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    collection, query, where, getDocs, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const listContainer = document.getElementById("registrationList");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    loadMyRegistrations(user.uid);
});

async function loadMyRegistrations(uid) {
    try {
        // 1. Fetch all registrations for this user
        const q = query(collection(db, "camp_registrations"), where("userId", "==", uid));
        const snap = await getDocs(q);

        if (snap.empty) {
            listContainer.innerHTML = `
                <div class="col-span-full bg-white p-16 rounded-[3rem] text-center border-4 border-dashed border-yellow-200">
                    <p class="text-slate-400 text-lg font-bold">You haven't joined any camps yet.</p>
                    <button onclick="window.location.href='camps-explore.html'" class="mt-4 text-yellow-600 font-black uppercase text-sm underline">Explore Active Camps</button>
                </div>`;
            return;
        }

        listContainer.innerHTML = ""; // Clear loader

        // 2. Loop through registrations and fetch camp details for each
        for (const regDoc of snap.docs) {
            const regData = regDoc.data();
            const campSnap = await getDoc(doc(db, "camps", regData.campId));
            
            if (campSnap.exists()) {
                const campData = campSnap.data();
                renderRegistrationCard(regData, campData);
            }
        }
    } catch (err) {
        console.error(err);
        listContainer.innerHTML = `<p class="text-red-500 font-bold">Failed to load data.</p>`;
    }
}

function renderRegistrationCard(reg, camp) {
    const card = document.createElement("div");
    // Yellow Theme Card
    card.className = "bg-white p-8 rounded-[2.5rem] shadow-xl border-l-8 border-yellow-400 hover:shadow-2xl transition-all relative overflow-hidden";
    
    // Check if camp date has passed
    const campDate = new Date(camp.campDate);
    const isExpired = campDate < new Date().setHours(0,0,0,0);

    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <span class="text-[10px] font-black px-3 py-1 rounded-full uppercase ${reg.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                ${reg.status}
            </span>
            ${isExpired ? '<span class="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-full uppercase">Past Event</span>' : ''}
        </div>

        <h3 class="text-2xl font-black text-slate-900 leading-tight mb-2">${camp.campTitle}</h3>
        <p class="text-slate-500 text-sm font-medium mb-6">📍 ${camp.locationText}</p>

        <div class="grid grid-cols-2 gap-4 border-t border-yellow-50 pt-6">
            <div>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Camp Date</p>
                <p class="font-bold text-slate-700">${camp.campDate}</p>
            </div>
            <div>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Slot</p>
                <p class="font-bold text-slate-700">${camp.startTime} - ${camp.endTime}</p>
            </div>
        </div>

        <div class="mt-6 flex items-center justify-between">
            <div class="text-[10px] text-slate-300 italic">Registered on ${new Date(reg.registeredAt?.toDate()).toLocaleDateString()}</div>
            <button onclick="window.location.href='mailto:support@camps.com?subject=Inquiry for ${camp.campTitle}'" class="text-xs font-black text-yellow-600 hover:text-yellow-700 uppercase">Contact Organizer</button>
        </div>
    `;

    listContainer.appendChild(card);
}