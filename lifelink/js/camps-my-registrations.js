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
                    <p class="text-slate-400 text-lg font-bold italic uppercase">You haven't joined any camps yet.</p>
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
        listContainer.innerHTML = `<p class="text-red-500 font-bold text-center py-10">Failed to load registrations. Check console for details.</p>`;
    }
}

function renderRegistrationCard(reg, camp) {
    const card = document.createElement("div");
    // Styling the card
    card.className = "bg-white p-8 rounded-[2.5rem] shadow-xl border-l-8 border-yellow-400 hover:shadow-2xl transition-all relative overflow-hidden flex flex-col justify-between";
    
    // Check if camp date has passed
    const campDate = new Date(camp.campDate);
    const isExpired = campDate < new Date().setHours(0,0,0,0);
    
    // ID of the person who created the camp (to look up their contact info)
    const creatorId = camp.createdBy;

    card.innerHTML = `
        <div>
            <div class="flex justify-between items-start mb-4">
                <span class="text-[10px] font-black px-3 py-1 rounded-full uppercase ${reg.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${reg.status}
                </span>
                ${isExpired ? '<span class="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-full uppercase">Past Event</span>' : ''}
            </div>

            <h3 class="text-2xl font-black text-slate-900 leading-tight mb-2 uppercase italic tracking-tighter">${camp.campTitle}</h3>
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

            <div id="contact-box-${creatorId}" class="hidden mt-6 p-5 bg-blue-50 rounded-2xl border-2 border-blue-100 animate-in">
                <div class="space-y-4">
                    <div>
                        <p class="text-[9px] font-black text-blue-400 uppercase tracking-widest">Organizer Address</p>
                        <p id="addr-${creatorId}" class="text-xs font-bold text-slate-700 italic leading-snug">Fetching address...</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-blue-400 uppercase tracking-widest">Contact Number</p>
                        <a id="phone-${creatorId}" href="#" class="text-sm font-black text-blue-600 underline">Fetching phone...</a>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-8 flex items-center justify-between">
            <div class="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">
                Ref: ${reg.registeredAt ? new Date(reg.registeredAt.toDate()).toLocaleDateString() : 'Recent'}
            </div>
            <button onclick="toggleContactInfo('${creatorId}')" class="text-xs font-black text-yellow-600 hover:text-yellow-700 uppercase flex items-center gap-1 transition-all">
                📞 Contact Organizer
            </button>
        </div>
    `;

    listContainer.appendChild(card);
}

// --- GLOBAL TOGGLE & DATA FETCHING LOGIC ---
// This function pulls creatorDetails specifically from 'camp_maker_requests'
window.toggleContactInfo = async (creatorId) => {
    if (!creatorId) {
        alert("Organizer ID is missing for this camp.");
        return;
    }

    const box = document.getElementById(`contact-box-${creatorId}`);
    const addrElem = document.getElementById(`addr-${creatorId}`);
    const phoneLink = document.getElementById(`phone-${creatorId}`);

    // If box is hidden, fetch the data from the 'camp_maker_requests' collection
    if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');

        try {
            // Query for the specific user's application request
            const q = query(
                collection(db, "camp_maker_requests"), 
                where("userId", "==", creatorId)
            );
            
            const requestSnap = await getDocs(q);
            
            if (!requestSnap.empty) {
                // We take the data from the application (where your screenshot showed creatorAddress)
                const reqData = requestSnap.docs[0].data();
                
                // DISPLAY THE DATA
                addrElem.innerText = reqData.creatorAddress || "Address details not found in application.";
                
                const phoneValue = reqData.creatorPhone || "No phone listed";
                phoneLink.innerText = phoneValue;
                phoneLink.href = `tel:${phoneValue}`;
                
                console.log("Organizer Found:", reqData);
            } else {
                // Fallback if no request found
                addrElem.innerText = "No application details found for this organizer.";
                phoneLink.innerText = "Not Available";
            }
        } catch (err) {
            console.error("Error fetching organizer:", err);
            addrElem.innerText = "Error loading info.";
        }
    } else {
        // If already open, hide it
        box.classList.add('hidden');
    }
};