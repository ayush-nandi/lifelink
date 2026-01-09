import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, getDocs, query, where, updateDoc, doc, increment
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const eventsList = document.getElementById("eventsList");
const donorsSection = document.getElementById("donorsSection");
const donorsList = document.getElementById("donorsList");

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "index.html";
  else loadEvents(user.uid);
});

async function loadEvents(uid) {
  const q = query(collection(db, "events"), where("organizerId", "==", uid));
  const snap = await getDocs(q);
  eventsList.innerHTML = "";

  snap.forEach(docSnap => {
    const ev = docSnap.data();
    const div = document.createElement("div");
    div.className = "bg-white p-5 rounded-2xl shadow-sm cursor-pointer hover:border-red-600 border-2 border-transparent transition-all";
    div.innerHTML = `<h3 class="font-bold text-lg">${ev.title}</h3><p class="text-sm text-gray-500 uppercase font-bold tracking-tighter">${ev.type}</p>`;
    div.onclick = () => loadDonors(docSnap.id);
    eventsList.appendChild(div);
  });
}

async function loadDonors(eventId) {
  donorsSection.classList.remove("hidden");
  donorsList.innerHTML = `<p class="text-gray-400 italic">Fetching donor list...</p>`;

  const q = query(collection(db, "donations"), where("eventId", "==", eventId), where("status", "==", "registered"));
  const snap = await getDocs(q);
  donorsList.innerHTML = snap.empty ? `<p class="text-gray-500">No registered donors yet.</p>` : "";

  snap.forEach(d => {
    const donation = d.data();
    const row = document.createElement("div");
    row.className = "bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-gray-100";
    row.innerHTML = `
      <div>
        <p class="font-bold text-slate-800">${donation.donorName}</p>
        <p class="text-sm text-gray-500">${donation.donorPhone}</p>
      </div>
      <button class="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-bold text-sm transition-colors">Mark Completed</button>`;
    
    row.querySelector("button").onclick = () => approveDonation(d.id, donation.donorId, eventId);
    donorsList.appendChild(row);
  });
}

async function approveDonation(donationId, donorId, eventId) {
  if (!confirm("Mark this donation as completed? Credits will be awarded to the donor.")) return;
  try {
    await updateDoc(doc(db, "donations", donationId), { status: "completed" });
    await updateDoc(doc(db, "users", donorId), { credits: increment(100) });
    alert("Donation successful! 100 credits awarded.");
    loadDonors(eventId); 
  } catch (err) {
    console.error(err);
    alert("Error updating status.");
  }
}