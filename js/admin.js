import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, getDocs, doc, updateDoc, query, where
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const container = document.getElementById("requestsContainer");

/* ============================================================
   1. AUTHENTICATION & PERMISSION CHECK
   ============================================================ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html"; // Kick out if not logged in
    return;
  }

  // Double-verify admin role in Firestore
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", user.uid)));
  
  let isAdmin = false;
  userSnap.forEach(d => {
    if (d.data().role === "admin") isAdmin = true;
  });

  if (!isAdmin) {
    alert("Access Denied: Admin Privileges Required.");
    window.location.href = "dashboard.html";
    return;
  }

  loadRequests(); // If admin, load the dashboard
});

/* ============================================================
   2. LOAD PENDING HOST REQUESTS
   ============================================================ */
async function loadRequests() {
  container.innerHTML = `<p class="text-gray-400 animate-pulse">Fetching pending applications...</p>`;

  const q = query(collection(db, "host_requests"), where("status", "==", "pending"));
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = `
      <div class="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
        <p class="text-gray-400 text-lg">No pending organizer requests.</p>
      </div>`;
    return;
  }

  container.innerHTML = ""; // Clear loader

  snap.forEach(docSnap => {
    const r = docSnap.data();
    const card = document.createElement("div");
    card.className = "bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 hover:shadow-md transition-shadow";

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="text-xl font-bold text-slate-900">${r.orgName}</h3>
          <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase">${r.orgType}</span>
        </div>
        <p class="text-xs text-gray-400">${new Date(r.createdAt?.toDate()).toLocaleDateString()}</p>
      </div>

      <div class="grid grid-cols-2 gap-4 text-sm text-gray-600">
        <p><b>ID:</b> ${r.registrationId}</p>
        <p><b>Focus:</b> ${r.donationType}</p>
        <p class="col-span-2"><b>Contact:</b> ${r.contact}</p>
      </div>

      <div class="flex gap-3 pt-2">
        <button class="approveBtn flex-1 bg-green-600 text-white py-2 rounded-xl font-bold hover:bg-green-700 transition">Approve</button>
        <button class="rejectBtn flex-1 bg-red-50 text-red-600 py-2 rounded-xl font-bold hover:bg-red-100 transition">Reject</button>
      </div>
    `;

    // APPROVE LOGIC
    card.querySelector(".approveBtn").onclick = async () => {
      try {
        await updateDoc(doc(db, "users", r.userId), { role: "organizer" }); // Promote user
        await updateDoc(doc(db, "host_requests", docSnap.id), { status: "approved" }); // Update request
        card.remove();
        alert(`${r.orgName} has been approved as an Organizer.`);
      } catch (err) { alert("Error during approval: " + err.message); }
    };

    // REJECT LOGIC
    card.querySelector(".rejectBtn").onclick = async () => {
      if (confirm("Are you sure you want to reject this organization?")) {
        await updateDoc(doc(db, "host_requests", docSnap.id), { status: "rejected" });
        card.remove();
      }
    };

    container.appendChild(card);
  });
}