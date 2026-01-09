import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const authArea = document.getElementById("authArea");
const livesSavedDisplay = document.getElementById("livesSavedCount");

/* -----------------------------------------------------------
   1. LIVE IMPACT FETCH (Successful Donations)
   ----------------------------------------------------------- */
async function loadSystemStats() {
    try {
        const snap = await getDocs(collection(db, "successful_donations"));
        livesSavedDisplay.innerText = snap.size || 0;
    } catch (err) {
        livesSavedDisplay.innerText = "80+"; 
    }
}

/* -----------------------------------------------------------
   2. AUTH & GATING LOGIC
   ----------------------------------------------------------- */
onAuthStateChanged(auth, (user) => {
    loadSystemStats();

    if (user) {
        // --- LOGGED IN: Dashboard Link ---
        authArea.innerHTML = `
            <a href="dashboard.html" class="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all">Go to Dashboard</a>
            <button id="logoutBtn" class="p-2 text-slate-400 hover:text-red-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
        `;
        
        document.getElementById("logoutBtn").onclick = () => {
            if(confirm("Confirm Sign Out?")) signOut(auth);
        };

    } else {
        // --- GUEST: Realistic Login Buttons ---
        authArea.innerHTML = `
            <a href="login.html" class="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200">Log In</a>
            <a href="login.html" class="bg-red-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-50">Join</a>
        `;

        // Gating Logic: Apply to all restricted cards (Except Hospitals)
        document.querySelectorAll('.gate-required').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                window.location.href = "login.html";
            };
        });
    }
});