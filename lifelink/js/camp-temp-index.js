import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const actionArea = document.getElementById("actionArea");
const adminNavPoint = document.getElementById("adminNavPoint");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    // 1. Check for notifications (Apologies for disbanded camps)
    await checkDisbandNotifications(user.uid);

    // 2. Check Role and Status to determine which button to show
    await checkUserPermissions(user.uid);
});

async function checkUserPermissions(uid) {
    try {
        // A. Check for Admin Role in 'users' collection
        const userSnap = await getDoc(doc(db, "users", uid));
        const userData = userSnap.data();
        
        // B. Check if user is an approved Maker
        const makerSnap = await getDoc(doc(db, "camp_makers", uid));
        
        // C. Check if there is a pending request
        const q = query(
            collection(db, "camp_maker_requests"), 
            where("userId", "==", uid), 
            where("status", "==", "pending")
        );
        const pendingSnap = await getDocs(q);

        // --- UI DECISION LOGIC ---

        // 1. Priority: ADMIN
        if (userSnap.exists() && userData.role === "admin") {
            // NEW: Inject Admin Nav Button
            if (adminNavPoint) {
                adminNavPoint.innerHTML = `
                    <button onclick="window.location.href='camps-admin.html'" 
                        class="text-[10px] font-black uppercase bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-all border-b-4 border-red-900 active:border-b-0 active:translate-y-1">
                        🛡️ Admin Panel
                    </button>`;
            }

            renderButton(
                "🛡️ Admin Panel", 
                "Control System & Approvals", 
                "camps-admin.html", 
                "bg-red-600 text-white border-b-8 border-red-900"
            );
        } 
        // 2. Priority: APPROVED MAKER
        else if (makerSnap.exists()) {
            renderButton(
                "⛺ Maker Hub", 
                "Manage Your Created Camps", 
                "camps-dashboard.html", 
                "bg-slate-900 text-white border-b-8 border-slate-700"
            );
        } 
        // 3. Priority: PENDING APPLICATION
        else if (!pendingSnap.empty) {
            actionArea.innerHTML = `
                <div class="bg-white border-4 border-yellow-400 p-8 rounded-[2.5rem] text-center shadow-xl">
                    <p class="text-yellow-600 font-black uppercase italic animate-pulse text-lg text-center">⏳ Under Review</p>
                    <p class="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest text-center">Admin is verifying your Maker request</p>
                </div>`;
        } 
        // 4. Default: REGULAR USER (Apply)
        else {
            renderButton(
                "🤝 Become Maker", 
                "Apply to host camps", 
                "camps-apply.html", 
                "bg-yellow-400 text-slate-900 border-b-8 border-yellow-600"
            );
        }

    } catch (err) {
        console.error("Permission Check Error:", err);
        if (actionArea) {
            actionArea.innerHTML = `<p class="text-red-500 font-bold text-xs">Error loading status. Please refresh.</p>`;
        }
    }
}

function renderButton(title, subtitle, link, classes) {
    if (!actionArea) return;
    actionArea.innerHTML = `
        <button onclick="window.location.href='${link}'" 
            class="${classes} w-full p-8 rounded-[2.5rem] transition-all active:scale-95 shadow-2xl group">
            <span class="block font-black uppercase italic text-2xl mb-1 group-hover:scale-105 transition-transform">${title}</span>
            <span class="text-[10px] font-bold opacity-70 uppercase tracking-[0.2em]">${subtitle}</span>
        </button>`;
}

async function checkDisbandNotifications(uid) {
    try {
        const q = query(collection(db, "camp_notifications"), where("userId", "==", uid));
        const snap = await getDocs(q);
        snap.forEach(async (nDoc) => {
            alert(`📢 NOTIFICATION:\n\n${nDoc.data().message}`);
            await deleteDoc(doc(db, "camp_notifications", nDoc.id));
        });
    } catch (e) {
        console.log("Notification check failed", e);
    }
}