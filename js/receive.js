import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, updateDoc, doc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* -----------------------------------------------------------
   GLOBAL STATE
   ----------------------------------------------------------- */
let activeRequest = null;
const formSection = document.getElementById("newRequestSection");
const statusSection = document.getElementById("activeRequestSection");
const requestDetails = document.getElementById("requestDetails");

/* -----------------------------------------------------------
   AUTH & INITIAL CHECK
   ----------------------------------------------------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    checkActiveRequest(user.uid);
  }
});

/* -----------------------------------------------------------
   CHECK FOR PENDING EMERGENCY REQUESTS
   ----------------------------------------------------------- */
async function checkActiveRequest(uid) {
  const q = query(
    collection(db, "help_requests"),
    where("userId", "==", uid),
    where("status", "==", "open")
  );
  
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    activeRequest = { id: snap.docs[0].id, ...snap.docs[0].data() };
    renderStatus();
  } else {
    activeRequest = null;
    formSection.classList.remove("hidden");
    statusSection.classList.add("hidden");
  }
}

/* -----------------------------------------------------------
   RENDER ONGOING REQUEST UI
   ----------------------------------------------------------- */
function renderStatus() {
  formSection.classList.add("hidden");
  statusSection.classList.remove("hidden");
  
  requestDetails.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
      <p class="text-sm"><span class="text-slate-400 block font-bold uppercase tracking-widest text-[10px]">Type</span><span class="font-bold text-red-600">${activeRequest.type.toUpperCase()} (${activeRequest.bloodGroup})</span></p>
      <p class="text-sm"><span class="text-slate-400 block font-bold uppercase tracking-widest text-[10px]">Hospital</span><span class="font-bold text-slate-800">${activeRequest.hospital}</span></p>
      <p class="text-sm"><span class="text-slate-400 block font-bold uppercase tracking-widest text-[10px]">Created At</span><span class="font-bold text-slate-800">${new Date(activeRequest.createdAt?.toDate()).toLocaleString()}</span></p>
      <p class="text-sm"><span class="text-slate-400 block font-bold uppercase tracking-widest text-[10px]">Contact</span><span class="font-bold text-slate-800">${activeRequest.contactName} (${activeRequest.contactPhone})</span></p>
    </div>
  `;
}

/* -----------------------------------------------------------
   SUBMIT NEW EMERGENCY REQUEST
   ----------------------------------------------------------- */
document.getElementById("receiveForm").onsubmit = async (e) => {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerText = "Broadcasting...";

  try {
    await addDoc(collection(db, "help_requests"), {
      userId: auth.currentUser.uid,
      type: document.getElementById("reqType").value,
      bloodGroup: document.getElementById("bloodGroup").value,
      hospital: document.getElementById("hospital").value,
      contactName: document.getElementById("contactName").value,
      contactPhone: document.getElementById("contactPhone").value,
      status: "open",
      createdAt: serverTimestamp()
    });

    alert("Emergency broadcasted successfully. Help is on the way.");
    checkActiveRequest(auth.currentUser.uid);
  } catch (err) {
    console.error(err);
    alert("Broadcast failed. Please check your connection.");
    submitBtn.disabled = false;
    submitBtn.innerText = "Broadcast Emergency Request";
  }
};

/* -----------------------------------------------------------
   CANCEL / RESOLVE REQUEST
   ----------------------------------------------------------- */
document.getElementById("cancelRequestBtn").onclick = async () => {
  if (!confirm("Has this requirement been fulfilled? This will close the emergency broadcast.")) return;
  
  try {
    await updateDoc(doc(db, "help_requests", activeRequest.id), {
      status: "resolved",
      resolvedAt: serverTimestamp()
    });
    
    checkActiveRequest(auth.currentUser.uid);
  } catch (err) {
    alert("Error closing request.");
  }
};
/* ============================================================
   EMERGENCY BROADCAST DATA STRUCTURE
   ============================================================ */
async function submitEmergencyRequest() {
  const requestData = {
    userId: auth.currentUser.uid,
    type: document.getElementById("reqType").value,
    bloodGroup: document.getElementById("bloodGroup").value,
    hospital: document.getElementById("hospital").value, // The patient's current location
    contactName: document.getElementById("contactName").value,
    contactPhone: document.getElementById("contactPhone").value,
    status: "open", // Request is live and visible to others
    createdAt: serverTimestamp() 
  };
  
  // This broadcast notifies all nearby users and organizers
  await addDoc(collection(db, "help_requests"), requestData);
}