import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const userCreditsEl = document.getElementById("userCredits");

const donateBtn = document.getElementById("donateBtn");
const receiveBtn = document.getElementById("receiveBtn");
const hostBtn = document.getElementById("hostBtn");
const createEventBtn = document.getElementById("createEventBtn");
const manageEventsBtn = document.getElementById("manageEventsBtn");
const adminBtn = document.getElementById("adminBtn");
const adminPanel = document.getElementById("adminPanel");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;

  const data = snap.data();

  userNameEl.textContent = data.name || "User";
  userRoleEl.textContent = data.role;
  userCreditsEl.textContent = data.credits || 0;

  // Common
  donateBtn.onclick = () => window.location.href = "donate.html";
  receiveBtn.onclick = () => window.location.href = "receive.html";

  // Donor
  if (data.role === "donor") {
    hostBtn.classList.remove("hidden");
    hostBtn.onclick = () => window.location.href = "host.html";
  }

  // Organizer
  if (data.role === "organizer") {
    createEventBtn.classList.remove("hidden");
    manageEventsBtn.classList.remove("hidden");

    createEventBtn.onclick = () => window.location.href = "create-event.html";
    manageEventsBtn.onclick = () => window.location.href = "manage-events.html";
  }

  // Admin
  if (data.role === "admin") {
    adminBtn.classList.remove("hidden");
    adminPanel.classList.remove("hidden");
    adminBtn.onclick = () => window.location.href = "admin.html";
  }
});

// Logout
logoutBtn.onclick = async () => {
  await signOut(auth);
  window.location.href = "index.html";
};
