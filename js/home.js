import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const authArea = document.getElementById("authArea");
const mainActionBtn = document.getElementById("mainActionBtn");

/* ============================================================
   1. DYNAMIC AUTH UI CHECK
   ============================================================ */
onAuthStateChanged(auth, (user) => {
  if (user) {
    // USER LOGGED IN
    authArea.innerHTML = `
      <button id="logoutBtn" class="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all">
        Logout
      </button>
    `;
    
    document.getElementById("logoutBtn").onclick = async () => {
      await signOut(auth);
      window.location.reload();
    };

    // ACTION: Go to Dashboard
    mainActionBtn.onclick = () => window.location.href = "dashboard.html";

  } else {
    // USER NOT LOGGED IN
    authArea.innerHTML = `
      <a href="login.html" class="px-6 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-100 transition-all">
        Login / Sign Up
      </a>
    `;

    // ACTION: Force Login
    mainActionBtn.onclick = () => window.location.href = "login.html";
  }
});